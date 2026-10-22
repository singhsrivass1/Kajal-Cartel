/**
 * Proves the rate limiter actually returns 429 past its threshold, by driving a
 * real route handler — not by trusting that the middleware is wired.
 *
 * Runs the handler in-process with a synthetic Request, so no server or DB is
 * required: every route below rejects before touching the database, which is
 * exactly the property being verified (a blocked request must cost nothing).
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
}

function makeRequest(url: string, ip: string, body: unknown = {}): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

async function main() {
  const { checkRateLimit, enforceRateLimit, RATE_LIMITS } = await import('../src/lib/api/rateLimit');

  console.log('--- Unit: window accounting ---');
  const rule = { limit: 3, windowMs: 60_000 };
  const key = `unit-test-${Date.now()}`;
  const results = [1, 2, 3, 4, 5].map(() => checkRateLimit(key, rule));
  check('first 3 requests allowed', results.slice(0, 3).every((r) => r.allowed));
  check('4th and 5th blocked', !results[3].allowed && !results[4].allowed);
  check('remaining counts down correctly', results[0].remaining === 2 && results[2].remaining === 0);
  check('retryAfterSeconds set once blocked', results[3].retryAfterSeconds > 0);

  console.log('\n--- Unit: keys are isolated ---');
  const other = checkRateLimit(`${key}-different`, rule);
  check('a different key is unaffected by the exhausted one', other.allowed);

  console.log('\n--- Unit: window expiry resets the bucket ---');
  const shortRule = { limit: 1, windowMs: 120 };
  const expiryKey = `expiry-${Date.now()}`;
  check('first allowed', checkRateLimit(expiryKey, shortRule).allowed);
  check('second blocked immediately', !checkRateLimit(expiryKey, shortRule).allowed);
  await new Promise((r) => setTimeout(r, 200));
  check('allowed again after the window elapses', checkRateLimit(expiryKey, shortRule).allowed);

  console.log('\n--- Unit: identity keying ---');
  const ipA = enforceRateLimit(makeRequest('http://x/api/test', '203.0.113.1'), `scope-${Date.now()}`, { limit: 1, windowMs: 60_000 });
  check('an allowed request returns null (no response)', ipA === null);

  const scope = `scope2-${Date.now()}`;
  enforceRateLimit(makeRequest('http://x/api/test', '203.0.113.5'), scope, { limit: 1, windowMs: 60_000 });
  const sameIp = enforceRateLimit(makeRequest('http://x/api/test', '203.0.113.5'), scope, { limit: 1, windowMs: 60_000 });
  const otherIp = enforceRateLimit(makeRequest('http://x/api/test', '203.0.113.9'), scope, { limit: 1, windowMs: 60_000 });
  check('same IP is blocked on second call', sameIp !== null && sameIp.status === 429);
  check('a different IP is not blocked', otherIp === null);

  const userScope = `scope3-${Date.now()}`;
  enforceRateLimit(makeRequest('http://x/api/test', '203.0.113.1'), userScope, { limit: 1, windowMs: 60_000 }, { userId: 'user-alpha' });
  const sameUserDifferentIp = enforceRateLimit(
    makeRequest('http://x/api/test', '198.51.100.77'),
    userScope,
    { limit: 1, windowMs: 60_000 },
    { userId: 'user-alpha' }
  );
  check('signed-in identity is tracked across changing IPs', sameUserDifferentIp !== null && sameUserDifferentIp.status === 429);

  console.log('\n--- Integration: real route handlers return 429 ---');

  // Public, unauthenticated route — the full path is exercised end to end.
  const signup = await import('../src/app/api/auth/signup/route');
  const signupLimit = RATE_LIMITS.signup.limit;
  const ip = '198.51.100.' + Math.floor(Math.random() * 200 + 20);
  let firstStatus = 0;
  let blockedResponse: Response | null = null;

  for (let i = 0; i < signupLimit + 2; i++) {
    const res = await signup.POST(
      makeRequest('http://localhost/api/auth/signup', ip, { name: '', email: 'bad', password: 'x' })
    );
    if (i === 0) firstStatus = res.status;
    if (res.status === 429) { blockedResponse = res; break; }
  }

  check('POST /api/auth/signup is not 429 on the first call', firstStatus !== 429, `got ${firstStatus}`);
  check(`POST /api/auth/signup returns 429 past ${signupLimit}/window`, blockedResponse !== null);

  if (blockedResponse) {
    const retryAfter = blockedResponse.headers.get('Retry-After');
    const limitHeader = blockedResponse.headers.get('X-RateLimit-Limit');
    const payload = await blockedResponse.json();
    check('429 carries a Retry-After header', Boolean(retryAfter) && Number(retryAfter) > 0, String(retryAfter));
    check('429 carries X-RateLimit-Limit', limitHeader === String(signupLimit), String(limitHeader));
    check('429 body has a human-readable error', typeof payload.error === 'string' && payload.error.length > 0, payload.error);
  }

  // A different IP must still get through — proves the block is scoped, not global.
  const freshRes = await signup.POST(
    makeRequest('http://localhost/api/auth/signup', '203.0.113.250', { name: '', email: 'bad', password: 'x' })
  );
  check('an unrelated IP is still served (block is per-key, not global)', freshRes.status !== 429, `got ${freshRes.status}`);

  // Session-gated routes (book, save-moodboard, rematch, admin) cannot be driven
  // in-process: getServerSession reads from Next's request-scoped AsyncLocalStorage,
  // which only exists inside a real server request. Their limiter wiring is covered
  // by the unit assertions above (same enforceRateLimit path, same rule objects);
  // what is asserted here instead is that every such route actually references it.
  console.log('\n--- Static: every intended route is wired to the limiter ---');
  const { readFileSync } = await import('fs');
  const wired: Array<[string, string]> = [
    ['/api/book', 'src/app/api/book/route.ts'],
    ['/api/match', 'src/app/api/match/route.ts'],
    ['/api/estimate', 'src/app/api/estimate/route.ts'],
    ['/api/auth/signup', 'src/app/api/auth/signup/route.ts'],
    ['/api/auth/forgot-password', 'src/app/api/auth/forgot-password/route.ts'],
    ['/api/auth/reset-password', 'src/app/api/auth/reset-password/route.ts'],
    ['/api/user/save-moodboard', 'src/app/api/user/save-moodboard/route.ts'],
    ['/api/user/save-artist', 'src/app/api/user/save-artist/route.ts'],
    ['/api/user/moodboards/[id]', 'src/app/api/user/moodboards/[id]/route.ts'],
    ['/api/user/moodboards/[id]/matches', 'src/app/api/user/moodboards/[id]/matches/route.ts'],
    ['/api/bookings/[id]', 'src/app/api/bookings/[id]/route.ts'],
    ['admin wrapper (covers all 11 admin routes)', 'src/lib/api/adminRoute.ts'],
  ];
  for (const [label, file] of wired) {
    const src = readFileSync(file, 'utf8');
    check(`${label} calls enforceRateLimit`, src.includes('enforceRateLimit'));
  }

  console.log(`\n${pass} passed, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Test script failed:', err);
  process.exit(1);
});

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const SITE = 'https://kajal-cartel.example.test';
const staysOnSite = (path: string) => {
  try {
    const resolved = new URL(path, SITE);
    return resolved.origin === SITE && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\');
  } catch {
    return false;
  }
};

async function main() {
  const { toSafeCallbackPath, DEFAULT_CALLBACK_PATH } = await import('../src/lib/auth/callbackUrl');
  const requireFromProject = createRequire(join(process.cwd(), 'package.json'));
  const nextAuthCallbacks = requireFromProject(join(process.cwd(), 'node_modules/next-auth/core/lib/default-callbacks.js'))
    .defaultCallbacks as { redirect: (p: { url: string; baseUrl: string }) => string };

  console.log('--- Accepted internal destinations ---');
  const accepted: Array<[string, string]> = [
    ['/journey', '/journey'],
    ['/discover', '/discover'],
    ['/admin', '/admin'],
    ['/admin/vendors/64bbbbbbbbbbbbbbbbbbbb01', '/admin/vendors/64bbbbbbbbbbbbbbbbbbbb01'],
    ['/artists/studio-noor', '/artists/studio-noor'],
    ['/artists/the-malviya-bride?tab=portfolio#services', '/artists/the-malviya-bride?tab=portfolio#services'],
    ['/journey?x=1&y=two', '/journey?x=1&y=two'],
    ['/discover#roster', '/discover#roster'],
    ['/', '/'],
    ['/%2F%2Fevil.example', '/%2F%2Fevil.example'],
    ['/%5Cevil.example', '/%5Cevil.example'],
  ];
  for (const [input, expected] of accepted) {
    const out = toSafeCallbackPath(input);
    check(`accepts ${JSON.stringify(input)}`, out === expected && staysOnSite(out), `got ${JSON.stringify(out)}`);
  }

  console.log('\n--- Rejected inputs fall back to /journey ---');
  const rejected: unknown[] = [
    null,
    undefined,
    '',
    42,
    ['/journey'],
    { toString: () => '/journey' },
    'journey',
    ' /journey',
    'https://evil.example',
    'http://evil.example/journey',
    'HTTPS://evil.example',
    'https:evil.example',
    '//evil.example',
    '///evil.example',
    '//evil.example/journey',
    '/\\evil.example',
    '\\\\evil.example',
    '/\\/evil.example',
    '/journey\\..\\evil',
    '/\t/evil.example',
    '/\n/evil.example',
    '/\r/evil.example',
    '/\u0000evil',
    '/\u007Fevil',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'mailto:someone@example.test',
    '/foo/..//evil.example',
    '/.//evil.example',
    '/./..//evil.example',
    `/${'a'.repeat(2048)}`,
  ];
  for (const input of rejected) {
    const label = typeof input === 'string' ? JSON.stringify(input).slice(0, 48) : `${typeof input} ${JSON.stringify(input) ?? ''}`.slice(0, 48);
    check(`rejects ${label}`, toSafeCallbackPath(input) === DEFAULT_CALLBACK_PATH, `got ${JSON.stringify(toSafeCallbackPath(input))}`);
  }

  console.log('\n--- Deterministic fuzz: every output stays on-site ---');
  let seed = 20261021;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const alphabet = ['/', '\\', '.', ':', '@', '?', '#', '%', '2', 'F', '5', 'C', 'a', 'z', 'h', 't', 'p', 's', '\t', '\n', ' ', 'javascript:', 'http:', '//'];
  let offSite = 0;
  let firstBad = '';
  for (let i = 0; i < 20000; i++) {
    const len = 1 + Math.floor(rand() * 12);
    let input = rand() < 0.7 ? '/' : '';
    for (let j = 0; j < len; j++) input += alphabet[Math.floor(rand() * alphabet.length)];
    const out = toSafeCallbackPath(input);
    if (!staysOnSite(out)) {
      offSite++;
      if (!firstBad) firstBad = JSON.stringify(input);
    }
  }
  check('20,000 generated inputs all produce same-origin paths', offSite === 0, `${offSite} off-site, first ${firstBad}`);

  console.log('\n--- Compatibility with NextAuth redirect validation (Google path) ---');
  const baseUrl = SITE;
  for (const [input] of accepted) {
    const out = toSafeCallbackPath(input);
    const redirected = nextAuthCallbacks.redirect({ url: out, baseUrl });
    check(`NextAuth keeps ${JSON.stringify(out)} on-site as ${JSON.stringify(redirected)}`, redirected === `${baseUrl}${out}`);
  }
  check('NextAuth maps the fallback to the same on-site path', nextAuthCallbacks.redirect({ url: DEFAULT_CALLBACK_PATH, baseUrl }) === `${baseUrl}/journey`);

  console.log('\n--- AuthClient wiring (static) ---');
  const client = readFileSync('src/app/auth/_components/AuthClient.tsx', 'utf8');
  check('AuthClient imports the sanitizer', client.includes("import { toSafeCallbackPath } from '@/lib/auth/callbackUrl';"));
  check('callbackUrl is derived only through the sanitizer', client.includes("const callbackUrl = toSafeCallbackPath(searchParams.get('callbackUrl'));"));
  check("raw searchParams.get('callbackUrl') is used nowhere else", client.split("searchParams.get('callbackUrl')").length === 2);
  check('Google sign-in, password sign-in and router.push all use the sanitized value',
    client.includes("signIn('google', { callbackUrl })") &&
    client.includes("signIn('credentials', { redirect: false, email, password, callbackUrl })") &&
    client.includes('router.push(callbackUrl);'));
  check('callback input is never rendered', !/\{\s*callbackUrl\s*\}/.test(client.replace("signIn('google', { callbackUrl })", '')));

  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test script failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});

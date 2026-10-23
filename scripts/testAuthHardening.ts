import { createHash, randomBytes } from 'crypto';

let pass = 0;
let fail = 0;
const out = (line: string) => process.stdout.write(line + '\n');
function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++;
    out(`  PASS  ${label}`);
  } else {
    fail++;
    out(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function requireDisposableDatabase(): string {
  if (process.env.CONFIRM_DISPOSABLE_TEST_DB !== 'yes') {
    throw new Error('Refusing to run: set CONFIRM_DISPOSABLE_TEST_DB=yes to confirm the target database is disposable.');
  }
  const uri = process.env.TEST_MONGODB_URI;
  if (!uri) throw new Error('Refusing to run: TEST_MONGODB_URI is not set.');
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('Refusing to run: TEST_MONGODB_URI must be a single-host mongodb:// URI.');
  }
  if (parsed.protocol !== 'mongodb:') throw new Error('Refusing to run: only mongodb:// URIs to a local server are allowed.');
  if (!LOCAL_HOSTS.has(parsed.hostname)) throw new Error('Refusing to run: the test database host must be localhost.');
  const dbName = parsed.pathname.replace(/^\//, '');
  if (!/^[a-z0-9_]+_test$/i.test(dbName)) throw new Error('Refusing to run: the test database name must end in _test.');
  if (process.env.MONGODB_URI && process.env.MONGODB_URI !== uri) {
    throw new Error('Refusing to run: MONGODB_URI is set to a different database.');
  }
  return uri;
}

const TEST_URI = requireDisposableDatabase();
process.env.MONGODB_URI = TEST_URI;

const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'owner@admin.example.test';
if (!TEST_ADMIN_EMAIL.endsWith('.test')) throw new Error('Refusing to run: TEST_ADMIN_EMAIL must use a .test domain.');
process.env.ADMIN_EMAIL = TEST_ADMIN_EMAIL;
if (!process.env.NEXTAUTH_SECRET) process.env.NEXTAUTH_SECRET = randomBytes(32).toString('hex');

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const randomIp = () => `198.18.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`;
const uniqueEmail = (label: string) => `${label}-${randomBytes(4).toString('hex')}@customers.example.test`;

const INITIATOR_COOKIE = 'kc_signup_initiator';
const newBrowser = () => randomBytes(32).toString('hex');

function jsonRequest(url: string, method: string, body?: unknown, browser?: string): Request {
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': randomIp(),
      ...(browser ? { cookie: `theme=dark; ${INITIATOR_COOKIE}=${browser}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function getRequest(url: string, browser?: string | null): Request {
  return new Request(url, {
    method: 'GET',
    headers: { 'x-forwarded-for': randomIp(), ...(browser ? { cookie: `${INITIATOR_COOKIE}=${browser}` } : {}) },
  });
}

function initiatorFromSetCookie(response: Response): string | null {
  const header = response.headers.get('set-cookie') ?? '';
  return header.match(new RegExp(`${INITIATOR_COOKIE}=([a-f0-9]{64})`))?.[1] ?? null;
}

function extractToken(html: string): string | null {
  return html.match(/token=([a-f0-9]{64})/)?.[1] ?? null;
}

const FIXTURE_IDS = {
  httpAdmin: '64aaaaaaaaaaaaaaaaaaaa01',
  httpCustomer: '64aaaaaaaaaaaaaaaaaaaa02',
  httpEmailMatch: '64aaaaaaaaaaaaaaaaaaaa03',
  httpAdminNoGoogle: '64aaaaaaaaaaaaaaaaaaaa04',
  httpPasswordUser: '64aaaaaaaaaaaaaaaaaaaa05',
  vendor: '64bbbbbbbbbbbbbbbbbbbb01',
  service: '64bbbbbbbbbbbbbbbbbbbb02',
  booking: '64bbbbbbbbbbbbbbbbbbbb03',
  missing: '64cccccccccccccccccccc99',
};
const BOOKING_MARKER = 'ZZ-PRIVATE-CONTACT-7Q2';
const VENDOR_MARKER = 'ZZ-VENDOR-MARKER-5K';

async function runInProcess(): Promise<void> {
  const mongoose = (await import('mongoose')).default;
  const { dbConnect } = await import('../src/lib/db/connect');
  await dbConnect();
  const db = mongoose.connection.db!;
  await db.dropDatabase();

  const User = (await import('../src/lib/db/models/User')).default;
  const PendingSignup = (await import('../src/lib/db/models/PendingSignup')).default;
  await User.init();
  await PendingSignup.init();

  const delivery = await import('../src/lib/email/delivery');
  const signupLib = await import('../src/lib/auth/passwordSignup');
  const signupRoute = await import('../src/app/api/auth/signup/route');
  const verifyRoute = await import('../src/app/api/auth/verify-email/route');
  const forgotRoute = await import('../src/app/api/auth/forgot-password/route');
  const resetRoute = await import('../src/app/api/auth/reset-password/route');
  const { authOptions } = await import('../src/lib/auth');
  const admin = await import('../src/lib/auth/admin');
  const bcrypt = (await import('bcryptjs')).default;

  const outbox: Array<{ to: string; subject: string; html: string }> = [];
  let transportFails = false;
  delivery.emailTransport.send = async (_config, message) => {
    if (transportFails) throw new Error('simulated provider failure');
    outbox.push(message);
  };

  const logged: string[] = [];
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      logged.push(args.map((a) => (a instanceof Error ? `${a.name} ${a.message} ${a.stack}` : String(a))).join(' '));
      original(...args);
    };
  }

  const credentialsProvider = authOptions.providers.find((p) => p.id === 'credentials') as unknown as {
    options: { authorize: (c: Record<string, string>, r: unknown) => Promise<{ id: string } | null> };
  };
  const authorize = (email: string, password: string) => credentialsProvider.options.authorize({ email, password }, {});

  const disableDelivery = () => {
    delete process.env.EMAIL_DELIVERY_VERIFIED;
  };
  const enableDelivery = () => {
    process.env.EMAIL_DELIVERY_VERIFIED = 'true';
    process.env.RESEND_API_KEY = 're_test_placeholder_not_a_real_key';
    process.env.EMAIL_FROM = 'Kajal Cartel <no-reply@mail.example.test>';
    process.env.NEXTAUTH_URL = 'http://localhost:3999';
  };

  const BASE = 'http://localhost:3999';
  const ownerBrowser = newBrowser();
  const attackerBrowser = newBrowser();
  const signup = (body: unknown, browser: string = ownerBrowser) =>
    signupRoute.POST(jsonRequest(`${BASE}/api/auth/signup`, 'POST', body, browser));
  const verify = (token: string, browser: string | null = ownerBrowser) =>
    verifyRoute.GET(getRequest(`${BASE}/api/auth/verify-email?token=${encodeURIComponent(token)}`, browser));
  const complete = (token: unknown, browser: unknown = ownerBrowser) => signupLib.completePasswordSignup(token, browser);
  const forgot = (email: string) => forgotRoute.POST(jsonRequest(`${BASE}/api/auth/forgot-password`, 'POST', { email }));
  const reset = (token: string, password: string) =>
    resetRoute.POST(jsonRequest(`${BASE}/api/auth/reset-password`, 'POST', { token, password }));
  const userDoc = (email: string) => db.collection('users').findOne({ email });
  const tokensSeen: string[] = [];

  out('\n--- Delivery configuration gate ---');
  disableDelivery();
  check('delivery disabled when EMAIL_DELIVERY_VERIFIED is unset', delivery.getEmailDeliveryConfig() === null);
  enableDelivery();
  check('delivery enabled only with full verified configuration', delivery.getEmailDeliveryConfig() !== null);
  process.env.EMAIL_FROM = 'onboarding@resend.dev';
  check('resend.dev sandbox sender keeps delivery disabled', delivery.getEmailDeliveryConfig() === null);
  process.env.EMAIL_FROM = 'Kajal <x@eu.resend.dev>';
  check('resend.dev subdomain sender keeps delivery disabled', delivery.getEmailDeliveryConfig() === null);
  enableDelivery();
  process.env.NEXTAUTH_URL = 'http://kajal.example.test';
  check('non-HTTPS public app URL keeps delivery disabled', delivery.getEmailDeliveryConfig() === null);
  enableDelivery();
  delete process.env.RESEND_API_KEY;
  check('missing provider key keeps delivery disabled', delivery.getEmailDeliveryConfig() === null);
  enableDelivery();
  process.env.EMAIL_DELIVERY_VERIFIED = 'TRUE';
  check('flag must be exactly "true"', delivery.getEmailDeliveryConfig() === null);

  out('\n--- Disabled mode: signup, reset, verification, password sign-in (tests 5, 6) ---');
  disableDelivery();
  const disabledEmail = uniqueEmail('disabled');
  const disabledSignup = await signup({ name: 'Disabled Test', email: disabledEmail, password: 'correct-horse-1' });
  check('signup returns 503 while delivery is disabled', disabledSignup.status === 503, `got ${disabledSignup.status}`);
  check('disabled signup creates no pending record', (await PendingSignup.countDocuments({ email: disabledEmail })) === 0);
  check('disabled signup creates no user', (await userDoc(disabledEmail)) === null);
  check('no email sent while disabled', outbox.length === 0);

  const disabledForgot = await forgot(disabledEmail);
  check('forgot-password returns 503 while delivery is disabled', disabledForgot.status === 503, `got ${disabledForgot.status}`);

  const resetUserEmail = uniqueEmail('reset-disabled');
  const parkedResetToken = randomBytes(32).toString('hex');
  await db.collection('users').insertOne({
    email: resetUserEmail,
    name: 'Reset Disabled',
    resetPasswordTokenHash: sha256(parkedResetToken),
    resetPasswordExpires: new Date(Date.now() + 600000),
  });
  const disabledReset = await reset(parkedResetToken, 'new-password-123');
  check('reset-password returns 503 while delivery is disabled', disabledReset.status === 503, `got ${disabledReset.status}`);
  const afterDisabledReset = await userDoc(resetUserEmail);
  check(
    'disabled reset neither consumes the token nor sets a password',
    afterDisabledReset?.resetPasswordTokenHash === sha256(parkedResetToken) && !afterDisabledReset?.passwordHash
  );

  const parkedVerifyToken = randomBytes(32).toString('hex');
  await db.collection('pendingsignups').insertOne({
    email: uniqueEmail('parked'),
    name: 'Parked',
    passwordHash: await bcrypt.hash('parked-password', 4),
    tokenHash: sha256(parkedVerifyToken),
    initiatorHash: sha256(ownerBrowser),
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 600000),
  });
  const disabledVerify = await verify(parkedVerifyToken);
  check(
    'verification redirects as unavailable while delivery is disabled',
    disabledVerify.status === 303 && (disabledVerify.headers.get('location') ?? '').includes('verification=unavailable')
  );
  check(
    'disabled verification does not consume the pending record',
    (await PendingSignup.countDocuments({ tokenHash: sha256(parkedVerifyToken) })) === 1
  );

  const verifiedPasswordEmail = uniqueEmail('verified-pw');
  await db.collection('users').insertOne({
    email: verifiedPasswordEmail,
    name: 'Verified Password',
    passwordHash: await bcrypt.hash('verified-password-1', 4),
    credentialsVerifiedAt: new Date(),
    emailVerified: new Date(),
  });
  check(
    'password sign-in denied for a verified user while delivery is disabled',
    (await authorize(verifiedPasswordEmail, 'verified-password-1')) === null
  );

  out('\n--- Test 1: new password signup creates no user before verification ---');
  enableDelivery();
  const newEmail = uniqueEmail('new');
  const newSignup = await signup({ name: 'New Customer', email: newEmail, password: 'new-customer-pw-1' });
  const newSignupBody = await newSignup.json();
  check('signup accepted with 202', newSignup.status === 202, `got ${newSignup.status}`);
  check('no user exists before verification', (await userDoc(newEmail)) === null);
  const newPending = await db.collection('pendingsignups').findOne({ email: newEmail });
  check('one pending record exists', newPending !== null);
  const newMail = outbox.find((m) => m.to === newEmail);
  const newToken = newMail ? extractToken(newMail.html) : null;
  if (newToken) tokensSeen.push(newToken);
  check('verification email sent to the address being claimed', Boolean(newToken));
  check('only the SHA-256 hash of the token is stored', Boolean(newToken) && newPending?.tokenHash === sha256(newToken!) && newPending?.tokenHash !== newToken);
  const storedDump = JSON.stringify(await db.collection('pendingsignups').find({}).toArray()) + JSON.stringify(await db.collection('users').find({}).toArray());
  check('raw token is not persisted anywhere', Boolean(newToken) && !storedDump.includes(newToken!));
  check('password sign-in denied before verification', (await authorize(newEmail, 'new-customer-pw-1')) === null);

  const verifyResponse = await verify(newToken ?? '');
  check(
    'verification link completes signup',
    verifyResponse.status === 303 && (verifyResponse.headers.get('location') ?? '').includes('verified=1')
  );
  check('verification response sets Referrer-Policy: no-referrer', verifyResponse.headers.get('referrer-policy') === 'no-referrer');
  check('verification response sets Cache-Control: no-store', verifyResponse.headers.get('cache-control') === 'no-store');
  const createdUser = await userDoc(newEmail);
  check(
    'verified user created with credentialsVerifiedAt and emailVerified',
    Boolean(createdUser?.passwordHash && createdUser?.credentialsVerifiedAt && createdUser?.emailVerified)
  );
  check('new user gets role=customer by default', createdUser?.role === 'customer');
  check('pending record removed after verification', (await PendingSignup.countDocuments({ email: newEmail })) === 0);
  const signedIn = await authorize(newEmail, 'new-customer-pw-1');
  check('password sign-in succeeds after verification with delivery enabled', signedIn?.id === createdUser?._id.toString());
  check('wrong password still rejected', (await authorize(newEmail, 'wrong-password-1')) === null);

  out('\n--- Test 2: duplicate signup does not reveal account existence ---');
  const freshEmail = uniqueEmail('fresh');
  const freshResponse = await signup({ name: 'Fresh', email: freshEmail, password: 'fresh-password-1' });
  const freshBody = await freshResponse.json();
  const hashBefore = (await userDoc(newEmail))?.passwordHash;
  const outboxBefore = outbox.length;
  const duplicateResponse = await signup({ name: 'Intruder', email: newEmail, password: 'intruder-password-1' });
  const duplicateBody = await duplicateResponse.json();
  check(
    'existing-account signup returns the same status and body as a fresh email',
    duplicateResponse.status === freshResponse.status && JSON.stringify(duplicateBody) === JSON.stringify(freshBody),
    `${duplicateResponse.status} ${JSON.stringify(duplicateBody)} vs ${freshResponse.status} ${JSON.stringify(freshBody)}`
  );
  check('response body matches the first signup response too', JSON.stringify(duplicateBody) === JSON.stringify(newSignupBody));
  check('same side effect: an email is sent in both cases', outbox.length === outboxBefore + 1);
  check('existing password hash unchanged by duplicate signup', (await userDoc(newEmail))?.passwordHash === hashBefore);
  const duplicateToken = extractToken(outbox[outbox.length - 1].html);
  if (duplicateToken) tokensSeen.push(duplicateToken);
  await verify(duplicateToken ?? '');
  check('even a verified duplicate cannot replace an existing verified password', (await userDoc(newEmail))?.passwordHash === hashBefore);
  check('intruder password cannot sign in', (await authorize(newEmail, 'intruder-password-1')) === null);

  const cooldownBefore = outbox.length;
  const pendingBefore = await db.collection('pendingsignups').findOne({ email: freshEmail });
  const cooldownResponse = await signup({ name: 'Fresh', email: freshEmail, password: 'fresh-password-2' });
  const cooldownBody = await cooldownResponse.json();
  const pendingAfter = await db.collection('pendingsignups').findOne({ email: freshEmail });
  check('repeat signup inside cooldown gives the same response', cooldownResponse.status === 202 && JSON.stringify(cooldownBody) === JSON.stringify(freshBody));
  check('repeat signup inside cooldown sends no extra email', outbox.length === cooldownBefore);
  check('repeat signup inside cooldown does not rotate the token', pendingAfter?.tokenHash === pendingBefore?.tokenHash);

  out('\n--- Test 3: signup with an existing Google user email cannot attach a password ---');
  const googleEmail = uniqueEmail('google');
  const googleUserId = new mongoose.Types.ObjectId();
  await db.collection('users').insertOne({ _id: googleUserId, name: 'Google Bride', email: googleEmail, emailVerified: null, image: null });
  await db.collection('accounts').insertOne({
    userId: googleUserId,
    type: 'oauth',
    provider: 'google',
    providerAccountId: 'google-sub-test-1',
  });
  const googleBefore = JSON.stringify(await userDoc(googleEmail));
  const attackResponse = await signup({ name: 'Attacker', email: googleEmail, password: 'attacker-password-1' }, attackerBrowser);
  const attackBody = await attackResponse.json();
  check('attack signup gets the generic response', attackResponse.status === 202 && JSON.stringify(attackBody) === JSON.stringify(freshBody));
  check('Google user document is byte-identical after attack signup', JSON.stringify(await userDoc(googleEmail)) === googleBefore);
  check('attacker password cannot sign in', (await authorize(googleEmail, 'attacker-password-1')) === null);
  const guessed = await verify(randomBytes(32).toString('hex'), attackerBrowser);
  check('attacker cannot complete verification without the emailed token', (guessed.headers.get('location') ?? '').includes('verification=failed'));
  check('Google user still has no password after failed guess', !(await userDoc(googleEmail))?.passwordHash);
  check('verification email went only to the Google account address', outbox[outbox.length - 1].to === googleEmail);

  out('\n--- Pre-hijacking: an attacker-initiated link clicked by the real owner links nothing ---');
  const hijackToken = extractToken(outbox[outbox.length - 1].html)!;
  tokensSeen.push(hijackToken);
  const victimClick = await verify(hijackToken, ownerBrowser);
  check('owner clicking the attacker-initiated link in their own browser fails', (victimClick.headers.get('location') ?? '').includes('verification=failed'));
  const noCookieClick = await verify(hijackToken, null);
  check('clicking with no initiator cookie fails', (noCookieClick.headers.get('location') ?? '').includes('verification=failed'));
  check('Google user unchanged after the owner clicked the attacker link', JSON.stringify(await userDoc(googleEmail)) === googleBefore);
  check('attacker password still cannot sign in', (await authorize(googleEmail, 'attacker-password-1')) === null);
  check('mismatched-browser clicks do not consume the token', (await PendingSignup.countDocuments({ tokenHash: sha256(hijackToken) })) === 1);

  const rotationEmail = uniqueEmail('rotation');
  await signup({ name: 'Owner', email: rotationEmail, password: 'rotation-owner-1' });
  const ownerOriginalToken = extractToken(outbox[outbox.length - 1].html)!;
  tokensSeen.push(ownerOriginalToken);
  await db.collection('pendingsignups').updateOne({ email: rotationEmail }, { $set: { issuedAt: new Date(0) } });
  await signup({ name: 'Attacker', email: rotationEmail, password: 'rotation-attacker-1' }, attackerBrowser);
  const rotatedToken = extractToken(outbox[outbox.length - 1].html)!;
  tokensSeen.push(rotatedToken);
  const clickRotated = await verify(rotatedToken, ownerBrowser);
  const clickOriginal = await verify(ownerOriginalToken, ownerBrowser);
  check('owner clicking the attacker-rotated link fails', (clickRotated.headers.get('location') ?? '').includes('verification=failed'));
  check('owner original link is invalidated by rotation (denial only, no takeover)', (clickOriginal.headers.get('location') ?? '').includes('verification=failed'));
  check('no account was created with the attacker password', (await userDoc(rotationEmail)) === null);

  const freshBrowserResponse = await signupRoute.POST(
    jsonRequest(`${BASE}/api/auth/signup`, 'POST', { name: 'Cookie', email: uniqueEmail('cookie'), password: 'cookie-password-1' })
  );
  const issuedInitiator = initiatorFromSetCookie(freshBrowserResponse);
  const cookieHeader = freshBrowserResponse.headers.get('set-cookie') ?? '';
  check('signup issues an initiator cookie when the browser has none', Boolean(issuedInitiator));
  check('initiator cookie is HttpOnly', /HttpOnly/i.test(cookieHeader));
  check('initiator cookie is SameSite=Lax', /SameSite=lax/i.test(cookieHeader));
  check('initiator cookie is scoped to /api/auth', /Path=\/api\/auth/i.test(cookieHeader));
  const reuseResponse = await signup({ name: 'Cookie', email: uniqueEmail('cookie'), password: 'cookie-password-1' }, issuedInitiator ?? newBrowser());
  check('an existing initiator cookie is reused, not rotated', initiatorFromSetCookie(reuseResponse) === issuedInitiator);
  const storedInitiators = JSON.stringify(await db.collection('pendingsignups').find({}).toArray());
  check('raw initiator value is never persisted', Boolean(issuedInitiator) && !storedInitiators.includes(issuedInitiator!));

  const ownerSignup = await signup({ name: 'Google Bride', email: googleEmail, password: 'owner-password-1' });
  check('owner signup within cooldown is accepted generically', ownerSignup.status === 202);
  await db.collection('pendingsignups').updateOne({ email: googleEmail }, { $set: { issuedAt: new Date(0) } });
  await signup({ name: 'Google Bride', email: googleEmail, password: 'owner-password-1' });
  const ownerToken = extractToken(outbox[outbox.length - 1].html);
  if (ownerToken) tokensSeen.push(ownerToken);
  const ownerVerify = await verify(ownerToken ?? '');
  const linkedUser = await userDoc(googleEmail);
  check('mailbox owner can link a password after verification', (ownerVerify.headers.get('location') ?? '').includes('verified=1') && Boolean(linkedUser?.credentialsVerifiedAt));
  check('linking keeps the same user _id', linkedUser?._id.toString() === googleUserId.toString());
  check('linking leaves the Google account link intact', (await db.collection('accounts').countDocuments({ userId: googleUserId, provider: 'google' })) === 1);
  check('linking does not grant a role', linkedUser?.role === undefined);
  check('earlier attacker password still rejected', (await authorize(googleEmail, 'attacker-password-1')) === null);
  check('owner password works', (await authorize(googleEmail, 'owner-password-1')) !== null);

  const legacyEmail = uniqueEmail('legacy-hash');
  await db.collection('users').insertOne({
    email: legacyEmail,
    name: 'Legacy Hash',
    passwordHash: await bcrypt.hash('planted-by-attacker', 4),
  });
  check('a legacy unverified password hash cannot sign in', (await authorize(legacyEmail, 'planted-by-attacker')) === null);
  await signup({ name: 'Legacy Owner', email: legacyEmail, password: 'legacy-owner-pw-1' });
  const legacyToken = extractToken(outbox[outbox.length - 1].html);
  if (legacyToken) tokensSeen.push(legacyToken);
  await verify(legacyToken ?? '');
  check('verified owner replaces a legacy unverified hash', (await authorize(legacyEmail, 'legacy-owner-pw-1')) !== null);
  check('planted password no longer works', (await authorize(legacyEmail, 'planted-by-attacker')) === null);

  out('\n--- Test 4: invalid, expired, replayed and concurrent tokens ---');
  check('random well-formed token is invalid', (await complete(randomBytes(32).toString('hex'))) === 'invalid');
  for (const malformed of ['', 'abc', 'Z'.repeat(64), newToken?.toUpperCase() ?? 'X', ['a'], null]) {
    check(`malformed token rejected (${JSON.stringify(malformed)?.slice(0, 12)})`, (await complete(malformed)) === 'invalid');
  }

  const expiredEmail = uniqueEmail('expired');
  await signup({ name: 'Expired', email: expiredEmail, password: 'expired-password-1' });
  const expiredToken = extractToken(outbox[outbox.length - 1].html);
  if (expiredToken) tokensSeen.push(expiredToken);
  await db.collection('pendingsignups').updateOne({ email: expiredEmail }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const expiredVerify = await verify(expiredToken ?? '');
  check('expired token fails', (expiredVerify.headers.get('location') ?? '').includes('verification=failed'));
  check('expired token creates no user', (await userDoc(expiredEmail)) === null);

  const replayEmail = uniqueEmail('replay');
  await signup({ name: 'Replay', email: replayEmail, password: 'replay-password-1' });
  const replayToken = extractToken(outbox[outbox.length - 1].html)!;
  tokensSeen.push(replayToken);
  check('first use succeeds', (await complete(replayToken)) === 'verified');
  check('replayed token fails', (await complete(replayToken)) === 'invalid');
  check('replay creates no duplicate user', (await db.collection('users').countDocuments({ email: replayEmail })) === 1);

  const raceEmail = uniqueEmail('race');
  await signup({ name: 'Race', email: raceEmail, password: 'race-password-1' });
  const raceToken = extractToken(outbox[outbox.length - 1].html)!;
  tokensSeen.push(raceToken);
  const raceOutcomes = await Promise.all(Array.from({ length: 12 }, () => complete(raceToken)));
  check('12 concurrent uses: exactly one succeeds', raceOutcomes.filter((o) => o === 'verified').length === 1, raceOutcomes.join(','));
  check('concurrent use creates exactly one user', (await db.collection('users').countDocuments({ email: raceEmail })) === 1);

  const routeRaceEmail = uniqueEmail('route-race');
  await signup({ name: 'Route Race', email: routeRaceEmail, password: 'route-race-pw-1' });
  const routeRaceToken = extractToken(outbox[outbox.length - 1].html)!;
  tokensSeen.push(routeRaceToken);
  const routeOutcomes = await Promise.all(Array.from({ length: 8 }, () => verify(routeRaceToken)));
  const routeSuccesses = routeOutcomes.filter((r) => (r.headers.get('location') ?? '').includes('verified=1')).length;
  check('8 concurrent route verifications: exactly one succeeds', routeSuccesses === 1, `got ${routeSuccesses}`);

  const burstEmail = uniqueEmail('burst');
  const burstOutboxStart = outbox.length;
  const burst = await Promise.all(
    Array.from({ length: 5 }, () => signup({ name: 'Burst', email: burstEmail, password: 'burst-password-1' }))
  );
  check('concurrent signups all get the generic 202', burst.every((r) => r.status === 202), burst.map((r) => r.status).join(','));
  check('concurrent signups leave exactly one pending record', (await PendingSignup.countDocuments({ email: burstEmail })) === 1);
  const burstTokens = outbox.slice(burstOutboxStart).filter((m) => m.to === burstEmail).map((m) => extractToken(m.html)!);
  tokensSeen.push(...burstTokens);
  let burstVerified = 0;
  for (const token of burstTokens) if ((await complete(token)) === 'verified') burstVerified++;
  check('of the emailed burst tokens, exactly one is valid', burstVerified === 1, `${burstVerified} of ${burstTokens.length}`);

  transportFails = true;
  const failEmail = uniqueEmail('mail-fail');
  const failResponse = await signup({ name: 'Mail Fail', email: failEmail, password: 'mail-fail-pw-1' });
  transportFails = false;
  check('provider failure returns 503', failResponse.status === 503);
  check('provider failure leaves no pending record behind', (await PendingSignup.countDocuments({ email: failEmail })) === 0);

  out('\n--- Test 6 (enabled path): reset is single-use and race-safe ---');
  const resetBefore = outbox.length;
  const knownForgot = await forgot(newEmail);
  const knownForgotBody = await knownForgot.json();
  const unknownForgot = await forgot(uniqueEmail('nobody'));
  const unknownForgotBody = await unknownForgot.json();
  check('forgot-password responses identical for known and unknown emails', knownForgot.status === unknownForgot.status && JSON.stringify(knownForgotBody) === JSON.stringify(unknownForgotBody));
  check('reset email only sent for the existing account', outbox.length === resetBefore + 1 && outbox[outbox.length - 1].to === newEmail);
  const resetToken = extractToken(outbox[outbox.length - 1].html)!;
  tokensSeen.push(resetToken);
  check('reset link uses the configured app URL', outbox[outbox.length - 1].html.includes('http://localhost:3999/auth/reset-password?token='));
  check('reset token stored only as a hash', (await userDoc(newEmail))?.resetPasswordTokenHash === sha256(resetToken));
  const firstReset = await reset(resetToken, 'reset-password-1');
  check('first reset succeeds', firstReset.status === 200);
  check('replayed reset fails', (await reset(resetToken, 'reset-password-2')).status === 400);
  check('reset password works for sign-in', (await authorize(newEmail, 'reset-password-1')) !== null);

  await forgot(newEmail);
  const raceResetToken = extractToken(outbox[outbox.length - 1].html)!;
  tokensSeen.push(raceResetToken);
  const resetRace = await Promise.all(Array.from({ length: 6 }, (_, i) => reset(raceResetToken, `race-reset-pw-${i}`)));
  check('6 concurrent resets with one token: exactly one succeeds', resetRace.filter((r) => r.status === 200).length === 1, resetRace.map((r) => r.status).join(','));
  check('malformed reset token rejected', (await reset('not-a-token', 'whatever-123')).status === 400);

  out('\n--- Token leakage ---');
  const logText = logged.join('\n');
  check(`none of ${tokensSeen.length} issued tokens appear in any log output`, tokensSeen.length > 0 && tokensSeen.every((t) => !logText.includes(t)));
  check('no reset or verification URL appears in log output', !/reset-password\?token=|verify-email\?token=/.test(logText));

  out('\n--- Admin authorization helper (tests 8, 10, 11, 12) ---');
  const adminId = new mongoose.Types.ObjectId();
  const adminNoGoogleId = new mongoose.Types.ObjectId();
  const emailMatchId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const passwordAdminId = new mongoose.Types.ObjectId();
  await db.collection('users').insertMany([
    { _id: adminId, email: 'real-admin@admin.example.test', role: 'admin', emailVerified: null },
    { _id: adminNoGoogleId, email: 'no-google@admin.example.test', role: 'admin' },
    { _id: emailMatchId, email: TEST_ADMIN_EMAIL, role: 'customer', emailVerified: null },
    { _id: customerId, email: uniqueEmail('plain'), emailVerified: null },
    {
      _id: passwordAdminId,
      email: 'password-admin@admin.example.test',
      role: 'admin',
      passwordHash: await bcrypt.hash('password-admin-1', 4),
      credentialsVerifiedAt: new Date(),
    },
  ]);
  await db.collection('accounts').insertMany([
    { userId: adminId, type: 'oauth', provider: 'google', providerAccountId: 'g-admin' },
    { userId: emailMatchId, type: 'oauth', provider: 'google', providerAccountId: 'g-email-match' },
    { userId: customerId, type: 'oauth', provider: 'google', providerAccountId: 'g-customer' },
  ]);

  check('role=admin + linked Google + Google session → admin', await admin.isAuthorizedAdmin(adminId.toString(), 'google'));
  check('test 8: email equal to ADMIN_EMAIL with role=customer → no admin', !(await admin.isAuthorizedAdmin(emailMatchId.toString(), 'google')));
  check('missing role field → no admin', !(await admin.isAuthorizedAdmin(customerId.toString(), 'google')));
  check('role=admin authenticated by password → no admin', !(await admin.isAuthorizedAdmin(adminId.toString(), 'credentials')));
  check('role=admin with session lacking provider claim → no admin', !(await admin.isAuthorizedAdmin(adminId.toString(), undefined)));
  check('role=admin without a linked Google account → no admin', !(await admin.isAuthorizedAdmin(adminNoGoogleId.toString(), 'google')));
  check('password-only role=admin account → no admin even with forged provider claim', !(await admin.isAuthorizedAdmin(passwordAdminId.toString(), 'google')));
  check('unknown user id → no admin', !(await admin.isAuthorizedAdmin(new mongoose.Types.ObjectId().toString(), 'google')));
  for (const badId of ['', 'abc', 'aaaaaaaaaaaa', `${adminId.toString()}x`, 42, null, { $ne: null }]) {
    check(`invalid user id rejected (${JSON.stringify(badId)})`, !(await admin.isAuthorizedAdmin(badId, 'google')));
  }
  await db.collection('users').updateOne({ _id: adminId }, { $set: { role: 'Admin' } });
  check('role must match exactly ("Admin" rejected)', !(await admin.isAuthorizedAdmin(adminId.toString(), 'google')));
  await db.collection('users').updateOne({ _id: adminId }, { $set: { role: 'customer' } });
  check('test 11: removing the role revokes on the next check', !(await admin.isAuthorizedAdmin(adminId.toString(), 'google')));
  await db.collection('users').updateOne({ _id: adminId }, { $set: { role: 'admin' } });
  check('restoring the role restores access', await admin.isAuthorizedAdmin(adminId.toString(), 'google'));
  await db.collection('accounts').deleteOne({ userId: adminId });
  check('unlinking Google revokes on the next check', !(await admin.isAuthorizedAdmin(adminId.toString(), 'google')));
  await db.collection('accounts').insertOne({ userId: adminId, type: 'oauth', provider: 'google', providerAccountId: 'g-admin' });

  const started = Date.now();
  await mongoose.disconnect();
  const duringOutage = await admin.isAuthorizedAdmin(adminId.toString(), 'google');
  check('test 12: database unavailable → no admin (fails closed)', duringOutage === false, `took ${Date.now() - started}ms`);
}

async function runHttp(baseUrl: string): Promise<void> {
  const base = new URL(baseUrl);
  if (!LOCAL_HOSTS.has(base.hostname)) throw new Error('Refusing to run HTTP tests against a non-local server.');
  const secret = process.env.TEST_NEXTAUTH_SECRET;
  if (!secret) throw new Error('TEST_NEXTAUTH_SECRET must match the test server secret.');

  const { MongoClient, ObjectId } = await import('mongodb');
  const { encode } = await import('next-auth/jwt');
  const bcrypt = (await import('bcryptjs')).default;
  const client = new MongoClient(TEST_URI);
  await client.connect();
  const db = client.db();
  const oid = (hex: string) => new ObjectId(hex);

  await Promise.all(
    ['users', 'accounts', 'vendors', 'services', 'bookings'].map((name) =>
      db.collection(name).deleteMany({
        _id: { $in: Object.values(FIXTURE_IDS).map(oid) },
      })
    )
  );
  await db.collection('accounts').deleteMany({ providerAccountId: /^http-/ });
  await db.collection('users').deleteMany({
    email: {
      $in: [
        'http-admin@admin.example.test',
        'http-customer@customers.example.test',
        TEST_ADMIN_EMAIL,
        'http-nogoogle@admin.example.test',
        'http-password@customers.example.test',
      ],
    },
  });
  await db.collection('users').insertMany([
    { _id: oid(FIXTURE_IDS.httpAdmin), email: 'http-admin@admin.example.test', name: 'HTTP Admin', role: 'admin', emailVerified: null },
    { _id: oid(FIXTURE_IDS.httpCustomer), email: 'http-customer@customers.example.test', name: 'HTTP Customer', emailVerified: null },
    { _id: oid(FIXTURE_IDS.httpEmailMatch), email: TEST_ADMIN_EMAIL, name: 'Email Match', role: 'customer', emailVerified: null },
    { _id: oid(FIXTURE_IDS.httpAdminNoGoogle), email: 'http-nogoogle@admin.example.test', name: 'No Google', role: 'admin' },
    {
      _id: oid(FIXTURE_IDS.httpPasswordUser),
      email: 'http-password@customers.example.test',
      name: 'HTTP Password',
      passwordHash: await bcrypt.hash('http-password-1', 4),
      credentialsVerifiedAt: new Date(),
      emailVerified: new Date(),
    },
  ]);
  await db.collection('accounts').insertMany([
    { userId: oid(FIXTURE_IDS.httpAdmin), type: 'oauth', provider: 'google', providerAccountId: 'http-admin' },
    { userId: oid(FIXTURE_IDS.httpCustomer), type: 'oauth', provider: 'google', providerAccountId: 'http-customer' },
    { userId: oid(FIXTURE_IDS.httpEmailMatch), type: 'oauth', provider: 'google', providerAccountId: 'http-email-match' },
  ]);
  await db.collection('vendors').insertOne({
    _id: oid(FIXTURE_IDS.vendor),
    name: VENDOR_MARKER,
    slug: 'zz-test-vendor',
    tagline: 'test',
    flags: { isActive: false },
    portfolio: [],
    aestheticProfile: { aestheticBio: 'x' },
  });
  await db.collection('services').insertOne({ _id: oid(FIXTURE_IDS.service), vendor: oid(FIXTURE_IDS.vendor), name: 'ZZ Test Service', slug: 'zz-test-service' });
  await db.collection('bookings').insertOne({
    _id: oid(FIXTURE_IDS.booking),
    vendor: oid(FIXTURE_IDS.vendor),
    service: oid(FIXTURE_IDS.service),
    customer: oid(FIXTURE_IDS.httpCustomer),
    date: new Date(Date.UTC(2030, 0, 15)),
    startTime: '10:00',
    endTime: '12:00',
    status: 'PENDING',
    priceSnapshot: { lineItems: [], total: 1000, depositAmount: 300 },
    contactInfo: { name: BOOKING_MARKER, phone: '0000000000', email: 'booking@customers.example.test' },
    idempotencyKey: 'zz-test-idempotency',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const cookieFor = async (claims: Record<string, unknown>, signingSecret = secret) =>
    `next-auth.session-token=${await encode({ token: claims, secret: signingSecret, maxAge: 3600 })}`;
  const claims = (id: string, email: string, authProvider?: string) => ({
    sub: id,
    id,
    email,
    name: 'Fixture',
    ...(authProvider ? { authProvider } : {}),
  });

  const sessions: Record<string, string | null> = {
    anonymous: null,
    customerGoogle: await cookieFor(claims(FIXTURE_IDS.httpCustomer, 'http-customer@customers.example.test', 'google')),
    adminEmailButCustomerRole: await cookieFor(claims(FIXTURE_IDS.httpEmailMatch, TEST_ADMIN_EMAIL, 'google')),
    adminRoleViaPasswordSession: await cookieFor(claims(FIXTURE_IDS.httpAdmin, 'http-admin@admin.example.test', 'credentials')),
    adminRoleLegacySessionWithoutProvider: await cookieFor(claims(FIXTURE_IDS.httpAdmin, 'http-admin@admin.example.test')),
    adminRoleWithoutGoogleLink: await cookieFor(claims(FIXTURE_IDS.httpAdminNoGoogle, 'http-nogoogle@admin.example.test', 'google')),
    forgedWrongSecret: await cookieFor(claims(FIXTURE_IDS.httpAdmin, 'http-admin@admin.example.test', 'google'), randomBytes(32).toString('hex')),
    garbageCookie: 'next-auth.session-token=not-a-jwt',
  };
  const adminCookie = await cookieFor(claims(FIXTURE_IDS.httpAdmin, 'http-admin@admin.example.test', 'google'));

  const call = async (method: string, path: string, cookie: string | null, body?: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(new URL(path, base), {
      method,
      redirect: 'manual',
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, location: response.headers.get('location') ?? '', text: await response.text(), headers: response.headers };
  };

  const v = FIXTURE_IDS.vendor;
  const m = FIXTURE_IDS.missing;
  const apiHandlers: Array<[string, string, unknown?]> = [
    ['GET', '/api/admin/vendors'],
    ['POST', '/api/admin/vendors', {}],
    ['GET', `/api/admin/vendors/${v}`],
    ['PATCH', `/api/admin/vendors/${m}`, {}],
    ['PUT', `/api/admin/vendors/${m}/active`, {}],
    ['GET', `/api/admin/vendors/${m}/availability`],
    ['PUT', `/api/admin/vendors/${m}/availability`, {}],
    ['POST', `/api/admin/vendors/${m}/blocked-dates`, {}],
    ['DELETE', `/api/admin/vendors/${m}/blocked-dates/${m}`],
    ['POST', `/api/admin/vendors/${m}/portfolio`, {}],
    ['DELETE', `/api/admin/vendors/${m}/portfolio`, {}],
    ['GET', `/api/admin/vendors/${v}/services`],
    ['POST', `/api/admin/vendors/${m}/services`, {}],
    ['PATCH', `/api/admin/services/${m}`, {}],
    ['DELETE', `/api/admin/services/${m}`],
    ['PATCH', `/api/bookings/${FIXTURE_IDS.booking}`, { status: 'NOT_A_STATUS' }],
  ];

  const pages: Array<{ path: string; tree: unknown[] }> = [
    { path: '/admin', tree: ['', { children: ['admin', { children: ['__PAGE__', {}] }] }, null, null, true] },
    { path: '/admin/bookings', tree: ['', { children: ['admin', { children: ['bookings', { children: ['__PAGE__', {}] }] }] }, null, null, true] },
    { path: '/admin/vendors', tree: ['', { children: ['admin', { children: ['vendors', { children: ['__PAGE__', {}] }] }] }, null, null, true] },
    {
      path: `/admin/vendors/${v}`,
      tree: ['', { children: ['admin', { children: ['vendors', { children: [['id', v, 'd'], { children: ['__PAGE__', {}] }] }] }] }, null, null, true],
    },
  ];
  const rscHeaders = (path: string, tree: unknown[]) => ({
    RSC: '1',
    'Next-Router-State-Tree': encodeURIComponent(JSON.stringify(tree)),
    'Next-Url': path,
  });
  const leaks = (text: string) => text.includes(BOOKING_MARKER) || text.includes(VENDOR_MARKER) || text.includes('booking@customers.example.test');
  const isRedirectToAuth = (r: { status: number; location: string; text: string }) =>
    ([303, 307, 308].includes(r.status) && ['/auth', '/unauthorized'].includes(new URL(r.location || '/', base).pathname)) ||
    r.text.includes('NEXT_REDIRECT');

  out('\n--- Warm-up: compile routes with the admin session ---');
  for (const page of pages) await call('GET', page.path, adminCookie);
  for (const [method, path, body] of apiHandlers) await call(method, path, adminCookie, body);

  out('\n--- Test 10: Google-authenticated role=admin can use every protected API handler and page ---');
  for (const [method, path, body] of apiHandlers) {
    const r = await call(method, path, adminCookie, body);
    check(`admin ${method} ${path} authorized`, r.status !== 401 && r.status !== 403 && r.status < 500, `got ${r.status}`);
  }
  for (const page of pages) {
    const direct = await call('GET', page.path, adminCookie);
    check(`admin direct GET ${page.path} renders`, direct.status === 200, `got ${direct.status}`);
    const rsc = await call('GET', page.path, adminCookie, undefined, rscHeaders(page.path, page.tree));
    check(`admin RSC GET ${page.path} renders`, rsc.status === 200 && !rsc.text.includes('NEXT_REDIRECT'), `got ${rsc.status}`);
  }
  const adminBookings = await call('GET', '/admin/bookings', adminCookie, undefined, rscHeaders('/admin/bookings', pages[1].tree));
  check('positive control: admin RSC payload contains the private booking marker', adminBookings.text.includes(BOOKING_MARKER));
  const adminVendors = await call('GET', '/admin/vendors', adminCookie);
  check('positive control: admin vendors page contains the vendor marker', adminVendors.text.includes(VENDOR_MARKER));

  out('\n--- Tests 8, 9: non-admin sessions are rejected on every API handler and page (direct + RSC) ---');
  for (const [label, cookie] of Object.entries(sessions)) {
    let apiOk = 0;
    const apiFailures: string[] = [];
    for (const [method, path, body] of apiHandlers) {
      const r = await call(method, path, cookie, body);
      if (r.status === 403 && !leaks(r.text)) apiOk++;
      else apiFailures.push(`${method} ${path}=${r.status}`);
    }
    check(`${label}: 403 on all ${apiHandlers.length} admin API handlers`, apiOk === apiHandlers.length, apiFailures.join('; '));
    for (const page of pages) {
      const direct = await call('GET', page.path, cookie);
      check(`${label}: direct GET ${page.path} redirected, no data`, isRedirectToAuth(direct) && !leaks(direct.text), `got ${direct.status}`);
      const rsc = await call('GET', page.path, cookie, undefined, rscHeaders(page.path, page.tree));
      check(`${label}: RSC GET ${page.path} (layout claimed mounted) redirected, no data`, isRedirectToAuth(rsc) && !leaks(rsc.text), `got ${rsc.status}`);
    }
  }

  out('\n--- Test 11: revoking the role takes effect on the next request ---');
  await db.collection('users').updateOne({ _id: oid(FIXTURE_IDS.httpAdmin) }, { $set: { role: 'customer' } });
  const revokedApi = await call('GET', '/api/admin/vendors', adminCookie);
  const revokedPage = await call('GET', '/admin/bookings', adminCookie, undefined, rscHeaders('/admin/bookings', pages[1].tree));
  check('revoked admin gets 403 from the API immediately', revokedApi.status === 403, `got ${revokedApi.status}`);
  check('revoked admin RSC request gets no booking data', isRedirectToAuth(revokedPage) && !leaks(revokedPage.text));
  await db.collection('users').updateOne({ _id: oid(FIXTURE_IDS.httpAdmin) }, { $unset: { role: 1 } });
  check('admin with role field removed gets 403', (await call('GET', '/api/admin/vendors', adminCookie)).status === 403);
  await db.collection('users').updateOne({ _id: oid(FIXTURE_IDS.httpAdmin) }, { $set: { role: 'admin' } });
  check('restored admin regains access', (await call('GET', '/api/admin/vendors', adminCookie)).status === 200);

  out('\n--- Test 13: existing sessions ---');
  const legacyCustomer = await cookieFor(claims(FIXTURE_IDS.httpCustomer, 'http-customer@customers.example.test'));
  const legacyJourney = await call('GET', '/journey', legacyCustomer);
  check('pre-change customer session (no provider claim) still opens /journey', legacyJourney.status === 200, `got ${legacyJourney.status} ${legacyJourney.location}`);
  const legacySession = await call('GET', '/api/auth/session', legacyCustomer);
  check('pre-change customer session still resolves via /api/auth/session', legacySession.text.includes('http-customer@customers.example.test'));
  const googleJourney = await call('GET', '/journey', sessions.customerGoogle);
  check('current Google customer session opens /journey', googleJourney.status === 200, `got ${googleJourney.status}`);
  const legacyAdmin = await call('GET', '/api/admin/vendors', sessions.adminRoleLegacySessionWithoutProvider);
  check('pre-change admin session needs one fresh Google sign-in (403 until then)', legacyAdmin.status === 403);

  out('\n--- Test 7: Google sign-in remains configured ---');
  const providers = await call('GET', '/api/auth/providers', null);
  check('/api/auth/providers still lists google', providers.text.includes('"google"'));
  const csrfForGoogle = await fetch(new URL('/api/auth/csrf', base));
  const csrfCookie = (csrfForGoogle.headers.get('set-cookie') ?? '').split(';')[0];
  const { csrfToken } = (await csrfForGoogle.json()) as { csrfToken: string };
  const googleStart = await fetch(new URL('/api/auth/signin/google', base), {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: csrfCookie },
    body: new URLSearchParams({ csrfToken, callbackUrl: `${base.origin}/journey`, json: 'true' }).toString(),
  });
  const googleStartBody = await googleStart.text();
  check('Google OAuth initiation still redirects to accounts.google.com', googleStartBody.includes('accounts.google.com') || (googleStart.headers.get('location') ?? '').includes('accounts.google.com'));

  out('\n--- Tests 5, 6 over HTTP: password auth disabled on the server ---');
  const csrfForPassword = await fetch(new URL('/api/auth/csrf', base));
  const passwordCsrfCookie = (csrfForPassword.headers.get('set-cookie') ?? '').split(';')[0];
  const { csrfToken: passwordCsrf } = (await csrfForPassword.json()) as { csrfToken: string };
  const passwordSignIn = await fetch(new URL('/api/auth/callback/credentials', base), {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: passwordCsrfCookie },
    body: new URLSearchParams({ csrfToken: passwordCsrf, email: 'http-password@customers.example.test', password: 'http-password-1', json: 'true' }).toString(),
  });
  const setCookie = passwordSignIn.headers.get('set-cookie') ?? '';
  check('verified password user cannot sign in while delivery is disabled', !setCookie.includes('next-auth.session-token='), `status ${passwordSignIn.status}`);
  const httpSignup = await call('POST', '/api/auth/signup', null, { name: 'HTTP', email: 'http-signup@customers.example.test', password: 'http-signup-1' });
  check('HTTP signup returns 503 with a user-facing message', httpSignup.status === 503 && httpSignup.text.includes('continue with Google'));
  check('HTTP signup created no user', (await db.collection('users').countDocuments({ email: 'http-signup@customers.example.test' })) === 0);
  check('HTTP forgot-password returns 503', (await call('POST', '/api/auth/forgot-password', null, { email: 'http-password@customers.example.test' })).status === 503);
  check('HTTP reset-password returns 503', (await call('POST', '/api/auth/reset-password', null, { token: 'a'.repeat(64), password: 'whatever-123' })).status === 503);

  await client.close();
}

async function runHttpDatabaseOutage(baseUrl: string): Promise<void> {
  const base = new URL(baseUrl);
  if (!LOCAL_HOSTS.has(base.hostname)) throw new Error('Refusing to run HTTP tests against a non-local server.');
  const secret = process.env.TEST_NEXTAUTH_SECRET;
  if (!secret) throw new Error('TEST_NEXTAUTH_SECRET must match the test server secret.');
  const { encode } = await import('next-auth/jwt');
  const cookie = `next-auth.session-token=${await encode({
    token: { sub: FIXTURE_IDS.httpAdmin, id: FIXTURE_IDS.httpAdmin, email: 'http-admin@admin.example.test', authProvider: 'google' },
    secret,
    maxAge: 3600,
  })}`;
  out('\n--- Test 12 over HTTP: database unavailable ---');
  const started = Date.now();
  const api = await fetch(new URL('/api/admin/vendors', base), { headers: { cookie }, redirect: 'manual', signal: AbortSignal.timeout(120000) });
  check('admin API fails closed with 403 while the database is down', api.status === 403, `got ${api.status} after ${Date.now() - started}ms`);
  const page = await fetch(new URL('/admin/bookings', base), { headers: { cookie }, redirect: 'manual', signal: AbortSignal.timeout(120000) });
  const pageText = await page.text();
  check('admin page does not render while the database is down', page.status !== 200 && !pageText.includes(BOOKING_MARKER), `got ${page.status}`);
}

async function main() {
  const phase = process.env.TEST_PHASE ?? 'all';
  const baseUrl = process.env.TEST_BASE_URL;
  if (phase === 'all' || phase === 'inprocess') await runInProcess();
  if ((phase === 'all' || phase === 'http') && baseUrl) await runHttp(baseUrl);
  if (phase === 'http-db-outage' && baseUrl) await runHttpDatabaseOutage(baseUrl);
  out(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test script failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});

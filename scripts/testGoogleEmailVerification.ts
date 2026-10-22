import { readFileSync } from 'fs';
import type { Account, Profile } from 'next-auth';

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

const SUB = '104857600000000000001';
const googleAccount = (providerAccountId = SUB): Account => ({
  provider: 'google',
  type: 'oauth',
  providerAccountId,
});
const credentialsAccount: Account = { provider: 'credentials', type: 'credentials', providerAccountId: 'x' };
const claims = (overrides: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  sub: SUB,
  email: 'bride@customers.example.test',
  email_verified: true,
  name: 'Test Bride',
  ...overrides,
});

async function main() {
  const { hasVerifiedGoogleEmail, verifyOAuthSignIn } = await import('../src/lib/auth/googleProfile');
  const signIn = (account: Account | null, profile: unknown) =>
    verifyOAuthSignIn({ account, profile: profile as Profile | undefined });

  console.log('--- Verified Google identity ---');
  check('email_verified === true with email and matching sub is allowed', (await signIn(googleAccount(), claims())) === true);

  console.log('\n--- Unverified Google identity ---');
  check('email_verified === false is rejected', (await signIn(googleAccount(), claims({ email_verified: false }))) === false);

  console.log('\n--- Missing verification claim ---');
  const { email_verified: _omitted, ...withoutClaim } = claims();
  check('missing email_verified is rejected', (await signIn(googleAccount(), withoutClaim)) === false);
  check('email_verified: undefined is rejected', (await signIn(googleAccount(), claims({ email_verified: undefined }))) === false);
  check('email_verified: null is rejected', (await signIn(googleAccount(), claims({ email_verified: null }))) === false);
  check('missing profile is rejected', (await signIn(googleAccount(), undefined)) === false);

  console.log('\n--- Malformed verification claim ---');
  for (const malformed of ['true', 'TRUE', 1, 'yes', {}, [true], new Boolean(true)]) {
    check(
      `email_verified ${JSON.stringify(malformed) ?? String(malformed)} (${typeof malformed}) is rejected`,
      (await signIn(googleAccount(), claims({ email_verified: malformed }))) === false
    );
  }
  const inherited = Object.create({ email_verified: true });
  Object.assign(inherited, { sub: SUB, email: 'bride@customers.example.test' });
  check('inherited (non-own) email_verified is rejected', (await signIn(googleAccount(), inherited)) === false);
  for (const badProfile of [null, 'profile', 42, [claims()]]) {
    check(`non-object profile ${JSON.stringify(badProfile)?.slice(0, 20)} is rejected`, (await signIn(googleAccount(), badProfile)) === false);
  }

  console.log('\n--- Malformed identity claims ---');
  check('missing email is rejected', (await signIn(googleAccount(), claims({ email: undefined }))) === false);
  check('empty email is rejected', (await signIn(googleAccount(), claims({ email: '' }))) === false);
  check('non-string email is rejected', (await signIn(googleAccount(), claims({ email: ['a@b.test'] }))) === false);
  check('email without @ is rejected', (await signIn(googleAccount(), claims({ email: 'not-an-email' }))) === false);
  check('missing sub is rejected', (await signIn(googleAccount(), claims({ sub: undefined }))) === false);
  check('empty sub is rejected', (await signIn(googleAccount(''), claims({ sub: '' }))) === false);
  check('sub that differs from account.providerAccountId is rejected', (await signIn(googleAccount('999'), claims())) === false);

  console.log('\n--- Other providers ---');
  check('null account is rejected', (await signIn(null, claims())) === false);
  check('credentials provider is unaffected (authorize enforces its own policy)', (await signIn(credentialsAccount, undefined)) === true);
  check('unknown provider is rejected', (await signIn({ provider: 'github', type: 'oauth', providerAccountId: SUB }, claims())) === false);

  console.log('\n--- Predicate directly ---');
  check('hasVerifiedGoogleEmail accepts verified claims', hasVerifiedGoogleEmail(claims()));
  check('hasVerifiedGoogleEmail rejects unverified claims', !hasVerifiedGoogleEmail(claims({ email_verified: false })));

  console.log('\n--- Static wiring checks (no execution of NextAuth or the database) ---');
  const authSource = readFileSync('src/lib/auth.ts', 'utf8');
  check('authOptions.callbacks.signIn is verifyOAuthSignIn', /callbacks:\s*\{\s*signIn:\s*verifyOAuthSignIn,/.test(authSource));
  check('verifyOAuthSignIn is imported from the tested module', authSource.includes("import { verifyOAuthSignIn } from '@/lib/auth/googleProfile';"));
  check('dangerous email account linking is not enabled in authOptions', !authSource.includes('allowDangerousEmailAccountLinking'));

  const callbackRoute = readFileSync('node_modules/next-auth/core/routes/callback.js', 'utf8');
  const oauthBranch = callbackRoute.slice(callbackRoute.indexOf('if (provider.type === "oauth")'), callbackRoute.indexOf('} else if (provider.type === "email")'));
  const signInAt = oauthBranch.indexOf('callbacks.signIn({');
  const handlerAt = oauthBranch.indexOf('_callbackHandler.default)(');
  check('installed NextAuth passes the raw OAuthProfile to signIn', /callbacks\.signIn\(\{\s*user: userOrProfile,\s*account,\s*profile: OAuthProfile\s*\}\)/.test(oauthBranch));
  check('installed NextAuth calls signIn before creating or linking the user', signInAt > -1 && handlerAt > -1 && signInAt < handlerAt);
  check('installed NextAuth aborts with AccessDenied when signIn returns false', /if \(!isAllowed\) \{\s*return \{\s*redirect: `\$\{url\}\/error\?error=AccessDenied`/.test(oauthBranch));

  const oauthCallback = readFileSync('node_modules/next-auth/core/lib/oauth/callback.js', 'utf8');
  check('installed NextAuth uses ID-token claims as the raw profile when idToken is set', /else if \(provider\.idToken\) \{\s*profile = tokens\.claims\(\);/.test(oauthCallback));
  const googleProvider = readFileSync('node_modules/next-auth/providers/google.js', 'utf8');
  check('installed Google provider sets idToken: true', /idToken: true/.test(googleProvider));
  check('installed Google provider maps account id from sub', /id: profile\.sub/.test(googleProvider));

  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test script failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});

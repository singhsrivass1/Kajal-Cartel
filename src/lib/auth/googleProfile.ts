import type { Account, Profile } from 'next-auth';

function ownClaim(claims: Record<string, unknown>, name: string): unknown {
  return Object.prototype.hasOwnProperty.call(claims, name) ? claims[name] : undefined;
}

export function hasVerifiedGoogleEmail(profile: unknown): boolean {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false;
  const claims = profile as Record<string, unknown>;

  if (ownClaim(claims, 'email_verified') !== true) return false;

  const email = ownClaim(claims, 'email');
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(email)) return false;

  const sub = ownClaim(claims, 'sub');
  return typeof sub === 'string' && sub.length > 0;
}

export async function verifyOAuthSignIn({
  account,
  profile,
}: {
  account: Account | null;
  profile?: Profile;
}): Promise<boolean> {
  if (!account) return false;
  if (account.provider === 'credentials') return true;
  if (account.provider !== 'google') return false;

  if (!hasVerifiedGoogleEmail(profile)) return false;
  return (profile as Record<string, unknown>).sub === account.providerAccountId;
}

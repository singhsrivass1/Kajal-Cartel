import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAuthorizedAdmin } from '@/lib/auth/admin';
import { getArtistContext } from '@/lib/auth/artist';
import type { ArtistContext } from '@/lib/auth/artist';

function signInPath(callbackPath: string): string {
  return `/auth?callbackUrl=${encodeURIComponent(callbackPath)}`;
}

export async function requireAdminPage(callbackPath: string): Promise<Session> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: unknown; authProvider?: unknown } | undefined;
  if (!session || !user) redirect(signInPath(callbackPath));
  if (!(await isAuthorizedAdmin(user.id, user.authProvider))) redirect('/unauthorized?area=admin');
  return session;
}

export async function requireArtistPage(callbackPath: string): Promise<{ session: Session; artist: ArtistContext }> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: unknown } | undefined;
  if (!session || !user) redirect(signInPath(callbackPath));
  const artist = await getArtistContext(user.id);
  if (!artist) redirect('/unauthorized?area=artist');
  return { session, artist };
}

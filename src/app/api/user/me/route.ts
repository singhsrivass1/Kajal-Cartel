import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAuthorizedAdmin } from '@/lib/auth/admin';
import { getArtistContext } from '@/lib/auth/artist';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: unknown; name?: string | null; email?: string | null; image?: string | null; authProvider?: unknown } | undefined;
  if (!session || !user || typeof user.id !== 'string') {
    return NextResponse.json({ signedIn: false }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }

  const [isAdmin, artist] = await Promise.all([isAuthorizedAdmin(user.id, user.authProvider), getArtistContext(user.id)]);

  return NextResponse.json(
    {
      signedIn: true,
      name: user.name ?? '',
      email: user.email ?? '',
      image: user.image ?? null,
      isAdmin,
      isArtist: Boolean(artist),
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}

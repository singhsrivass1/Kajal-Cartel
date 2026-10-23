import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { Types } from 'mongoose';
import { authOptions } from '@/lib/auth';
import { dbConnect } from '@/lib/db/connect';
import User from '@/lib/db/models/User';
import Vendor from '@/lib/db/models/Vendor';

export interface ArtistContext {
  userId: string;
  vendorId: string;
  vendorSlug: string;
  vendorName: string;
}

export async function getArtistContext(userId: unknown): Promise<ArtistContext | null> {
  if (typeof userId !== 'string' || !Types.ObjectId.isValid(userId)) return null;
  try {
    await dbConnect();
    const user = await User.findById(new Types.ObjectId(userId))
      .select('role artistVendor')
      .lean<{ role?: unknown; artistVendor?: Types.ObjectId }>();
    if (!user || user.role !== 'artist' || !user.artistVendor) return null;
    const vendor = await Vendor.findById(user.artistVendor).select('slug name').lean<{ _id: Types.ObjectId; slug: string; name: string }>();
    if (!vendor) return null;
    return { userId, vendorId: vendor._id.toString(), vendorSlug: vendor.slug, vendorName: vendor.name };
  } catch (err) {
    console.error('[artist-auth] Authorization lookup failed:', err instanceof Error ? err.name : 'unknown error');
    return null;
  }
}

export async function getArtistSession(): Promise<{ session: Session; artist: ArtistContext } | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: unknown } | undefined)?.id;
  if (!session?.user) return null;
  const artist = await getArtistContext(id);
  return artist ? { session, artist } : null;
}

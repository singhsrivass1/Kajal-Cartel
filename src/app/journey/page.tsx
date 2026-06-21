import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { dbConnect } from '@/lib/db/connect';
import User from '@/lib/db/models/User';
import Vendor from '@/lib/db/models/Vendor';
import { JourneyClient } from './_components/JourneyClient';
import type { IUser, MatchHistoryEntry } from '@/lib/db/models/User';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Bridal Journey — Kajal Cartel',
  description: 'Your saved artists, style matches, and booking history.',
};

interface SerializedVendor {
  slug: string;
  name: string;
  tagline: string;
  profileImageUrl: string;
  microLocation: string;
  tier: string;
  startingFromINR: number;
  averageRating: number;
  badgeType: string | null;
}

interface JourneyData {
  user: {
    name: string;
    email: string;
    image: string;
  };
  savedVendors: SerializedVendor[];
  matchHistory: MatchHistoryEntry[];
}

function serializeVendor(v: Record<string, any>): SerializedVendor {
  return {
    slug: v.slug,
    name: v.name,
    tagline: v.tagline,
    profileImageUrl: v.profileImageUrl,
    microLocation: v.location?.microLocation ?? '',
    tier: v.pricing?.tier ?? 'premium',
    startingFromINR: v.pricing?.startingFromINR ?? 0,
    averageRating: v.ratings?.averageRating ?? 0,
    badgeType: v.flags?.badgeType ?? null,
  };
}

export default async function JourneyPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/auth?callbackUrl=/journey');
  }

  await dbConnect();

  const userDoc = await User.findOne({ email: session.user.email }).lean<IUser>();

  const savedArtistSlugs: string[] = userDoc?.savedArtists ?? [];
  const matchHistory: MatchHistoryEntry[] = userDoc?.matchHistory ?? [];

  let savedVendors: SerializedVendor[] = [];
  if (savedArtistSlugs.length > 0) {
    const vendors = await Vendor.find({
      slug: { $in: savedArtistSlugs },
      'flags.isActive': true,
    })
      .select('slug name tagline profileImageUrl location pricing ratings flags')
      .lean<Record<string, any>[]>();

    const vendorMap = new Map(vendors.map((v) => [v.slug, v]));
    savedVendors = savedArtistSlugs
      .map((slug) => vendorMap.get(slug))
      .filter(Boolean)
      .map(serializeVendor);
  }

  const data: JourneyData = {
    user: {
      name: session.user.name ?? 'Your Account',
      email: session.user.email,
      image: session.user.image ?? '',
    },
    savedVendors,
    matchHistory,
  };

  return <JourneyClient data={data} />;
}
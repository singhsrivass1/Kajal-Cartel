import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Types } from 'mongoose';
import { dbConnect } from '@/lib/db/connect';
import User from '@/lib/db/models/User';
import Vendor from '@/lib/db/models/Vendor';
import SavedMoodboard from '@/lib/db/models/SavedMoodboard';
import { JourneyClient } from './_components/JourneyClient';
import type { IUser } from '@/lib/db/models/User';
import { listCustomerBookings } from '@/lib/db/controllers/BookingViews';
import { listBoards } from '@/lib/db/controllers/BoardManager';
import { serializeVendorsWithVerifiedRatings } from '@/lib/db/serializers/verifiedRatings';
import { getVendorFacets } from '@/lib/db/controllers/DiscoveryManager';
import type { JourneyData, JourneyTab, SavedVendorView } from './types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Bridal Journey — Kajal Cartel',
  description: 'Your saved artists, style matches, and booking history.',
  robots: { index: false, follow: false },
};

const TABS: JourneyTab[] = ['bookings', 'artists', 'looks', 'boards'];

export default async function JourneyPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/auth?callbackUrl=/journey');
  }

  await dbConnect();

  const sessionId = (session.user as { id?: unknown }).id;
  const userDoc = await User.findOne(
    typeof sessionId === 'string' && Types.ObjectId.isValid(sessionId) ? { _id: sessionId } : { email: session.user.email }
  ).lean<IUser>();

  if (!userDoc?._id) {
    redirect('/auth?callbackUrl=/journey');
  }

  const userId = (userDoc._id as Types.ObjectId).toString();
  const savedArtistSlugs: string[] = userDoc.savedArtists ?? [];

  const [vendors, bookings, moodboardDocs, boards] = await Promise.all([
    savedArtistSlugs.length > 0
      ? Vendor.find({ slug: { $in: savedArtistSlugs }, 'flags.isActive': true })
          .select('-portfolio')
          .lean<Record<string, any>[]>()
      : Promise.resolve([] as Record<string, any>[]),
    listCustomerBookings(userId),
    SavedMoodboard.find({ user: userDoc._id as Types.ObjectId })
      .select('label styleDNA editorialAnalysis createdAt')
      .sort({ createdAt: -1 })
      .lean<Array<Record<string, any>>>(),
    listBoards(userId),
  ]);

  const [serializedVendors, facets] = await Promise.all([
    serializeVendorsWithVerifiedRatings(vendors),
    getVendorFacets(vendors.map((v) => v._id as Types.ObjectId)),
  ]);
  const vendorMap = new Map(serializedVendors.map((v) => [v.slug, v]));
  const savedVendors: SavedVendorView[] = savedArtistSlugs
    .map((slug) => vendorMap.get(slug))
    .filter((v): v is NonNullable<typeof v> => v !== undefined)
    .map((v) => ({
      slug: v.slug,
      name: v.name,
      tagline: v.tagline,
      profileImageUrl: v.profileImageUrl,
      microLocation: v.location.microLocation,
      fromPriceINR: facets.get(v._id)?.fromPriceINR ?? null,
      averageRating: v.ratings.averageRating,
      totalReviews: v.ratings.totalReviews,
      badgeType: v.flags.badgeType,
    }));

  const requestedTab = searchParams?.tab;
  const upcomingCount = bookings.filter((b) => b.phase === 'upcoming').length;
  const initialTab: JourneyTab = TABS.includes(requestedTab as JourneyTab)
    ? (requestedTab as JourneyTab)
    : upcomingCount > 0 || savedVendors.length === 0
    ? 'bookings'
    : 'artists';

  const data: JourneyData = {
    user: {
      name: userDoc.name ?? session.user.name ?? 'Your Account',
      email: userDoc.email,
      image: userDoc.image ?? session.user.image ?? '',
    },
    savedVendors,
    savedMoodboards: moodboardDocs.map((board) => ({
      id: board._id.toString(),
      label: board.label,
      styleDNA: board.styleDNA ?? [],
      editorialAnalysis: board.editorialAnalysis ?? '',
      savedAt: new Date(board.createdAt).toISOString(),
    })),
    bookings,
    boards,
  };

  return <JourneyClient data={data} initialTab={initialTab} />;
}

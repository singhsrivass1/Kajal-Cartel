import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Types } from 'mongoose';
import { dbConnect } from '@/lib/db/connect';
import User from '@/lib/db/models/User';
import Vendor from '@/lib/db/models/Vendor';
import Booking from '@/lib/db/models/Booking';
import SavedMoodboard from '@/lib/db/models/SavedMoodboard';
import { refFromId } from '@/lib/db/controllers/BookingManager';
import { JourneyClient } from './_components/JourneyClient';
import type { IUser } from '@/lib/db/models/User';
import type { BookingStatus } from '@/lib/db/models/Booking';

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

interface SavedMoodboardSummary {
  id: string;
  label: string;
  styleDNA: Array<{ label: string; score: number }>;
  editorialAnalysis: string;
  savedAt: string;
}

interface SerializedBooking {
  id: string;
  ref: string;
  vendorName: string;
  vendorSlug: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  total: number;
  depositAmount: number;
  createdAt: string;
}

interface JourneyData {
  user: {
    name: string;
    email: string;
    image: string;
  };
  savedVendors: SerializedVendor[];
  savedMoodboards: SavedMoodboardSummary[];
  bookings: SerializedBooking[];
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
      .filter((v): v is Record<string, any> => v !== undefined)
      .map(serializeVendor);
  }

  let bookings: SerializedBooking[] = [];
  if (userDoc?._id) {
    const bookingDocs = await Booking.find({ customer: userDoc._id as Types.ObjectId })
      .sort({ createdAt: -1 })
      .populate('vendor', 'name slug')
      .populate('service', 'name')
      .lean<Array<Record<string, any>>>();

    bookings = bookingDocs
      .filter((b) => b.vendor && b.service)
      .map((b) => ({
        id: b._id.toString(),
        ref: refFromId(b._id),
        vendorName: b.vendor.name,
        vendorSlug: b.vendor.slug,
        serviceName: b.service.name,
        date: new Date(b.date).toISOString().slice(0, 10),
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        total: b.priceSnapshot.total,
        depositAmount: b.priceSnapshot.depositAmount,
        createdAt: new Date(b.createdAt).toISOString(),
      }));
  }

  let savedMoodboards: SavedMoodboardSummary[] = [];
  if (userDoc?._id) {
    const moodboardDocs = await SavedMoodboard.find({ user: userDoc._id as Types.ObjectId })
      .select('label styleDNA editorialAnalysis createdAt')
      .sort({ createdAt: -1 })
      .lean<Array<Record<string, any>>>();

    savedMoodboards = moodboardDocs.map((board) => ({
      id: board._id.toString(),
      label: board.label,
      styleDNA: board.styleDNA ?? [],
      editorialAnalysis: board.editorialAnalysis ?? '',
      savedAt: new Date(board.createdAt).toISOString(),
    }));
  }

  const data: JourneyData = {
    user: {
      name: session.user.name ?? 'Your Account',
      email: session.user.email,
      image: session.user.image ?? '',
    },
    savedVendors,
    savedMoodboards,
    bookings,
  };

  return <JourneyClient data={data} />;
}
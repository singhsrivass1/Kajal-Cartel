import type { Metadata } from 'next';
import { dbConnect } from '@/lib/db/connect';
import Vendor from '@/lib/db/models/Vendor';
import { DiscoverPageClient } from './_components/DiscoverPageClient';
import type { ClientVendor } from '@/types/match';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Discover Artists — Kajal Cartel',
  description:
    'Find your perfect Delhi bridal artist using AI mood board matching. Upload your aesthetic vision and let our Gemini-powered engine curate your ideal match.',
};

function serializeVendor(v: Record<string, any>): ClientVendor {
  return {
    _id: v._id.toString(),
    name: v.name,
    slug: v.slug,
    tagline: v.tagline,
    profileImageUrl: v.profileImageUrl,
    location: {
      microLocation: v.location.microLocation,
      city: v.location.city,
      travelPolicy: v.location.travelPolicy,
    },
    pricing: {
      tier: v.pricing.tier,
      startingFromINR: v.pricing.startingFromINR,
    },
    ratings: {
      averageRating: v.ratings?.averageRating ?? 0,
      totalReviews: v.ratings?.totalReviews ?? 0,
    },
    flags: {
      badgeType: v.flags?.badgeType ?? null,
      isVerified: v.flags?.isVerified ?? false,
      isFeatured: v.flags?.isFeatured ?? false,
    },
    aestheticProfile: {
      styleArchetypes: v.aestheticProfile?.styleArchetypes ?? [],
      signatureElements: v.aestheticProfile?.signatureElements,
    },
    serviceSummary: {
      serviceCount: v.serviceSummary?.serviceCount ?? 0,
      anchorServiceCount: v.serviceSummary?.anchorServiceCount ?? 0,
      priceRangeINR: v.serviceSummary?.priceRangeINR ?? { min: 0, max: 0 },
      occasionCoverage: v.serviceSummary?.occasionCoverage ?? [],
      hasTrialOffering: v.serviceSummary?.hasTrialOffering ?? false,
    },
  };
}

export default async function DiscoverPage() {
  let vendors: ClientVendor[] = [];

  try {
    await dbConnect();

    const rawVendors = await Vendor.find({ 'flags.isActive': true })
      .sort({ 'flags.isFeatured': -1, 'ratings.averageRating': -1 })
      .lean<Record<string, any>[]>();

    vendors = rawVendors.map(serializeVendor);
  } catch (error) {
    console.error('[DiscoverPage] Failed to load vendor roster:', error);
  }

  return <DiscoverPageClient vendors={vendors} />;
}

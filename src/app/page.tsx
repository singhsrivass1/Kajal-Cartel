export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { dbConnect } from '@/lib/db/connect';
import Vendor from '@/lib/db/models/Vendor';
import { HomepageClient } from './_components/HomepageClient';
import type { ClientVendor } from '@/types/match';

export const metadata: Metadata = {
  title: 'Kajal Cartel — AI-Powered Bridal Beauty Discovery, New Delhi',
  description: 'Find your perfect Delhi bridal artist using AI mood board matching.',
};

function serializeVendor(v: any): ClientVendor {
  return {
    _id: v._id.toString(),
    name: v.name,
    slug: v.slug,
    tagline: v.tagline,
    profileImageUrl: v.profileImageUrl,
    location: {
      microLocation: v.location?.microLocation ?? '',
      city: v.location?.city ?? 'New Delhi',
      travelPolicy: v.location?.travelPolicy ?? 'all',
    },
    pricing: {
      tier: v.pricing?.tier ?? 'premium',
      startingFromINR: v.pricing?.startingFromINR ?? 0,
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

export default async function HomePage() {
  let featuredVendors: ClientVendor[] = [];

  try {
    await dbConnect();
    const raw = await Vendor.find({
      'flags.isActive': true,
      'flags.isFeatured': true,
    })
      .sort({ 'ratings.averageRating': -1 })
      .limit(4)
      .lean();

    featuredVendors = raw.map(serializeVendor);
  } catch (err) {
    console.error('[HomePage] DB error:', err);
  }

  return <HomepageClient featuredVendors={featuredVendors} />;
}
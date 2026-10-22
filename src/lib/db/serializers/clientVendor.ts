import type { ClientVendor } from '@/types/match';

export function serializeClientVendor(v: Record<string, any>): ClientVendor {
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

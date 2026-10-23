import type { Metadata } from 'next';
import { Types } from 'mongoose';
import { dbConnect } from '@/lib/db/connect';
import Vendor from '@/lib/db/models/Vendor';
import { DiscoverPageClient } from './_components/DiscoverPageClient';
import { serializeVendorsWithVerifiedRatings } from '@/lib/db/serializers/verifiedRatings';
import { getVendorFacets } from '@/lib/db/controllers/DiscoveryManager';
import type { DiscoverVendor } from '@/types/discovery';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Discover Artists — Kajal Cartel',
  description:
    'Find your perfect Delhi bridal artist. Show us your aesthetic vision and discover artists curated to your style.',
  alternates: { canonical: '/discover' },
  openGraph: {
    title: 'Discover Artists — Kajal Cartel',
    description: 'Search Delhi bridal artists by style, occasion, service and availability, or match by uploading a look you love.',
    url: '/discover',
  },
};

export default async function DiscoverPage() {
  let vendors: DiscoverVendor[] = [];
  let loadError = false;

  try {
    await dbConnect();

    const rawVendors = await Vendor.find({ 'flags.isActive': true })
      .select('-portfolio')
      .sort({ 'flags.isFeatured': -1, name: 1 })
      .lean<Record<string, any>[]>();

    const [serialized, facets] = await Promise.all([
      serializeVendorsWithVerifiedRatings(rawVendors),
      getVendorFacets(rawVendors.map((v) => v._id as Types.ObjectId)),
    ]);

    vendors = serialized.map((v) => {
      const f = facets.get(v._id);
      return {
        ...v,
        facets: {
          fromPriceINR: f?.fromPriceINR ?? null,
          serviceCategories: f?.serviceCategories ?? [],
          occasions: f?.occasions ?? [],
          acceptsOnlineBooking: f?.acceptsOnlineBooking ?? false,
        },
      };
    });
  } catch (error) {
    loadError = true;
    console.error('[DiscoverPage] Failed to load vendor roster:', error);
  }

  return <DiscoverPageClient vendors={vendors} loadError={loadError} />;
}

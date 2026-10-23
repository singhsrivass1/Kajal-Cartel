export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { dbConnect } from '@/lib/db/connect';
import Vendor from '@/lib/db/models/Vendor';
import { HomepageClient } from './_components/HomepageClient';
import { serializeVendorsWithVerifiedRatings } from '@/lib/db/serializers/verifiedRatings';
import { listRecentPublishedReviews } from '@/lib/db/controllers/ReviewManager';
import type { RecentReview } from '@/lib/db/controllers/ReviewManager';
import type { ClientVendor } from '@/types/match';

export const metadata: Metadata = {
  title: 'Kajal Cartel — Bridal Beauty Discovery, New Delhi',
  description: 'Find your perfect Delhi bridal artist. Show us your aesthetic vision and discover artists curated to your style.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Kajal Cartel — Bridal Beauty Discovery, New Delhi',
    description: 'Find your perfect Delhi bridal artist. Show us your aesthetic vision and discover artists curated to your style.',
    url: '/',
  },
};

export default async function HomePage() {
  let featuredVendors: ClientVendor[] = [];
  let reviews: RecentReview[] = [];

  try {
    await dbConnect();
    const raw = await Vendor.find({
      'flags.isActive': true,
      'flags.isFeatured': true,
    })
      .select('-portfolio')
      .sort({ name: 1 })
      .limit(4)
      .lean<Array<Record<string, any>>>();

    [featuredVendors, reviews] = await Promise.all([
      serializeVendorsWithVerifiedRatings(raw),
      listRecentPublishedReviews(3),
    ]);
  } catch (err) {
    console.error('[HomePage] DB error:', err);
  }

  return <HomepageClient featuredVendors={featuredVendors} reviews={reviews} />;
}

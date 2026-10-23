import { getVendorReviewStats } from '@/lib/db/controllers/ReviewManager';
import { serializeClientVendor } from './clientVendor';
import type { ClientVendor } from '@/types/match';

export async function serializeVendorsWithVerifiedRatings(vendors: Array<Record<string, any>>): Promise<ClientVendor[]> {
  const stats = await getVendorReviewStats(vendors.map((v) => v._id));
  return vendors.map((v) => serializeClientVendor(v, stats.get(v._id.toString())));
}

export async function applyVerifiedRatings<T extends { vendor: ClientVendor }>(items: T[]): Promise<T[]> {
  const stats = await getVendorReviewStats(items.map((i) => i.vendor._id));
  return items.map((item) => ({
    ...item,
    vendor: {
      ...item.vendor,
      ratings: stats.get(item.vendor._id) ?? { averageRating: 0, totalReviews: 0 },
    },
  }));
}

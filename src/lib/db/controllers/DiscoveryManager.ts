import { Types } from 'mongoose';
import Vendor from '@/lib/db/models/Vendor';
import Service from '@/lib/db/models/Service';
import VendorAvailability from '@/lib/db/models/VendorAvailability';
import BlockedDate from '@/lib/db/models/BlockedDate';
import Booking from '@/lib/db/models/Booking';
import { getBookingPolicy } from '@/lib/booking/policy';
import { isoDateToUtcMidnight } from '@/lib/db/utils/time';
import {
  assertBookableDateFormat,
  needsScheduleLookup,
  slotsFromSchedule,
} from './AvailabilityManager';
import type { ScheduleData } from './AvailabilityManager';
import { getVendorReviewStats } from './ReviewManager';
import type { VendorReviewStats } from './ReviewManager';

export interface VendorFacets {
  fromPriceINR: number | null;
  serviceCategories: string[];
  occasions: string[];
  bookableServiceCount: number;
  acceptsOnlineBooking: boolean;
  shortestServiceMinutes: number | null;
}

const PUBLIC_SERVICE_ROLES = ['anchor', 'standalone', 'trial'];

export async function getVendorFacets(vendorIds: Types.ObjectId[]): Promise<Map<string, VendorFacets>> {
  const facets = new Map<string, VendorFacets>();
  if (vendorIds.length === 0) return facets;

  const [serviceRows, availabilityRows] = await Promise.all([
    Service.aggregate<{
      _id: Types.ObjectId;
      minAnchorPrice: number | null;
      minAnchorMinutes: number | null;
      anchorCount: number;
      categories: string[];
      occasionGroups: string[][];
    }>([
      { $match: { vendor: { $in: vendorIds }, 'flags.isActive': true } },
      {
        $group: {
          _id: '$vendor',
          minAnchorPrice: { $min: { $cond: [{ $eq: ['$serviceRole', 'anchor'] }, '$pricing.unitPriceINR', null] } },
          minAnchorMinutes: {
            $min: {
              $cond: [
                { $eq: ['$serviceRole', 'anchor'] },
                { $add: ['$duration.baseDurationMinutes', '$duration.bufferMinutes'] },
                null,
              ],
            },
          },
          anchorCount: { $sum: { $cond: [{ $eq: ['$serviceRole', 'anchor'] }, 1, 0] } },
          categories: { $addToSet: '$category' },
          occasionGroups: { $push: '$aestheticSignals.occasionTags' },
        },
      },
    ]),
    VendorAvailability.find({ vendor: { $in: vendorIds } })
      .select('vendor workingHours')
      .lean<Array<{ vendor: Types.ObjectId; workingHours: Array<{ isOpen: boolean }> }>>(),
  ]);

  const openSchedules = new Set(
    availabilityRows.filter((a) => a.workingHours.some((w) => w.isOpen)).map((a) => a.vendor.toString())
  );

  for (const id of vendorIds) {
    facets.set(id.toString(), {
      fromPriceINR: null,
      serviceCategories: [],
      occasions: [],
      bookableServiceCount: 0,
      acceptsOnlineBooking: false,
      shortestServiceMinutes: null,
    });
  }
  for (const row of serviceRows) {
    const key = row._id.toString();
    facets.set(key, {
      fromPriceINR: typeof row.minAnchorPrice === 'number' ? row.minAnchorPrice : null,
      serviceCategories: [...row.categories].sort(),
      occasions: [...new Set(row.occasionGroups.flat())].sort(),
      bookableServiceCount: row.anchorCount,
      acceptsOnlineBooking: row.anchorCount > 0 && openSchedules.has(key),
      shortestServiceMinutes: typeof row.minAnchorMinutes === 'number' ? row.minAnchorMinutes : null,
    });
  }
  return facets;
}

export async function findVendorSlugsAvailableOn(date: string, now: Date = new Date()): Promise<string[]> {
  assertBookableDateFormat(date, now);
  const policy = getBookingPolicy();

  const vendors = await Vendor.find({ 'flags.isActive': true })
    .select('_id slug businessMeta.bookingLeadTimeDays')
    .lean<Array<{ _id: Types.ObjectId; slug: string; businessMeta?: { bookingLeadTimeDays?: number } }>>();
  if (vendors.length === 0) return [];
  const vendorIds = vendors.map((v) => v._id);

  const facets = await getVendorFacets(vendorIds);
  const availabilities = await VendorAvailability.find({ vendor: { $in: vendorIds } })
    .lean<Array<NonNullable<ScheduleData['availability']> & { vendor: Types.ObjectId }>>();
  const availabilityByVendor = new Map(availabilities.map((a) => [a.vendor.toString(), a]));

  const candidates = vendors.filter((v) => {
    const facet = facets.get(v._id.toString());
    const availability = availabilityByVendor.get(v._id.toString()) ?? null;
    if (!facet?.shortestServiceMinutes || !availability) return false;
    return needsScheduleLookup(availability, {
      durationMinutes: facet.shortestServiceMinutes,
      date,
      leadTimeDays: v.businessMeta?.bookingLeadTimeDays ?? 0,
      policy,
      now,
    });
  });
  if (candidates.length === 0) return [];

  const targetDate = isoDateToUtcMidnight(date);
  const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
  const candidateIds = candidates.map((v) => v._id);
  const [blockedRows, bookingRows] = await Promise.all([
    BlockedDate.find({ vendor: { $in: candidateIds }, startDate: { $lt: nextDay }, endDate: { $gte: targetDate } })
      .select('vendor reason')
      .lean<Array<{ vendor: Types.ObjectId; reason?: string }>>(),
    Booking.find({ vendor: { $in: candidateIds }, date: targetDate, status: { $in: ['PENDING', 'CONFIRMED'] } })
      .select('vendor startTime endTime')
      .lean<Array<{ vendor: Types.ObjectId; startTime: string; endTime: string }>>(),
  ]);
  const blockedByVendor = new Map(blockedRows.map((b) => [b.vendor.toString(), b]));
  const bookingsByVendor = new Map<string, Array<{ startTime: string; endTime: string }>>();
  for (const b of bookingRows) {
    const key = b.vendor.toString();
    bookingsByVendor.set(key, [...(bookingsByVendor.get(key) ?? []), b]);
  }

  return candidates
    .filter((v) => {
      const key = v._id.toString();
      const result = slotsFromSchedule(
        {
          availability: availabilityByVendor.get(key) ?? null,
          blocked: blockedByVendor.get(key) ?? null,
          bookings: bookingsByVendor.get(key) ?? [],
        },
        {
          durationMinutes: facets.get(key)!.shortestServiceMinutes!,
          date,
          leadTimeDays: v.businessMeta?.bookingLeadTimeDays ?? 0,
          policy,
          now,
        }
      );
      return result.slots.length > 0;
    })
    .map((v) => v.slug);
}

export interface PublicServiceSummary {
  id: string;
  name: string;
  slug: string;
  category: string;
  serviceRole: string;
  description?: string;
  priceINR: number;
  priceType: string;
  durationMinutes: number;
  occasions: string[];
  requiresConsultation: boolean;
  isSignature: boolean;
  vendor: {
    name: string;
    slug: string;
    microLocation: string;
    profileImageUrl: string;
    ratings: VendorReviewStats;
  };
}

function toServiceSummary(s: Record<string, any>, vendor: Record<string, any>, stats?: VendorReviewStats): PublicServiceSummary {
  return {
    id: s._id.toString(),
    name: s.name,
    slug: s.slug,
    category: s.category,
    serviceRole: s.serviceRole,
    description: s.description || undefined,
    priceINR: s.pricing?.unitPriceINR ?? 0,
    priceType: s.pricing?.priceType ?? 'per-service',
    durationMinutes: s.duration?.baseDurationMinutes ?? 0,
    occasions: s.aestheticSignals?.occasionTags ?? [],
    requiresConsultation: Boolean(s.checkoutMeta?.requiresConsultation),
    isSignature: Boolean(s.flags?.isSignatureService),
    vendor: {
      name: vendor.name,
      slug: vendor.slug,
      microLocation: vendor.location?.microLocation ?? '',
      profileImageUrl: vendor.profileImageUrl ?? '',
      ratings: stats ?? { averageRating: 0, totalReviews: 0 },
    },
  };
}

export async function listPublicServices(): Promise<PublicServiceSummary[]> {
  const vendors = await Vendor.find({ 'flags.isActive': true })
    .select('_id name slug location.microLocation profileImageUrl')
    .lean<Array<Record<string, any>>>();
  if (vendors.length === 0) return [];
  const vendorMap = new Map(vendors.map((v) => [v._id.toString(), v]));

  const [services, stats] = await Promise.all([
    Service.find({
      vendor: { $in: vendors.map((v) => v._id) },
      'flags.isActive': true,
      serviceRole: { $in: PUBLIC_SERVICE_ROLES },
    })
      .sort({ 'pricing.unitPriceINR': 1, name: 1 })
      .limit(500)
      .lean<Array<Record<string, any>>>(),
    getVendorReviewStats(vendors.map((v) => v._id)),
  ]);

  return services
    .filter((s) => vendorMap.has(s.vendor.toString()))
    .map((s) => toServiceSummary(s, vendorMap.get(s.vendor.toString())!, stats.get(s.vendor.toString())));
}

export interface PublicServiceDetail extends PublicServiceSummary {
  bufferMinutes: number;
  addOns: Array<{ id: string; name: string; priceINR: number; quantityLabel: string; maxQuantity: number }>;
  otherServices: Array<{ id: string; name: string; slug: string; priceINR: number; durationMinutes: number }>;
  leadTimeDays: number;
  acceptsOnlineBooking: boolean;
}

export async function getPublicServiceDetail(vendorSlug: string, serviceSlug: string): Promise<PublicServiceDetail | null> {
  if (typeof vendorSlug !== 'string' || typeof serviceSlug !== 'string') return null;
  if (!/^[a-z0-9-]+$/.test(vendorSlug) || !/^[a-z0-9-]+$/.test(serviceSlug)) return null;

  const vendor = await Vendor.findOne({ slug: vendorSlug, 'flags.isActive': true })
    .select('_id name slug location.microLocation profileImageUrl businessMeta.bookingLeadTimeDays')
    .lean<Record<string, any>>();
  if (!vendor) return null;

  const services = await Service.find({ vendor: vendor._id, 'flags.isActive': true })
    .sort({ 'checkoutMeta.displayPriority': 1, name: 1 })
    .lean<Array<Record<string, any>>>();
  const service = services.find((s) => s.slug === serviceSlug && PUBLIC_SERVICE_ROLES.includes(s.serviceRole));
  if (!service) return null;

  const [stats, facets] = await Promise.all([getVendorReviewStats([vendor._id]), getVendorFacets([vendor._id])]);

  return {
    ...toServiceSummary(service, vendor, stats.get(vendor._id.toString())),
    bufferMinutes: service.duration?.bufferMinutes ?? 0,
    addOns: services
      .filter(
        (s) =>
          s.serviceRole === 'add-on' &&
          (!s.compatibleAnchorCategories?.length || s.compatibleAnchorCategories.includes(service.category))
      )
      .map((s) => ({
        id: s._id.toString(),
        name: s.name,
        priceINR: s.pricing?.unitPriceINR ?? 0,
        quantityLabel: s.partyConfig?.quantityLabel ?? 'Person',
        maxQuantity: s.partyConfig?.maxQuantity ?? 1,
      })),
    otherServices: services
      .filter((s) => s._id.toString() !== service._id.toString() && PUBLIC_SERVICE_ROLES.includes(s.serviceRole))
      .map((s) => ({
        id: s._id.toString(),
        name: s.name,
        slug: s.slug,
        priceINR: s.pricing?.unitPriceINR ?? 0,
        durationMinutes: s.duration?.baseDurationMinutes ?? 0,
      })),
    leadTimeDays: vendor.businessMeta?.bookingLeadTimeDays ?? 0,
    acceptsOnlineBooking: Boolean(facets.get(vendor._id.toString())?.acceptsOnlineBooking) && service.serviceRole === 'anchor',
  };
}

import { Types } from 'mongoose';
import Vendor from '@/lib/db/models/Vendor';
import Service from '@/lib/db/models/Service';
import VendorAvailability from '@/lib/db/models/VendorAvailability';
import BlockedDate from '@/lib/db/models/BlockedDate';
import Booking from '@/lib/db/models/Booking';
import { parseTimeToMinutes, minutesToTime } from '@/lib/db/utils/time';

export class AvailabilityValidationError extends Error {
  readonly statusCode: 400 | 404;

  constructor(message: string, statusCode: 400 | 404 = 400) {
    super(message);
    this.name = 'AvailabilityValidationError';
    this.statusCode = statusCode;
  }
}

export interface DailyAvailabilityRequest {
  vendorSlug: string;
  serviceId: string;
  date: string; // YYYY-MM-DD
}

export interface DailyAvailabilityResult {
  vendorSlug: string;
  serviceId: string;
  date: string;
  /** Whether this vendor has any VendorAvailability configured at all. */
  configured: boolean;
  /** Whether the vendor's working hours are open on this date's weekday. */
  isOpen: boolean;
  isBlocked: boolean;
  blockedReason?: string;
  durationMinutes: number;
  slotIntervalMinutes: number;
  slots: string[]; // "HH:mm", 24-hour, bookable start times
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getDailyAvailability(
  request: DailyAvailabilityRequest
): Promise<DailyAvailabilityResult> {
  const { vendorSlug, serviceId, date } = request;

  if (!DATE_RE.test(date)) {
    throw new AvailabilityValidationError('date must be in YYYY-MM-DD format.');
  }

  const targetDate = parseDateUTC(date);
  if (Number.isNaN(targetDate.getTime())) {
    throw new AvailabilityValidationError('date is not a valid calendar date.');
  }
  if (targetDate.getTime() < todayUTC().getTime()) {
    throw new AvailabilityValidationError('date cannot be in the past.');
  }

  if (!Types.ObjectId.isValid(serviceId)) {
    throw new AvailabilityValidationError('serviceId must be a valid service ID.');
  }

  const vendor = await Vendor.findOne({ slug: vendorSlug, 'flags.isActive': true }).lean<{
    _id: Types.ObjectId;
  }>();
  if (!vendor) {
    throw new AvailabilityValidationError('Artist not found.', 404);
  }

  const service = await Service.findOne({
    _id: new Types.ObjectId(serviceId),
    vendor: vendor._id,
    'flags.isActive': true,
  }).lean<{ duration: { baseDurationMinutes: number; bufferMinutes: number } }>();
  if (!service) {
    throw new AvailabilityValidationError('Service not found for this artist.', 404);
  }

  const durationMinutes = service.duration.baseDurationMinutes + service.duration.bufferMinutes;

  const availability = await VendorAvailability.findOne({ vendor: vendor._id }).lean<{
    workingHours: Array<{ dayOfWeek: number; isOpen: boolean; startTime: string; endTime: string }>;
    slotIntervalMinutes: number;
    maxConcurrentBookings: number;
  }>();

  if (!availability) {
    return {
      vendorSlug,
      serviceId,
      date,
      configured: false,
      isOpen: false,
      isBlocked: false,
      durationMinutes,
      slotIntervalMinutes: 30,
      slots: [],
    };
  }

  const dayOfWeek = targetDate.getUTCDay();
  const dayConfig = availability.workingHours.find((w) => w.dayOfWeek === dayOfWeek);

  if (!dayConfig || !dayConfig.isOpen) {
    return {
      vendorSlug,
      serviceId,
      date,
      configured: true,
      isOpen: false,
      isBlocked: false,
      durationMinutes,
      slotIntervalMinutes: availability.slotIntervalMinutes,
      slots: [],
    };
  }

  const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
  const blocked = await BlockedDate.findOne({
    vendor: vendor._id,
    startDate: { $lt: nextDay },
    endDate: { $gte: targetDate },
  }).lean<{ reason?: string }>();

  if (blocked) {
    return {
      vendorSlug,
      serviceId,
      date,
      configured: true,
      isOpen: true,
      isBlocked: true,
      blockedReason: blocked.reason,
      durationMinutes,
      slotIntervalMinutes: availability.slotIntervalMinutes,
      slots: [],
    };
  }

  const startMinute = parseTimeToMinutes(dayConfig.startTime);
  const endMinute = parseTimeToMinutes(dayConfig.endTime);
  const interval = availability.slotIntervalMinutes;

  // Slots minus already-active bookings for this vendor on this date, respecting
  // the vendor's configured concurrency capacity.
  const activeBookings = await Booking.find({
    vendor: vendor._id,
    date: targetDate,
    status: { $in: ['PENDING', 'CONFIRMED'] },
  })
    .select('startTime endTime')
    .lean<Array<{ startTime: string; endTime: string }>>();

  const bookedIntervals = activeBookings.map((b) => ({
    start: parseTimeToMinutes(b.startTime),
    end: parseTimeToMinutes(b.endTime),
  }));

  const maxConcurrent = availability.maxConcurrentBookings;

  const slots: string[] = [];
  for (let start = startMinute; start + durationMinutes <= endMinute; start += interval) {
    const candidateEnd = start + durationMinutes;
    const overlapping = bookedIntervals.filter((b) => b.start < candidateEnd && b.end > start).length;
    if (overlapping < maxConcurrent) {
      slots.push(minutesToTime(start));
    }
  }

  return {
    vendorSlug,
    serviceId,
    date,
    configured: true,
    isOpen: true,
    isBlocked: false,
    durationMinutes,
    slotIntervalMinutes: interval,
    slots,
  };
}

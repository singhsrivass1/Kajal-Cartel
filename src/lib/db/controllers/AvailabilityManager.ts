import { Types } from 'mongoose';
import type { ClientSession } from 'mongoose';
import Vendor from '@/lib/db/models/Vendor';
import Service from '@/lib/db/models/Service';
import VendorAvailability from '@/lib/db/models/VendorAvailability';
import BlockedDate from '@/lib/db/models/BlockedDate';
import Booking from '@/lib/db/models/Booking';
import {
  parseTimeToMinutes,
  minutesToTime,
  isIsoDate,
  isoDateToUtcMidnight,
  addDaysToIsoDate,
  businessTodayIso,
  businessNowMinutes,
} from '@/lib/db/utils/time';
import { getBookingPolicy } from '@/lib/booking/policy';
import type { BookingPolicyView } from '@/lib/booking/rules';

export class AvailabilityValidationError extends Error {
  readonly statusCode: 400 | 404;

  constructor(message: string, statusCode: 400 | 404 = 400) {
    super(message);
    this.name = 'AvailabilityValidationError';
    this.statusCode = statusCode;
  }
}

export type UnavailableReason =
  | 'not-configured'
  | 'lead-time'
  | 'beyond-window'
  | 'closed'
  | 'blocked'
  | 'fully-booked';

export interface DailyAvailabilityRequest {
  vendorSlug: string;
  serviceId: string;
  date: string; // YYYY-MM-DD
  now?: Date;
  excludeBookingId?: string;
}

export interface DailyAvailabilityResult {
  vendorSlug: string;
  serviceId: string;
  date: string;
  /** Whether this vendor has any VendorAvailability configured at all. */
  configured: boolean;
  /** Whether bookings can be made on this date at all (working day, inside the notice period and booking window). */
  isOpen: boolean;
  isBlocked: boolean;
  blockedReason?: string;
  durationMinutes: number;
  slotIntervalMinutes: number;
  slots: string[]; // "HH:mm", 24-hour, bookable start times
  leadTimeDays: number;
  earliestBookableDate: string;
  latestBookableDate: string;
  unavailableReason: UnavailableReason | null;
}

export interface DaySlotsInput {
  vendorId: Types.ObjectId;
  durationMinutes: number;
  date: string;
  leadTimeDays: number;
  policy?: BookingPolicyView;
  now?: Date;
  session?: ClientSession;
  excludeBookingId?: Types.ObjectId;
}

export type DaySlotsResult = Omit<DailyAvailabilityResult, 'vendorSlug' | 'serviceId' | 'date'>;

export function assertBookableDateFormat(date: string, now: Date = new Date()): void {
  if (!isIsoDate(date)) {
    throw new AvailabilityValidationError('date must be a valid calendar date in YYYY-MM-DD format.');
  }
  if (date < businessTodayIso(now)) {
    throw new AvailabilityValidationError('date cannot be in the past.');
  }
}

export interface ScheduleData {
  availability: {
    workingHours: Array<{ dayOfWeek: number; isOpen: boolean; startTime: string; endTime: string }>;
    slotIntervalMinutes: number;
    maxConcurrentBookings: number;
  } | null;
  blocked: { reason?: string } | null;
  bookings: Array<{ startTime: string; endTime: string }>;
}

export interface SlotRules {
  durationMinutes: number;
  date: string;
  leadTimeDays: number;
  policy: BookingPolicyView;
  now: Date;
}

function bookingWindow(rules: SlotRules) {
  const leadTimeDays = Math.max(0, Math.floor(rules.leadTimeDays || 0));
  const today = businessTodayIso(rules.now);
  return {
    today,
    leadTimeDays,
    earliestBookableDate: addDaysToIsoDate(today, leadTimeDays),
    latestBookableDate: addDaysToIsoDate(today, rules.policy.bookingWindowDays),
  };
}

export function needsScheduleLookup(availability: ScheduleData['availability'], rules: SlotRules): boolean {
  if (!availability) return false;
  const { earliestBookableDate, latestBookableDate } = bookingWindow(rules);
  if (rules.date < earliestBookableDate || rules.date > latestBookableDate) return false;
  const dayConfig = availability.workingHours.find((w) => w.dayOfWeek === isoDateToUtcMidnight(rules.date).getUTCDay());
  return Boolean(dayConfig?.isOpen);
}

export function slotsFromSchedule(data: ScheduleData, rules: SlotRules): DaySlotsResult {
  const { durationMinutes, date, now } = rules;
  const { today, leadTimeDays, earliestBookableDate, latestBookableDate } = bookingWindow(rules);
  const base = {
    durationMinutes,
    leadTimeDays,
    earliestBookableDate,
    latestBookableDate,
  };
  const { availability } = data;

  if (!availability) {
    return {
      ...base,
      configured: false,
      isOpen: false,
      isBlocked: false,
      slotIntervalMinutes: 30,
      slots: [],
      unavailableReason: 'not-configured',
    };
  }

  const interval = availability.slotIntervalMinutes;
  const closed = (unavailableReason: UnavailableReason): DaySlotsResult => ({
    ...base,
    configured: true,
    isOpen: false,
    isBlocked: false,
    slotIntervalMinutes: interval,
    slots: [],
    unavailableReason,
  });

  if (date < earliestBookableDate) return closed('lead-time');
  if (date > latestBookableDate) return closed('beyond-window');

  const targetDate = isoDateToUtcMidnight(date);
  const dayConfig = availability.workingHours.find((w) => w.dayOfWeek === targetDate.getUTCDay());
  if (!dayConfig || !dayConfig.isOpen) return closed('closed');

  const { blocked } = data;
  if (blocked) {
    return {
      ...base,
      configured: true,
      isOpen: true,
      isBlocked: true,
      blockedReason: blocked.reason,
      slotIntervalMinutes: interval,
      slots: [],
      unavailableReason: 'blocked',
    };
  }

  const startMinute = parseTimeToMinutes(dayConfig.startTime);
  const endMinute = parseTimeToMinutes(dayConfig.endTime);

  const bookedIntervals = data.bookings.map((b) => ({
    start: parseTimeToMinutes(b.startTime),
    end: parseTimeToMinutes(b.endTime),
  }));

  const maxConcurrent = availability.maxConcurrentBookings;
  const earliestStartToday = date === today ? businessNowMinutes(now) + 1 : -1;

  const slots: string[] = [];
  for (let start = startMinute; start + durationMinutes <= endMinute; start += interval) {
    if (start < earliestStartToday) continue;
    const candidateEnd = start + durationMinutes;
    const overlapping = bookedIntervals.filter((b) => b.start < candidateEnd && b.end > start).length;
    if (overlapping < maxConcurrent) {
      slots.push(minutesToTime(start));
    }
  }

  return {
    ...base,
    configured: true,
    isOpen: true,
    isBlocked: false,
    slotIntervalMinutes: interval,
    slots,
    unavailableReason: slots.length === 0 ? 'fully-booked' : null,
  };
}

export async function computeDaySlots(input: DaySlotsInput): Promise<DaySlotsResult> {
  const { vendorId, date, session, excludeBookingId } = input;
  const rules: SlotRules = {
    durationMinutes: input.durationMinutes,
    date,
    leadTimeDays: input.leadTimeDays,
    policy: input.policy ?? getBookingPolicy(),
    now: input.now ?? new Date(),
  };

  const availability = await VendorAvailability.findOne({ vendor: vendorId })
    .session(session ?? null)
    .lean<ScheduleData['availability']>();

  if (!needsScheduleLookup(availability, rules)) {
    return slotsFromSchedule({ availability, blocked: null, bookings: [] }, rules);
  }

  const targetDate = isoDateToUtcMidnight(date);
  const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
  const blocked = await BlockedDate.findOne({
    vendor: vendorId,
    startDate: { $lt: nextDay },
    endDate: { $gte: targetDate },
  })
    .session(session ?? null)
    .lean<{ reason?: string }>();
  const bookings = blocked
    ? []
    : await Booking.find({
        vendor: vendorId,
        date: targetDate,
        status: { $in: ['PENDING', 'CONFIRMED'] },
        ...(excludeBookingId ? { _id: { $ne: excludeBookingId } } : {}),
      })
        .select('startTime endTime')
        .session(session ?? null)
        .lean<Array<{ startTime: string; endTime: string }>>();

  return slotsFromSchedule({ availability, blocked, bookings }, rules);
}

export function serviceDurationMinutes(service: { duration: { baseDurationMinutes: number; bufferMinutes: number } }): number {
  return service.duration.baseDurationMinutes + service.duration.bufferMinutes;
}

export async function getDailyAvailability(
  request: DailyAvailabilityRequest
): Promise<DailyAvailabilityResult> {
  const { vendorSlug, serviceId, date } = request;
  const now = request.now ?? new Date();

  assertBookableDateFormat(date, now);

  if (!Types.ObjectId.isValid(serviceId)) {
    throw new AvailabilityValidationError('serviceId must be a valid service ID.');
  }
  if (request.excludeBookingId !== undefined && !Types.ObjectId.isValid(request.excludeBookingId)) {
    throw new AvailabilityValidationError('excludeBookingId must be a valid booking ID.');
  }

  const vendor = await Vendor.findOne({ slug: vendorSlug, 'flags.isActive': true })
    .select('_id businessMeta.bookingLeadTimeDays')
    .lean<{ _id: Types.ObjectId; businessMeta?: { bookingLeadTimeDays?: number } }>();
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

  const result = await computeDaySlots({
    vendorId: vendor._id,
    durationMinutes: serviceDurationMinutes(service),
    date,
    leadTimeDays: vendor.businessMeta?.bookingLeadTimeDays ?? 0,
    now,
    excludeBookingId: request.excludeBookingId ? new Types.ObjectId(request.excludeBookingId) : undefined,
  });

  return { vendorSlug, serviceId, date, ...result };
}

import { Types } from 'mongoose';
import Vendor from '@/lib/db/models/Vendor';
import Service from '@/lib/db/models/Service';
import Booking, {
  BOOKING_STATUS_TRANSITIONS,
  BOOKING_STATUSES,
  MAX_BOOKING_HISTORY,
} from '@/lib/db/models/Booking';
import type { BookingStatus, IBookingHistoryEntry } from '@/lib/db/models/Booking';
import { calculateBookingEstimate, EstimateValidationError } from './ServiceManager';
import type { AddOnRequest } from './ServiceManager';
import {
  computeDaySlots,
  assertBookableDateFormat,
  serviceDurationMinutes,
  getDailyAvailability,
  AvailabilityValidationError,
} from './AvailabilityManager';
import type { DaySlotsResult } from './AvailabilityManager';
import { parseTimeToMinutes, minutesToTime, isoDateToUtcMidnight, utcMidnightToIsoDate, appointmentStartInstant } from '@/lib/db/utils/time';
import { runTransaction, lockVendorSchedule, TransactionsUnavailableError } from '@/lib/db/transaction';
import { getBookingPolicy } from '@/lib/booking/policy';
import { customerCancelDecision, customerRescheduleDecision } from '@/lib/booking/rules';
import type { EstimateLineItem } from '@/types/artist';

export class BookingValidationError extends Error {
  readonly statusCode: 400 | 401 | 403 | 404 | 409 | 422 | 503;

  constructor(message: string, statusCode: 400 | 401 | 403 | 404 | 409 | 422 | 503 = 400) {
    super(message);
    this.name = 'BookingValidationError';
    this.statusCode = statusCode;
  }
}

export interface CreateBookingContactInfo {
  name: string;
  phone: string;
  email: string;
}

export interface CreateBookingRequest {
  artistSlug: string;
  anchorServiceId: string;
  addOns: AddOnRequest[];
  date: string; // YYYY-MM-DD
  slotStart: string; // HH:mm
  contactInfo: CreateBookingContactInfo;
  customerNotes?: string;
  idempotencyKey: string;
}

export interface BookingResult {
  bookingId: string;
  ref: string;
  status: BookingStatus;
  date: string;
  startTime: string;
  endTime: string;
  total: number;
  depositAmount: number;
  /** False when this call replayed an existing booking via idempotencyKey — callers should not re-send notifications. */
  created: boolean;
  vendorName?: string;
  anchorServiceName?: string;
  lineItems?: EstimateLineItem[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9-]{8,100}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_REASON_LENGTH = 300;

export function refFromId(id: Types.ObjectId): string {
  return `KC-${id.toString().slice(-6).toUpperCase()}`;
}

interface LeanBookingForResult {
  _id: Types.ObjectId;
  status: BookingStatus;
  date: Date;
  startTime: string;
  endTime: string;
  priceSnapshot: { total: number; depositAmount: number };
}

function toResult(booking: LeanBookingForResult, created: boolean): BookingResult {
  return {
    bookingId: booking._id.toString(),
    ref: refFromId(booking._id),
    status: booking.status,
    date: booking.date.toISOString().slice(0, 10),
    startTime: booking.startTime,
    endTime: booking.endTime,
    total: booking.priceSnapshot.total,
    depositAmount: booking.priceSnapshot.depositAmount,
    created,
  };
}

function rethrowAsBookingError(err: unknown): never {
  if (err instanceof AvailabilityValidationError) {
    throw new BookingValidationError(err.message, err.statusCode);
  }
  if (err instanceof TransactionsUnavailableError) {
    console.error('[BookingManager] Transactions unavailable:', err.message);
    throw new BookingValidationError('Online booking is temporarily unavailable. Please try again later.', 503);
  }
  throw err;
}

function unavailableMessage(day: DaySlotsResult): string {
  switch (day.unavailableReason) {
    case 'not-configured':
      return 'This artist is not accepting online bookings yet.';
    case 'lead-time':
      return `This artist needs at least ${day.leadTimeDays} day${day.leadTimeDays === 1 ? '' : 's'} notice. The earliest date you can request is ${day.earliestBookableDate}.`;
    case 'beyond-window':
      return `Appointments can be requested up to ${day.latestBookableDate}. Please choose an earlier date.`;
    default:
      return 'This artist is not accepting bookings on the selected date. Please choose another date.';
  }
}

function assertSlotBookable(day: DaySlotsResult, slotStart: string): void {
  if (!day.configured || !day.isOpen || day.isBlocked) {
    throw new BookingValidationError(unavailableMessage(day), 409);
  }
  if (!day.slots.includes(slotStart)) {
    throw new BookingValidationError('The selected time is no longer available. Please choose another slot.', 409);
  }
}

function historyPush(entry: IBookingHistoryEntry) {
  return { history: { $each: [entry], $slice: -MAX_BOOKING_HISTORY } };
}

function isDuplicateKey(err: unknown): err is { code: number; keyPattern?: Record<string, unknown> } {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

export async function createBooking(
  customerId: string,
  request: CreateBookingRequest,
  now: Date = new Date()
): Promise<BookingResult> {
  const { artistSlug, anchorServiceId, addOns, date, slotStart, contactInfo, customerNotes, idempotencyKey } =
    request;

  if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
    throw new BookingValidationError('A valid idempotencyKey is required.');
  }
  if (!Types.ObjectId.isValid(customerId)) {
    throw new BookingValidationError('You must be signed in to request a booking.', 401);
  }

  // Idempotency: replaying the same key for the same customer returns the
  // booking already created for it instead of creating a duplicate.
  const existing = await Booking.findOne({ customer: customerId, idempotencyKey }).lean<LeanBookingForResult>();
  if (existing) {
    return toResult(existing, false);
  }

  if (!contactInfo || typeof contactInfo !== 'object') {
    throw new BookingValidationError('contactInfo is required.');
  }
  const name = typeof contactInfo.name === 'string' ? contactInfo.name.trim() : '';
  const phone = typeof contactInfo.phone === 'string' ? contactInfo.phone.trim() : '';
  const email = typeof contactInfo.email === 'string' ? contactInfo.email.trim().toLowerCase() : '';
  if (!name) throw new BookingValidationError('contactInfo.name is required.');
  if (name.length > 100) throw new BookingValidationError('contactInfo.name must be 100 characters or fewer.');
  if (!phone) throw new BookingValidationError('contactInfo.phone is required.');
  if (phone.length > 20) throw new BookingValidationError('contactInfo.phone must be 20 characters or fewer.');
  if (!EMAIL_RE.test(email)) throw new BookingValidationError('contactInfo.email must be a valid email address.');
  const notes = typeof customerNotes === 'string' ? customerNotes.trim() : '';
  if (notes.length > 500) throw new BookingValidationError('customerNotes must be 500 characters or fewer.');

  if (typeof artistSlug !== 'string' || !artistSlug) {
    throw new BookingValidationError('artistSlug is required.');
  }
  if (typeof slotStart !== 'string' || !TIME_RE.test(slotStart)) {
    throw new BookingValidationError('slotStart is required. Please select a time slot.');
  }
  if (typeof anchorServiceId !== 'string' || !Types.ObjectId.isValid(anchorServiceId)) {
    throw new BookingValidationError('anchorServiceId must be a valid service ID.');
  }

  try {
    assertBookableDateFormat(date, now);
  } catch (err) {
    rethrowAsBookingError(err);
  }

  const vendor = await Vendor.findOne({ slug: artistSlug, 'flags.isActive': true })
    .select('_id name businessMeta.bookingLeadTimeDays')
    .lean<{ _id: Types.ObjectId; name: string; businessMeta?: { bookingLeadTimeDays?: number } }>();
  if (!vendor) {
    throw new BookingValidationError('Artist not found.', 404);
  }

  const anchor = await Service.findOne({
    _id: new Types.ObjectId(anchorServiceId),
    vendor: vendor._id,
    'flags.isActive': true,
  }).lean<{ duration: { baseDurationMinutes: number; bufferMinutes: number } }>();
  if (!anchor) {
    throw new BookingValidationError('Service not found for this artist.', 404);
  }

  let estimate;
  try {
    estimate = await calculateBookingEstimate({ anchorServiceId, addOns });
  } catch (err) {
    if (err instanceof EstimateValidationError) {
      throw new BookingValidationError(err.message, err.statusCode);
    }
    throw err;
  }

  const bookingDate = isoDateToUtcMidnight(date);

  try {
    const outcome = await runTransaction(async (session) => {
      if (!(await lockVendorSchedule(vendor._id, session, { requireActive: true }))) {
        throw new BookingValidationError('Artist not found.', 404);
      }

      const replay = await Booking.findOne({ customer: customerId, idempotencyKey })
        .session(session)
        .lean<LeanBookingForResult>();
      if (replay) return { kind: 'replay' as const, replay };

      const day = await computeDaySlots({
        vendorId: vendor._id,
        durationMinutes: serviceDurationMinutes(anchor),
        date,
        leadTimeDays: vendor.businessMeta?.bookingLeadTimeDays ?? 0,
        now,
        session,
      });
      assertSlotBookable(day, slotStart);

      const endTime = minutesToTime(parseTimeToMinutes(slotStart) + day.durationMinutes);
      const [booking] = await Booking.create(
        [
          {
            vendor: vendor._id,
            service: new Types.ObjectId(anchorServiceId),
            addOns: addOns.map((a) => ({ service: new Types.ObjectId(a.serviceId), quantity: a.quantity })),
            customer: new Types.ObjectId(customerId),
            date: bookingDate,
            startTime: slotStart,
            endTime,
            status: 'PENDING',
            priceSnapshot: estimate,
            contactInfo: { name, phone, email },
            customerNotes: notes || undefined,
            idempotencyKey,
            rescheduleCount: 0,
            history: [
              {
                at: now,
                actor: 'customer',
                action: 'created',
                toStatus: 'PENDING',
                toDate: bookingDate,
                toStartTime: slotStart,
                toEndTime: endTime,
              },
            ],
          },
        ],
        { session }
      );
      return { kind: 'created' as const, booking };
    });

    if (outcome.kind === 'replay') {
      return toResult(outcome.replay, false);
    }

    const { booking } = outcome;
    return {
      ...toResult(
        {
          _id: booking._id as Types.ObjectId,
          status: booking.status,
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          priceSnapshot: booking.priceSnapshot,
        },
        true
      ),
      vendorName: vendor.name,
      anchorServiceName: estimate.lineItems[0]?.name ?? '',
      lineItems: estimate.lineItems,
    };
  } catch (err: unknown) {
    if (isDuplicateKey(err)) {
      const keyPattern = err.keyPattern;
      const isIdempotencyConflict = !keyPattern || 'idempotencyKey' in keyPattern;

      if (isIdempotencyConflict) {
        // Race: a concurrent request with the same idempotency key created the
        // booking first. Return that one instead of erroring — no second notification.
        const raced = await Booking.findOne({ customer: customerId, idempotencyKey }).lean<LeanBookingForResult>();
        if (raced) return toResult(raced, false);
      }

      // Otherwise the (vendor, service, date, startTime) partial unique index tripped:
      // someone else's booking for this exact slot landed first. This is the DB-level
      // backstop for the case the live availability check alone can't close — two
      // requests reading "available" before either has written.
      throw new BookingValidationError(
        'This time was just booked by someone else. Please choose another slot.',
        409
      );
    }
    rethrowAsBookingError(err);
  }
}

function assertBookingId(bookingId: string): Types.ObjectId {
  if (typeof bookingId !== 'string' || !Types.ObjectId.isValid(bookingId)) {
    throw new BookingValidationError('bookingId must be a valid booking ID.');
  }
  return new Types.ObjectId(bookingId);
}

function assertCustomerId(customerId: string): Types.ObjectId {
  if (typeof customerId !== 'string' || !Types.ObjectId.isValid(customerId)) {
    throw new BookingValidationError('You must be signed in.', 401);
  }
  return new Types.ObjectId(customerId);
}

function cleanReason(reason: unknown): string | undefined {
  if (reason === undefined || reason === null) return undefined;
  if (typeof reason !== 'string') {
    throw new BookingValidationError('reason must be a string.');
  }
  const trimmed = reason.trim();
  if (trimmed.length > MAX_REASON_LENGTH) {
    throw new BookingValidationError(`reason must be ${MAX_REASON_LENGTH} characters or fewer.`);
  }
  return trimmed || undefined;
}

export async function cancelBookingAsCustomer(
  customerId: string,
  bookingId: string,
  reason?: unknown,
  now: Date = new Date()
): Promise<BookingResult> {
  const customer = assertCustomerId(customerId);
  const _id = assertBookingId(bookingId);
  const cancellationReason = cleanReason(reason);
  const policy = getBookingPolicy();

  const booking = await Booking.findOne({ _id, customer }).lean<
    LeanBookingForResult & { rescheduleCount?: number }
  >();
  if (!booking) {
    throw new BookingValidationError('Booking not found.', 404);
  }

  const decision = customerCancelDecision(booking, policy, now);
  if (!decision.allowed) {
    throw new BookingValidationError(decision.reason ?? 'This booking cannot be cancelled online.', 409);
  }

  const updated = await Booking.findOneAndUpdate(
    { _id, customer, status: booking.status, date: booking.date, startTime: booking.startTime },
    {
      $set: {
        status: 'CANCELLED',
        cancelledAt: now,
        cancelledBy: 'customer',
        ...(cancellationReason ? { cancellationReason } : {}),
      },
      $push: historyPush({
        at: now,
        actor: 'customer',
        action: 'status',
        fromStatus: booking.status,
        toStatus: 'CANCELLED',
      }),
    },
    { new: true }
  ).lean<LeanBookingForResult>();

  if (!updated) {
    throw new BookingValidationError('This booking changed while you were cancelling it. Please refresh and try again.', 409);
  }

  return toResult(updated, false);
}

export interface RescheduleRequest {
  date: string;
  slotStart: string;
}

export async function rescheduleBookingAsCustomer(
  customerId: string,
  bookingId: string,
  request: RescheduleRequest,
  now: Date = new Date()
): Promise<BookingResult> {
  const customer = assertCustomerId(customerId);
  const _id = assertBookingId(bookingId);
  const { date, slotStart } = request ?? ({} as RescheduleRequest);

  if (typeof slotStart !== 'string' || !TIME_RE.test(slotStart)) {
    throw new BookingValidationError('slotStart is required. Please select a time slot.');
  }
  try {
    assertBookableDateFormat(date, now);
  } catch (err) {
    rethrowAsBookingError(err);
  }

  const policy = getBookingPolicy();
  const newDate = isoDateToUtcMidnight(date);

  try {
    return await runTransaction(async (session) => {
      const booking = await Booking.findOne({ _id, customer }).session(session);
      if (!booking) {
        throw new BookingValidationError('Booking not found.', 404);
      }

      const decision = customerRescheduleDecision(booking, policy, now);
      if (!decision.allowed) {
        throw new BookingValidationError(decision.reason ?? 'This booking cannot be rescheduled online.', 409);
      }

      if (utcMidnightToIsoDate(booking.date) === date && booking.startTime === slotStart) {
        throw new BookingValidationError('Please choose a different date or time.');
      }

      if (!(await lockVendorSchedule(booking.vendor, session))) {
        throw new BookingValidationError('This artist is no longer available. Please contact us about this booking.', 409);
      }

      const vendor = await Vendor.findOne({ _id: booking.vendor, 'flags.isActive': true })
        .select('_id businessMeta.bookingLeadTimeDays')
        .session(session)
        .lean<{ _id: Types.ObjectId; businessMeta?: { bookingLeadTimeDays?: number } }>();
      const service = vendor
        ? await Service.findOne({ _id: booking.service, vendor: vendor._id, 'flags.isActive': true })
            .session(session)
            .lean<{ duration: { baseDurationMinutes: number; bufferMinutes: number } }>()
        : null;
      if (!vendor || !service) {
        throw new BookingValidationError(
          'This artist or service is not currently accepting online changes. Please contact us about this booking.',
          409
        );
      }

      const day = await computeDaySlots({
        vendorId: vendor._id,
        durationMinutes: serviceDurationMinutes(service),
        date,
        leadTimeDays: vendor.businessMeta?.bookingLeadTimeDays ?? 0,
        now,
        session,
        excludeBookingId: booking._id as Types.ObjectId,
      });
      assertSlotBookable(day, slotStart);

      const endTime = minutesToTime(parseTimeToMinutes(slotStart) + day.durationMinutes);
      const fromStatus = booking.status;
      const entry: IBookingHistoryEntry = {
        at: now,
        actor: 'customer',
        action: 'rescheduled',
        fromStatus,
        toStatus: 'PENDING',
        fromDate: booking.date,
        fromStartTime: booking.startTime,
        fromEndTime: booking.endTime,
        toDate: newDate,
        toStartTime: slotStart,
        toEndTime: endTime,
      };

      const updated = await Booking.findOneAndUpdate(
        { _id, customer, status: fromStatus, date: booking.date, startTime: booking.startTime },
        {
          $set: {
            date: newDate,
            startTime: slotStart,
            endTime,
            status: 'PENDING',
            lastRescheduledAt: now,
          },
          $unset: { confirmedAt: '' },
          $inc: { rescheduleCount: 1 },
          $push: historyPush(entry),
        },
        { new: true, session, runValidators: true }
      ).lean<LeanBookingForResult>();

      if (!updated) {
        throw new BookingValidationError('This booking changed while you were rescheduling it. Please refresh and try again.', 409);
      }

      return toResult(updated, false);
    });
  } catch (err) {
    if (isDuplicateKey(err)) {
      throw new BookingValidationError('That time was just booked by someone else. Please choose another slot.', 409);
    }
    rethrowAsBookingError(err);
  }
}

export async function getRescheduleAvailability(
  customerId: string,
  bookingId: string,
  date: string,
  now: Date = new Date()
) {
  const customer = assertCustomerId(customerId);
  const _id = assertBookingId(bookingId);
  const policy = getBookingPolicy();

  const booking = await Booking.findOne({ _id, customer })
    .select('vendor service status date startTime rescheduleCount')
    .populate('vendor', 'slug flags.isActive')
    .lean<{
      vendor?: { slug: string; flags?: { isActive?: boolean } } | null;
      service: Types.ObjectId;
      status: BookingStatus;
      date: Date;
      startTime: string;
      rescheduleCount?: number;
    }>();
  if (!booking) {
    throw new BookingValidationError('Booking not found.', 404);
  }

  const decision = customerRescheduleDecision(booking, policy, now);
  if (!decision.allowed) {
    throw new BookingValidationError(decision.reason ?? 'This booking cannot be rescheduled online.', 409);
  }
  if (!booking.vendor?.flags?.isActive) {
    throw new BookingValidationError('This artist is not currently accepting online changes. Please contact us about this booking.', 409);
  }

  try {
    return await getDailyAvailability({
      vendorSlug: booking.vendor.slug,
      serviceId: booking.service.toString(),
      date,
      now,
      excludeBookingId: _id.toString(),
    });
  } catch (err) {
    rethrowAsBookingError(err);
  }
}

export interface UpdateBookingStatusRequest {
  bookingId: string;
  status: BookingStatus;
  adminNotes?: string;
}

export async function updateBookingStatus(
  request: UpdateBookingStatusRequest,
  now: Date = new Date()
): Promise<BookingResult> {
  const { bookingId, status, adminNotes } = request;

  const _id = assertBookingId(bookingId);
  if (!BOOKING_STATUSES.includes(status)) {
    throw new BookingValidationError(`status must be one of: ${BOOKING_STATUSES.join(', ')}.`);
  }
  if (adminNotes !== undefined && (typeof adminNotes !== 'string' || adminNotes.trim().length > 500)) {
    throw new BookingValidationError('adminNotes must be 500 characters or fewer.');
  }

  const booking = await Booking.findById(_id).lean<LeanBookingForResult>();
  if (!booking) {
    throw new BookingValidationError('Booking not found.', 404);
  }

  const allowed = BOOKING_STATUS_TRANSITIONS[booking.status];
  if (!allowed.includes(status)) {
    throw new BookingValidationError(
      `Cannot transition a ${booking.status} booking to ${status}. Allowed: ${allowed.length ? allowed.join(', ') : 'none'}.`,
      409
    );
  }

  if (status === 'COMPLETED' && appointmentStartInstant(booking.date, booking.startTime).getTime() > now.getTime()) {
    throw new BookingValidationError('A booking can only be marked completed once its appointment time has passed.', 409);
  }

  const $set: Record<string, unknown> = { status };
  if (status === 'CONFIRMED') $set.confirmedAt = now;
  if (status === 'COMPLETED') $set.completedAt = now;
  if (status === 'CANCELLED') {
    $set.cancelledAt = now;
    $set.cancelledBy = 'admin';
  }
  const trimmedNotes = typeof adminNotes === 'string' ? adminNotes.trim() : undefined;
  const $unset: Record<string, ''> = {};
  if (trimmedNotes !== undefined) {
    if (trimmedNotes) $set.adminNotes = trimmedNotes;
    else $unset.adminNotes = '';
  }

  const updated = await Booking.findOneAndUpdate(
    { _id, status: booking.status },
    {
      $set,
      ...(Object.keys($unset).length ? { $unset } : {}),
      $push: historyPush({
        at: now,
        actor: 'admin',
        action: 'status',
        fromStatus: booking.status,
        toStatus: status,
        ...(trimmedNotes ? { note: trimmedNotes.slice(0, 300) } : {}),
      }),
    },
    { new: true }
  ).lean<LeanBookingForResult>();

  if (!updated) {
    throw new BookingValidationError('This booking was changed by someone else. Refresh the page and try again.', 409);
  }

  return toResult(updated, false);
}

import { Types } from 'mongoose';
import Vendor from '@/lib/db/models/Vendor';
import Booking, { BOOKING_STATUS_TRANSITIONS, BOOKING_STATUSES } from '@/lib/db/models/Booking';
import type { BookingStatus } from '@/lib/db/models/Booking';
import { calculateBookingEstimate, EstimateValidationError } from './ServiceManager';
import type { AddOnRequest } from './ServiceManager';
import { getDailyAvailability, AvailabilityValidationError } from './AvailabilityManager';
import { parseTimeToMinutes, minutesToTime } from '@/lib/db/utils/time';
import type { EstimateLineItem } from '@/types/artist';

export class BookingValidationError extends Error {
  readonly statusCode: 400 | 401 | 403 | 404 | 409 | 422;

  constructor(message: string, statusCode: 400 | 401 | 403 | 404 | 409 | 422 = 400) {
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

export async function createBooking(
  customerId: string,
  request: CreateBookingRequest
): Promise<BookingResult> {
  const { artistSlug, anchorServiceId, addOns, date, slotStart, contactInfo, customerNotes, idempotencyKey } =
    request;

  if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
    throw new BookingValidationError('A valid idempotencyKey is required.');
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
  if (!phone) throw new BookingValidationError('contactInfo.phone is required.');
  if (!EMAIL_RE.test(email)) throw new BookingValidationError('contactInfo.email must be a valid email address.');

  if (typeof artistSlug !== 'string' || !artistSlug) {
    throw new BookingValidationError('artistSlug is required.');
  }
  if (typeof slotStart !== 'string' || !slotStart) {
    throw new BookingValidationError('slotStart is required. Please select a time slot.');
  }

  const vendor = await Vendor.findOne({ slug: artistSlug, 'flags.isActive': true }).lean<{
    _id: Types.ObjectId;
    name: string;
  }>();
  if (!vendor) {
    throw new BookingValidationError('Artist not found.', 404);
  }

  let dailyAvailability;
  try {
    dailyAvailability = await getDailyAvailability({ vendorSlug: artistSlug, serviceId: anchorServiceId, date });
  } catch (err) {
    if (err instanceof AvailabilityValidationError) {
      throw new BookingValidationError(err.message, err.statusCode);
    }
    throw err;
  }

  if (!dailyAvailability.configured || !dailyAvailability.isOpen || dailyAvailability.isBlocked) {
    throw new BookingValidationError(
      'This artist is not accepting bookings on the selected date. Please choose another date.',
      409
    );
  }
  if (!dailyAvailability.slots.includes(slotStart)) {
    throw new BookingValidationError(
      'The selected time is no longer available. Please choose another slot.',
      409
    );
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

  const startMinute = parseTimeToMinutes(slotStart);
  const endTime = minutesToTime(startMinute + dailyAvailability.durationMinutes);

  const [y, m, d] = date.split('-').map(Number);
  const bookingDate = new Date(Date.UTC(y, m - 1, d));

  try {
    const booking = await Booking.create({
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
      customerNotes: customerNotes?.trim() || undefined,
      idempotencyKey,
    });

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
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      const keyPattern = (err as { keyPattern?: Record<string, unknown> }).keyPattern;
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
    throw err;
  }
}

export interface UpdateBookingStatusRequest {
  bookingId: string;
  status: BookingStatus;
  adminNotes?: string;
}

export async function updateBookingStatus(request: UpdateBookingStatusRequest): Promise<BookingResult> {
  const { bookingId, status, adminNotes } = request;

  if (!Types.ObjectId.isValid(bookingId)) {
    throw new BookingValidationError('bookingId must be a valid booking ID.');
  }
  if (!BOOKING_STATUSES.includes(status)) {
    throw new BookingValidationError(`status must be one of: ${BOOKING_STATUSES.join(', ')}.`);
  }

  const booking = await Booking.findById(bookingId);
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

  booking.status = status;
  if (typeof adminNotes === 'string') {
    booking.adminNotes = adminNotes.trim() || undefined;
  }
  await booking.save();

  return toResult(
    {
      _id: booking._id as Types.ObjectId,
      status: booking.status,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      priceSnapshot: booking.priceSnapshot,
    },
    false
  );
}

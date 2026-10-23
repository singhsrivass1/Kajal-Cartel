import { Types } from 'mongoose';
import Booking from '@/lib/db/models/Booking';
import Review from '@/lib/db/models/Review';
import type { BookingStatus } from '@/lib/db/models/Booking';
import { refFromId } from './BookingManager';
import { getBookingPolicy } from '@/lib/booking/policy';
import {
  bookingPhase,
  customerCancelDecision,
  customerRescheduleDecision,
  reviewDecision,
} from '@/lib/booking/rules';
import type { BookingPhase, BookingPolicyView, RuleDecision } from '@/lib/booking/rules';
import { durationBetween, utcMidnightToIsoDate } from '@/lib/db/utils/time';

export interface CustomerBookingSummary {
  id: string;
  ref: string;
  status: BookingStatus;
  phase: BookingPhase;
  vendorName: string;
  vendorSlug: string | null;
  vendorImage: string | null;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  total: number;
  depositAmount: number;
  createdAt: string;
  rescheduleCount: number;
  canCancel: RuleDecision;
  canReschedule: RuleDecision;
  canReview: RuleDecision;
  hasReview: boolean;
}

export interface BookingTimelineEntry {
  at: string;
  label: string;
}

export interface CustomerBookingReview {
  id: string;
  rating: number;
  title?: string;
  body: string;
  status: 'published' | 'hidden';
  createdAt: string;
  editedAt?: string;
}

export interface CustomerBookingDetail extends CustomerBookingSummary {
  serviceId: string;
  artistAcceptsChanges: boolean;
  leadTimeDays: number;
  lineItems: Array<{ name: string; quantity: number; subtotalINR: number; discountLabel?: string }>;
  contactInfo: { name: string; phone: string; email: string };
  customerNotes?: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelledBy?: 'customer' | 'admin';
  cancellationReason?: string;
  timeline: BookingTimelineEntry[];
  review: CustomerBookingReview | null;
  policy: BookingPolicyView;
}

const STATUS_WORDS: Record<BookingStatus, string> = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
};

function formatSlot(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

function formatDay(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function timelineFor(b: Record<string, any>): BookingTimelineEntry[] {
  const history: Array<Record<string, any>> = Array.isArray(b.history) ? b.history : [];
  if (history.length === 0) {
    return [{ at: new Date(b.createdAt).toISOString(), label: 'Booking request sent' }];
  }
  return history.map((h) => {
    let label: string;
    if (h.action === 'created') {
      label = 'Booking request sent';
    } else if (h.action === 'rescheduled') {
      label = `Rescheduled by you from ${formatDay(h.fromDate)}, ${formatSlot(h.fromStartTime)} to ${formatDay(h.toDate)}, ${formatSlot(h.toStartTime)}`;
    } else {
      const who = h.actor === 'customer' ? 'you' : 'Kajal Cartel';
      const word = STATUS_WORDS[h.toStatus as BookingStatus] ?? String(h.toStatus).toLowerCase();
      label = h.toStatus === 'CANCELLED' ? `Cancelled by ${who}` : `Booking ${word}`;
    }
    return { at: new Date(h.at).toISOString(), label };
  });
}

function summarize(
  b: Record<string, any>,
  policy: BookingPolicyView,
  now: Date,
  hasReview: boolean
): CustomerBookingSummary {
  const timing = { status: b.status as BookingStatus, date: b.date, startTime: b.startTime, rescheduleCount: b.rescheduleCount ?? 0 };
  const anchorSnapshotName = b.priceSnapshot?.lineItems?.[0]?.name;
  return {
    id: b._id.toString(),
    ref: refFromId(b._id),
    status: b.status,
    phase: bookingPhase(timing, now),
    vendorName: b.vendor?.name ?? 'Artist no longer listed',
    vendorSlug: b.vendor?.flags?.isActive ? b.vendor.slug : null,
    vendorImage: b.vendor?.profileImageUrl || null,
    serviceName: b.service?.name ?? anchorSnapshotName ?? 'Service no longer listed',
    date: utcMidnightToIsoDate(b.date),
    startTime: b.startTime,
    endTime: b.endTime,
    durationMinutes: durationBetween(b.startTime, b.endTime),
    total: b.priceSnapshot?.total ?? 0,
    depositAmount: b.priceSnapshot?.depositAmount ?? 0,
    createdAt: new Date(b.createdAt).toISOString(),
    rescheduleCount: b.rescheduleCount ?? 0,
    canCancel: customerCancelDecision(timing, policy, now),
    canReschedule: customerRescheduleDecision(timing, policy, now),
    canReview: reviewDecision(
      { status: b.status, date: b.date, startTime: b.startTime, completedAt: b.completedAt, hasReview: hasReview || Boolean(b.reviewedAt) },
      policy,
      now
    ),
    hasReview: hasReview || Boolean(b.reviewedAt),
  };
}

export async function listCustomerBookings(customerId: string, now: Date = new Date()): Promise<CustomerBookingSummary[]> {
  if (!Types.ObjectId.isValid(customerId)) return [];
  const customer = new Types.ObjectId(customerId);
  const policy = getBookingPolicy();

  const docs = await Booking.find({ customer })
    .sort({ date: -1, startTime: -1 })
    .limit(500)
    .populate('vendor', 'name slug profileImageUrl flags.isActive')
    .populate('service', 'name')
    .select('-history -contactInfo -adminNotes -idempotencyKey')
    .lean<Array<Record<string, any>>>();

  const reviewed = new Set(
    (
      await Review.find({ booking: { $in: docs.map((d) => d._id) }, customer })
        .select('booking')
        .lean<Array<{ booking: Types.ObjectId }>>()
    ).map((r) => r.booking.toString())
  );

  return docs.map((b) => summarize(b, policy, now, reviewed.has(b._id.toString())));
}

export async function getCustomerBookingDetail(
  customerId: string,
  bookingId: string,
  now: Date = new Date()
): Promise<CustomerBookingDetail | null> {
  if (!Types.ObjectId.isValid(customerId) || !Types.ObjectId.isValid(bookingId)) return null;
  const customer = new Types.ObjectId(customerId);
  const policy = getBookingPolicy();

  const b = await Booking.findOne({ _id: new Types.ObjectId(bookingId), customer })
    .populate('vendor', 'name slug profileImageUrl flags.isActive businessMeta.bookingLeadTimeDays')
    .populate('service', 'name flags.isActive')
    .select('-adminNotes -idempotencyKey')
    .lean<Record<string, any>>();
  if (!b) return null;

  const review = await Review.findOne({ booking: b._id, customer })
    .select('rating title body status createdAt editedAt')
    .lean<Record<string, any>>();

  const summary = summarize(b, policy, now, Boolean(review));
  const artistAcceptsChanges = Boolean(b.vendor?.flags?.isActive && b.service?.flags?.isActive);

  return {
    ...summary,
    serviceId: (b.service?._id ?? b.service ?? '').toString(),
    artistAcceptsChanges,
    canReschedule: artistAcceptsChanges
      ? summary.canReschedule
      : { allowed: false, reason: 'This artist or service is not currently accepting online changes. Please contact us about this booking.' },
    leadTimeDays: b.vendor?.businessMeta?.bookingLeadTimeDays ?? 0,
    lineItems: (b.priceSnapshot?.lineItems ?? []).map((li: Record<string, any>) => ({
      name: li.name,
      quantity: li.quantity,
      subtotalINR: li.subtotalINR,
      discountLabel: li.discountLabel || undefined,
    })),
    contactInfo: {
      name: b.contactInfo?.name ?? '',
      phone: b.contactInfo?.phone ?? '',
      email: b.contactInfo?.email ?? '',
    },
    customerNotes: b.customerNotes || undefined,
    confirmedAt: b.confirmedAt ? new Date(b.confirmedAt).toISOString() : undefined,
    completedAt: b.completedAt ? new Date(b.completedAt).toISOString() : undefined,
    cancelledAt: b.cancelledAt ? new Date(b.cancelledAt).toISOString() : undefined,
    cancelledBy: b.cancelledBy,
    cancellationReason: b.cancellationReason || undefined,
    timeline: timelineFor(b),
    review: review
      ? {
          id: review._id.toString(),
          rating: review.rating,
          title: review.title || undefined,
          body: review.body,
          status: review.status,
          createdAt: new Date(review.createdAt).toISOString(),
          editedAt: review.editedAt ? new Date(review.editedAt).toISOString() : undefined,
        }
      : null,
    policy,
  };
}

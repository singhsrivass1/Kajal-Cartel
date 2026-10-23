import { appointmentStartInstant } from '@/lib/db/utils/time';

export type BookingStatusValue = 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED';

export interface BookingPolicyView {
  cancellationCutoffHours: number;
  rescheduleCutoffHours: number;
  maxReschedules: number;
  bookingWindowDays: number;
  reviewWindowDays: number;
}

export interface BookingTiming {
  status: BookingStatusValue;
  date: string | Date;
  startTime: string;
  rescheduleCount?: number;
}

export interface RuleDecision {
  allowed: boolean;
  reason?: string;
}

export type BookingPhase = 'upcoming' | 'awaiting-completion' | 'completed' | 'cancelled';

export const DEPOSIT_PERCENT = 30;
export const ACTIVE_BOOKING_STATUSES: BookingStatusValue[] = ['PENDING', 'CONFIRMED'];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function hoursLabel(hours: number): string {
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

export function bookingPhase(booking: BookingTiming, now: Date = new Date()): BookingPhase {
  if (booking.status === 'CANCELLED' || booking.status === 'DECLINED') return 'cancelled';
  if (booking.status === 'COMPLETED') return 'completed';
  return appointmentStartInstant(booking.date, booking.startTime).getTime() > now.getTime()
    ? 'upcoming'
    : 'awaiting-completion';
}

export function customerCancelDecision(
  booking: BookingTiming,
  policy: BookingPolicyView,
  now: Date = new Date()
): RuleDecision {
  if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
    return { allowed: false, reason: 'Only pending requests and confirmed bookings can be cancelled.' };
  }
  const start = appointmentStartInstant(booking.date, booking.startTime).getTime();
  if (start <= now.getTime()) {
    return { allowed: false, reason: 'This appointment time has already passed.' };
  }
  if (booking.status === 'CONFIRMED' && now.getTime() > start - policy.cancellationCutoffHours * HOUR_MS) {
    return {
      allowed: false,
      reason: `Confirmed bookings can be cancelled online up to ${hoursLabel(policy.cancellationCutoffHours)} before the appointment.`,
    };
  }
  return { allowed: true };
}

export function customerRescheduleDecision(
  booking: BookingTiming,
  policy: BookingPolicyView,
  now: Date = new Date()
): RuleDecision {
  if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
    return { allowed: false, reason: 'Only pending requests and confirmed bookings can be rescheduled.' };
  }
  if ((booking.rescheduleCount ?? 0) >= policy.maxReschedules) {
    return {
      allowed: false,
      reason:
        policy.maxReschedules === 0
          ? 'Online rescheduling is not available.'
          : `This booking has already been rescheduled the maximum of ${policy.maxReschedules} time${policy.maxReschedules === 1 ? '' : 's'}.`,
    };
  }
  const start = appointmentStartInstant(booking.date, booking.startTime).getTime();
  if (now.getTime() > start - policy.rescheduleCutoffHours * HOUR_MS) {
    return {
      allowed: false,
      reason: `Bookings can be rescheduled online up to ${hoursLabel(policy.rescheduleCutoffHours)} before the appointment.`,
    };
  }
  return { allowed: true };
}

export interface ReviewEligibilityInput {
  status: BookingStatusValue;
  date: string | Date;
  startTime: string;
  completedAt?: string | Date | null;
  hasReview: boolean;
}

export function reviewDecision(
  booking: ReviewEligibilityInput,
  policy: BookingPolicyView,
  now: Date = new Date()
): RuleDecision {
  if (booking.status !== 'COMPLETED') {
    return { allowed: false, reason: 'Reviews open once your appointment has been marked as completed.' };
  }
  if (booking.hasReview) {
    return { allowed: false, reason: 'You have already reviewed this appointment.' };
  }
  const reference = booking.completedAt
    ? new Date(booking.completedAt).getTime()
    : appointmentStartInstant(booking.date, booking.startTime).getTime();
  if (now.getTime() > reference + policy.reviewWindowDays * DAY_MS) {
    return {
      allowed: false,
      reason: `Reviews can be left within ${policy.reviewWindowDays} days of a completed appointment.`,
    };
  }
  return { allowed: true };
}

export function describeBookingPolicy(policy: BookingPolicyView): string[] {
  const lines = [
    'Submitting the booking form sends a request. Your appointment is only confirmed once Kajal Cartel confirms it.',
    'Pending requests can be withdrawn online at any time before the appointment.',
    `Confirmed bookings can be cancelled online up to ${hoursLabel(policy.cancellationCutoffHours)} before the appointment start time.`,
  ];
  if (policy.maxReschedules > 0) {
    lines.push(
      `Bookings can be rescheduled online up to ${hoursLabel(policy.rescheduleCutoffHours)} before the appointment, a maximum of ${policy.maxReschedules} time${policy.maxReschedules === 1 ? '' : 's'}. A rescheduled booking returns to pending until it is confirmed again.`
    );
  } else {
    lines.push('Online rescheduling is not available.');
  }
  lines.push(
    `Estimates include a ${DEPOSIT_PERCENT}% deposit that becomes due when a booking is confirmed. Payments are not taken on this website.`,
    'Each artist sets their own minimum advance notice, shown on their profile.',
    `Appointments can be requested up to ${policy.bookingWindowDays} days ahead.`,
    `After a completed appointment, you can leave one review per booking within ${policy.reviewWindowDays} days.`
  );
  return lines;
}

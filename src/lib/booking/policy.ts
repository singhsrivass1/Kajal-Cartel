import type { BookingPolicyView } from './rules';

const DEFAULT_POLICY: BookingPolicyView = {
  cancellationCutoffHours: 48,
  rescheduleCutoffHours: 48,
  maxReschedules: 2,
  bookingWindowDays: 365,
  reviewWindowDays: 180,
};

const LIMITS: Record<keyof BookingPolicyView, { env: string; min: number; max: number }> = {
  cancellationCutoffHours: { env: 'BOOKING_CANCELLATION_CUTOFF_HOURS', min: 0, max: 24 * 60 },
  rescheduleCutoffHours: { env: 'BOOKING_RESCHEDULE_CUTOFF_HOURS', min: 0, max: 24 * 60 },
  maxReschedules: { env: 'BOOKING_MAX_RESCHEDULES', min: 0, max: 10 },
  bookingWindowDays: { env: 'BOOKING_WINDOW_DAYS', min: 1, max: 3 * 365 },
  reviewWindowDays: { env: 'REVIEW_WINDOW_DAYS', min: 1, max: 3 * 365 },
};

const warned = new Set<string>();

function readInteger(key: keyof BookingPolicyView): number {
  const { env, min, max } = LIMITS[key];
  const raw = process.env[env];
  if (raw === undefined || raw.trim() === '') return DEFAULT_POLICY[key];
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    if (!warned.has(env)) {
      warned.add(env);
      console.warn(`[booking-policy] Ignoring ${env}: expected an integer from ${min} to ${max}. Using ${DEFAULT_POLICY[key]}.`);
    }
    return DEFAULT_POLICY[key];
  }
  return value;
}

export function getBookingPolicy(): BookingPolicyView {
  return {
    cancellationCutoffHours: readInteger('cancellationCutoffHours'),
    rescheduleCutoffHours: readInteger('rescheduleCutoffHours'),
    maxReschedules: readInteger('maxReschedules'),
    bookingWindowDays: readInteger('bookingWindowDays'),
    reviewWindowDays: readInteger('reviewWindowDays'),
  };
}

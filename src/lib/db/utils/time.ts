export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60).toString().padStart(2, '0');
  const m = (total % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export const BUSINESS_TIME_ZONE = 'Asia/Kolkata';
export const BUSINESS_UTC_OFFSET_MINUTES = 330;

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const parsed = isoDateToUtcMidnight(value);
  return !Number.isNaN(parsed.getTime()) && utcMidnightToIsoDate(parsed) === value;
}

export function isoDateToUtcMidnight(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function utcMidnightToIsoDate(date: Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

export function addDaysToIsoDate(iso: string, days: number): string {
  return utcMidnightToIsoDate(new Date(isoDateToUtcMidnight(iso).getTime() + days * DAY_MS));
}

export function businessTodayIso(now: Date = new Date()): string {
  return utcMidnightToIsoDate(new Date(now.getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60_000));
}

export function businessNowMinutes(now: Date = new Date()): number {
  const shifted = new Date(now.getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function appointmentStartInstant(date: Date | string, startTime: string): Date {
  const midnight = typeof date === 'string' ? isoDateToUtcMidnight(date) : new Date(date);
  return new Date(midnight.getTime() + (parseTimeToMinutes(startTime) - BUSINESS_UTC_OFFSET_MINUTES) * 60_000);
}

export function durationBetween(startTime: string, endTime: string): number {
  return parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
}

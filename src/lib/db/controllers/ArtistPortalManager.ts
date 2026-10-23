import { Types } from 'mongoose';
import Booking from '@/lib/db/models/Booking';
import VendorAvailability from '@/lib/db/models/VendorAvailability';
import BlockedDate from '@/lib/db/models/BlockedDate';
import { refFromId } from './BookingManager';
import { addDaysToIsoDate, businessTodayIso, isoDateToUtcMidnight, utcMidnightToIsoDate } from '@/lib/db/utils/time';

export interface ArtistAppointment {
  id: string;
  ref: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'DECLINED';
  date: string;
  startTime: string;
  endTime: string;
  serviceName: string;
  partySummary: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  customerNotes?: string;
}

export interface ArtistSchedule {
  upcoming: ArtistAppointment[];
  recent: ArtistAppointment[];
  workingHours: Array<{ dayOfWeek: number; isOpen: boolean; startTime: string; endTime: string }>;
  slotIntervalMinutes: number | null;
  blockedDates: Array<{ startDate: string; endDate: string; reason?: string }>;
}

function toAppointment(b: Record<string, any>): ArtistAppointment {
  const lineItems: Array<{ name: string; quantity: number }> = b.priceSnapshot?.lineItems ?? [];
  const confirmed = b.status === 'CONFIRMED' || b.status === 'COMPLETED';
  return {
    id: b._id.toString(),
    ref: refFromId(b._id),
    status: b.status,
    date: utcMidnightToIsoDate(b.date),
    startTime: b.startTime,
    endTime: b.endTime,
    serviceName: b.service?.name ?? lineItems[0]?.name ?? 'Service',
    partySummary: lineItems.slice(1).map((li) => `${li.quantity}× ${li.name}`).join(', '),
    clientName: b.contactInfo?.name ?? '',
    clientPhone: confirmed ? b.contactInfo?.phone ?? null : null,
    clientEmail: confirmed ? b.contactInfo?.email ?? null : null,
    customerNotes: b.customerNotes || undefined,
  };
}

export async function getArtistSchedule(vendorId: string, now: Date = new Date()): Promise<ArtistSchedule> {
  if (!Types.ObjectId.isValid(vendorId)) throw new Error('Invalid vendor id.');
  const vendor = new Types.ObjectId(vendorId);
  const todayIso = businessTodayIso(now);
  const today = isoDateToUtcMidnight(todayIso);
  const monthAgo = isoDateToUtcMidnight(addDaysToIsoDate(todayIso, -30));
  const select = 'service status date startTime endTime priceSnapshot.lineItems contactInfo customerNotes';

  const [upcoming, recent, availability, blocked] = await Promise.all([
    Booking.find({ vendor, status: { $in: ['PENDING', 'CONFIRMED'] }, date: { $gte: today } })
      .sort({ date: 1, startTime: 1 })
      .limit(200)
      .select(select)
      .populate('service', 'name')
      .lean<Array<Record<string, any>>>(),
    Booking.find({ vendor, date: { $gte: monthAgo, $lt: today } })
      .sort({ date: -1, startTime: -1 })
      .limit(100)
      .select(select)
      .populate('service', 'name')
      .lean<Array<Record<string, any>>>(),
    VendorAvailability.findOne({ vendor }).lean<Record<string, any>>(),
    BlockedDate.find({ vendor, endDate: { $gte: today } }).sort({ startDate: 1 }).lean<Array<Record<string, any>>>(),
  ]);

  return {
    upcoming: upcoming.map(toAppointment),
    recent: recent.map(toAppointment),
    workingHours: (availability?.workingHours ?? []).map((w: Record<string, any>) => ({
      dayOfWeek: w.dayOfWeek,
      isOpen: w.isOpen,
      startTime: w.startTime,
      endTime: w.endTime,
    })),
    slotIntervalMinutes: availability?.slotIntervalMinutes ?? null,
    blockedDates: blocked.map((b) => ({
      startDate: utcMidnightToIsoDate(b.startDate),
      endDate: utcMidnightToIsoDate(b.endDate),
      reason: b.reason || undefined,
    })),
  };
}

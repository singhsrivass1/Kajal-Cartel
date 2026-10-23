import { Types } from 'mongoose';
import Booking, { BOOKING_STATUSES, BOOKING_STATUS_TRANSITIONS } from '@/lib/db/models/Booking';
import type { BookingStatus } from '@/lib/db/models/Booking';
import Review from '@/lib/db/models/Review';
import User from '@/lib/db/models/User';
import Vendor from '@/lib/db/models/Vendor';
import Service from '@/lib/db/models/Service';
import { refFromId } from './BookingManager';
import { VendorAdminError } from './VendorAdminManager';
import { addDaysToIsoDate, businessTodayIso, isIsoDate, isoDateToUtcMidnight, utcMidnightToIsoDate } from '@/lib/db/utils/time';
import { bookingPhase } from '@/lib/booking/rules';

const ACTIVE: BookingStatus[] = ['PENDING', 'CONFIRMED'];

export interface AdminOverview {
  counts: Record<BookingStatus, number>;
  pendingRequests: number;
  upcomingConfirmed7: number;
  upcomingConfirmed30: number;
  awaitingCompletion: number;
  completedValueINR: number;
  upcomingConfirmedValueINR: number;
  customers: number;
  activeArtists: number;
  draftArtists: number;
  reviews: { published: number; hidden: number };
  nextAppointments: AdminBookingRow[];
  oldestPending: AdminBookingRow[];
}

export interface AdminBookingRow {
  id: string;
  ref: string;
  status: BookingStatus;
  vendorName: string;
  vendorSlug: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  total: number;
  depositAmount: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  customerNotes?: string;
  adminNotes?: string;
  createdAt: string;
  rescheduleCount: number;
  awaitingCompletion: boolean;
}

function toRow(b: Record<string, any>, now: Date): AdminBookingRow {
  return {
    id: b._id.toString(),
    ref: refFromId(b._id),
    status: b.status,
    vendorName: b.vendor?.name ?? 'Removed artist',
    vendorSlug: b.vendor?.slug ?? '',
    serviceName: b.service?.name ?? b.priceSnapshot?.lineItems?.[0]?.name ?? 'Removed service',
    date: utcMidnightToIsoDate(b.date),
    startTime: b.startTime,
    endTime: b.endTime,
    total: b.priceSnapshot?.total ?? 0,
    depositAmount: b.priceSnapshot?.depositAmount ?? 0,
    contactName: b.contactInfo?.name ?? '',
    contactPhone: b.contactInfo?.phone ?? '',
    contactEmail: b.contactInfo?.email ?? '',
    customerNotes: b.customerNotes || undefined,
    adminNotes: b.adminNotes || undefined,
    createdAt: new Date(b.createdAt).toISOString(),
    rescheduleCount: b.rescheduleCount ?? 0,
    awaitingCompletion: bookingPhase({ status: b.status, date: b.date, startTime: b.startTime }, now) === 'awaiting-completion',
  };
}

const ROW_SELECT = 'vendor service status date startTime endTime priceSnapshot contactInfo customerNotes adminNotes createdAt rescheduleCount';

export async function getAdminOverview(now: Date = new Date()): Promise<AdminOverview> {
  const today = isoDateToUtcMidnight(businessTodayIso(now));
  const in7 = isoDateToUtcMidnight(addDaysToIsoDate(businessTodayIso(now), 7));
  const in30 = isoDateToUtcMidnight(addDaysToIsoDate(businessTodayIso(now), 30));

  const [statusRows, upcoming7, upcoming30, awaiting, valueRows, upcomingValue, customers, artistRows, reviewRows, next, pending] = await Promise.all([
    Booking.aggregate<{ _id: BookingStatus; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.countDocuments({ status: 'CONFIRMED', date: { $gte: today, $lt: in7 } }),
    Booking.countDocuments({ status: 'CONFIRMED', date: { $gte: today, $lt: in30 } }),
    Booking.countDocuments({ status: { $in: ACTIVE }, date: { $lt: today } }),
    Booking.aggregate<{ total: number }>([{ $match: { status: 'COMPLETED' } }, { $group: { _id: null, total: { $sum: '$priceSnapshot.total' } } }]),
    Booking.aggregate<{ total: number }>([
      { $match: { status: 'CONFIRMED', date: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$priceSnapshot.total' } } },
    ]),
    User.countDocuments({ role: { $ne: 'admin' } }),
    Vendor.aggregate<{ _id: boolean; count: number }>([{ $group: { _id: '$flags.isActive', count: { $sum: 1 } } }]),
    Review.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.find({ status: 'CONFIRMED', date: { $gte: today } })
      .sort({ date: 1, startTime: 1 })
      .limit(6)
      .select(ROW_SELECT)
      .populate('vendor', 'name slug')
      .populate('service', 'name')
      .lean<Array<Record<string, any>>>(),
    Booking.find({ status: 'PENDING' })
      .sort({ createdAt: 1 })
      .limit(6)
      .select(ROW_SELECT)
      .populate('vendor', 'name slug')
      .populate('service', 'name')
      .lean<Array<Record<string, any>>>(),
  ]);

  const counts = Object.fromEntries(BOOKING_STATUSES.map((s) => [s, 0])) as Record<BookingStatus, number>;
  for (const row of statusRows) if (row._id in counts) counts[row._id] = row.count;
  const reviewCounts = Object.fromEntries(reviewRows.map((r) => [r._id, r.count]));

  return {
    counts,
    pendingRequests: counts.PENDING,
    upcomingConfirmed7: upcoming7,
    upcomingConfirmed30: upcoming30,
    awaitingCompletion: awaiting,
    completedValueINR: valueRows[0]?.total ?? 0,
    upcomingConfirmedValueINR: upcomingValue[0]?.total ?? 0,
    customers,
    activeArtists: artistRows.find((r) => r._id === true)?.count ?? 0,
    draftArtists: artistRows.filter((r) => r._id !== true).reduce((sum, r) => sum + r.count, 0),
    reviews: { published: reviewCounts.published ?? 0, hidden: reviewCounts.hidden ?? 0 },
    nextAppointments: next.map((b) => toRow(b, now)),
    oldestPending: pending.map((b) => toRow(b, now)),
  };
}

export interface BookingSearchFilters {
  q?: string;
  status?: string;
  vendor?: string;
  service?: string;
  from?: string;
  to?: string;
  view?: string;
  page?: string;
}

export interface BookingSearchResult {
  rows: AdminBookingRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: Required<Omit<BookingSearchFilters, 'page'>>;
  vendors: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string; vendorId: string }>;
}

const PAGE_SIZE = 25;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function searchBookingsForAdmin(raw: BookingSearchFilters, now: Date = new Date()): Promise<BookingSearchResult> {
  const filters = {
    q: typeof raw.q === 'string' ? raw.q.trim().slice(0, 100) : '',
    status: typeof raw.status === 'string' && (BOOKING_STATUSES as readonly string[]).includes(raw.status) ? raw.status : '',
    vendor: typeof raw.vendor === 'string' && Types.ObjectId.isValid(raw.vendor) ? raw.vendor : '',
    service: typeof raw.service === 'string' && Types.ObjectId.isValid(raw.service) ? raw.service : '',
    from: isIsoDate(raw.from) ? raw.from : '',
    to: isIsoDate(raw.to) ? raw.to : '',
    view: raw.view === 'upcoming' || raw.view === 'awaiting' || raw.view === 'past' ? raw.view : '',
  };
  const page = Math.max(1, Math.min(1000, Number.parseInt(raw.page ?? '1', 10) || 1));
  const today = isoDateToUtcMidnight(businessTodayIso(now));

  const query: Record<string, any> = {};
  if (filters.status) query.status = filters.status;
  if (filters.vendor) query.vendor = new Types.ObjectId(filters.vendor);
  if (filters.service) query.service = new Types.ObjectId(filters.service);
  const dateRange: Record<string, Date> = {};
  if (filters.from) dateRange.$gte = isoDateToUtcMidnight(filters.from);
  if (filters.to) dateRange.$lte = isoDateToUtcMidnight(filters.to);
  if (filters.view === 'upcoming') {
    dateRange.$gte = dateRange.$gte && dateRange.$gte > today ? dateRange.$gte : today;
    if (!filters.status) query.status = { $in: ACTIVE };
  }
  if (filters.view === 'awaiting') {
    dateRange.$lt = today;
    query.status = { $in: ACTIVE };
  }
  if (filters.view === 'past') dateRange.$lt = today;
  if (Object.keys(dateRange).length) query.date = dateRange;

  if (filters.q) {
    const refMatch = filters.q.toUpperCase().match(/^KC-([0-9A-F]{6})$/);
    if (refMatch) {
      query.$expr = { $eq: [{ $toUpper: { $substrCP: [{ $toString: '$_id' }, 18, 6] } }, refMatch[1]] };
    } else {
      const re = new RegExp(escapeRegex(filters.q), 'i');
      query.$or = [{ 'contactInfo.name': re }, { 'contactInfo.email': re }, { 'contactInfo.phone': re }];
    }
  }

  const sort: Record<string, 1 | -1> =
    filters.view === 'upcoming' ? { date: 1, startTime: 1 } : filters.view ? { date: -1, startTime: -1 } : { createdAt: -1 };

  const [rows, total, vendors, services] = await Promise.all([
    Booking.find(query)
      .sort(sort)
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .select(ROW_SELECT)
      .populate('vendor', 'name slug')
      .populate('service', 'name')
      .lean<Array<Record<string, any>>>(),
    Booking.countDocuments(query),
    Vendor.find({}).select('name').sort({ name: 1 }).lean<Array<{ _id: Types.ObjectId; name: string }>>(),
    Service.find({}).select('name vendor').sort({ name: 1 }).lean<Array<{ _id: Types.ObjectId; name: string; vendor: Types.ObjectId }>>(),
  ]);

  return {
    rows: rows.map((b) => toRow(b, now)),
    total,
    page,
    pageSize: PAGE_SIZE,
    filters,
    vendors: vendors.map((v) => ({ id: v._id.toString(), name: v.name })),
    services: services.map((s) => ({ id: s._id.toString(), name: s.name, vendorId: s.vendor.toString() })),
  };
}

export interface AdminBookingDetail extends AdminBookingRow {
  customerId: string;
  customerAccountEmail: string | null;
  lineItems: Array<{ name: string; quantity: number; subtotalINR: number; discountLabel?: string }>;
  allowedTransitions: BookingStatus[];
  history: Array<{ at: string; actor: string; action: string; fromStatus?: string; toStatus?: string; detail?: string; note?: string }>;
  cancellationReason?: string;
  review: { id: string; rating: number; status: string } | null;
}

export async function getBookingForAdmin(bookingId: string, now: Date = new Date()): Promise<AdminBookingDetail | null> {
  if (!Types.ObjectId.isValid(bookingId)) return null;
  const b = await Booking.findById(bookingId)
    .populate('vendor', 'name slug')
    .populate('service', 'name')
    .populate('customer', 'email')
    .lean<Record<string, any>>();
  if (!b) return null;
  const review = await Review.findOne({ booking: b._id }).select('rating status').lean<{ _id: Types.ObjectId; rating: number; status: string }>();

  return {
    ...toRow(b, now),
    customerId: (b.customer?._id ?? b.customer)?.toString() ?? '',
    customerAccountEmail: b.customer?.email ?? null,
    lineItems: (b.priceSnapshot?.lineItems ?? []).map((li: Record<string, any>) => ({
      name: li.name,
      quantity: li.quantity,
      subtotalINR: li.subtotalINR,
      discountLabel: li.discountLabel || undefined,
    })),
    allowedTransitions: BOOKING_STATUS_TRANSITIONS[b.status as BookingStatus] ?? [],
    history: (b.history ?? []).map((h: Record<string, any>) => ({
      at: new Date(h.at).toISOString(),
      actor: h.actor,
      action: h.action,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      detail:
        h.action === 'rescheduled' && h.fromDate && h.toDate
          ? `${utcMidnightToIsoDate(h.fromDate)} ${h.fromStartTime} → ${utcMidnightToIsoDate(h.toDate)} ${h.toStartTime}`
          : undefined,
      note: h.note || undefined,
    })),
    cancellationReason: b.cancellationReason || undefined,
    review: review ? { id: review._id.toString(), rating: review.rating, status: review.status } : null,
  };
}

export interface AdminCustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  joinedAt: string;
  bookingCount: number;
  activeBookingCount: number;
  lastBookingAt: string | null;
  linkedArtist: string | null;
}

export async function listCustomersForAdmin(q: string | undefined, page = 1): Promise<{ rows: AdminCustomerRow[]; total: number; page: number; pageSize: number; q: string }> {
  const term = typeof q === 'string' ? q.trim().slice(0, 100) : '';
  const query: Record<string, any> = { role: { $ne: 'admin' } };
  if (term) {
    const re = new RegExp(escapeRegex(term), 'i');
    query.$or = [{ name: re }, { email: re }, { phone: re }];
  }
  const safePage = Math.max(1, Math.min(1000, page || 1));

  const [users, total] = await Promise.all([
    User.find(query)
      .select('name email phone role createdAt artistVendor')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate('artistVendor', 'name')
      .lean<Array<Record<string, any>>>(),
    User.countDocuments(query),
  ]);

  const ids = users.map((u) => u._id as Types.ObjectId);
  const stats = ids.length
    ? await Booking.aggregate<{ _id: Types.ObjectId; count: number; active: number; last: Date }>([
        { $match: { customer: { $in: ids } } },
        {
          $group: {
            _id: '$customer',
            count: { $sum: 1 },
            active: { $sum: { $cond: [{ $in: ['$status', ACTIVE] }, 1, 0] } },
            last: { $max: '$createdAt' },
          },
        },
      ])
    : [];
  const statMap = new Map(stats.map((s) => [s._id.toString(), s]));

  return {
    rows: users.map((u) => {
      const s = statMap.get(u._id.toString());
      return {
        id: u._id.toString(),
        name: u.name ?? '',
        email: u.email,
        phone: u.phone ?? '',
        role: u.role ?? 'customer',
        joinedAt: new Date(u.createdAt ?? Date.now()).toISOString(),
        bookingCount: s?.count ?? 0,
        activeBookingCount: s?.active ?? 0,
        lastBookingAt: s?.last ? new Date(s.last).toISOString() : null,
        linkedArtist: u.artistVendor?.name ?? null,
      };
    }),
    total,
    page: safePage,
    pageSize: PAGE_SIZE,
    q: term,
  };
}

export interface ArtistAccountRow {
  userId: string;
  name: string;
  email: string;
}

export async function listArtistAccounts(vendorId: string): Promise<ArtistAccountRow[]> {
  if (!Types.ObjectId.isValid(vendorId)) throw new VendorAdminError('Invalid vendor id.');
  const users = await User.find({ role: 'artist', artistVendor: new Types.ObjectId(vendorId) })
    .select('name email')
    .lean<Array<{ _id: Types.ObjectId; name?: string; email: string }>>();
  return users.map((u) => ({ userId: u._id.toString(), name: u.name ?? '', email: u.email }));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function linkArtistAccount(vendorId: string, email: unknown, adminUserId: string): Promise<ArtistAccountRow> {
  if (!Types.ObjectId.isValid(vendorId)) throw new VendorAdminError('Invalid vendor id.');
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    throw new VendorAdminError('Enter the email address of an existing Kajal Cartel account.');
  }
  const normalized = email.trim().toLowerCase();
  const vendor = await Vendor.findById(vendorId).select('_id name').lean<{ _id: Types.ObjectId; name: string }>();
  if (!vendor) throw new VendorAdminError('Vendor not found.', 404);

  const user = await User.findOne({ email: normalized }).select('_id role artistVendor name email').lean<Record<string, any>>();
  if (!user) {
    throw new VendorAdminError('No account uses that email. Ask the artist to sign in once first, then link their account.', 404);
  }
  if (user._id.toString() === adminUserId || user.role === 'admin') {
    throw new VendorAdminError('Admin accounts cannot be linked as artist accounts.', 409);
  }
  if (user.role === 'artist' && user.artistVendor && user.artistVendor.toString() !== vendorId) {
    throw new VendorAdminError('That account is already linked to another artist. Unlink it there first.', 409);
  }

  const result = await User.updateOne(
    { _id: user._id, role: { $in: ['customer', 'artist'] } },
    { $set: { role: 'artist', artistVendor: vendor._id } }
  );
  if (result.matchedCount === 0) throw new VendorAdminError('This account could not be linked.', 409);
  console.info(`[admin] Artist account linked: vendor=${vendor._id.toString()} user=${user._id.toString()} by=${adminUserId}`);
  return { userId: user._id.toString(), name: user.name ?? '', email: user.email };
}

export async function unlinkArtistAccount(vendorId: string, userId: unknown, adminUserId: string): Promise<void> {
  if (!Types.ObjectId.isValid(vendorId)) throw new VendorAdminError('Invalid vendor id.');
  if (typeof userId !== 'string' || !Types.ObjectId.isValid(userId)) throw new VendorAdminError('Invalid user id.');
  const result = await User.updateOne(
    { _id: new Types.ObjectId(userId), role: 'artist', artistVendor: new Types.ObjectId(vendorId) },
    { $set: { role: 'customer' }, $unset: { artistVendor: '' } }
  );
  if (result.matchedCount === 0) throw new VendorAdminError('That account is not linked to this artist.', 404);
  console.info(`[admin] Artist account unlinked: vendor=${vendorId} user=${userId} by=${adminUserId}`);
}

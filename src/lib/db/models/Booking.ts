import { Schema, model, models, Model, Document, Types } from 'mongoose';

export const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'DECLINED',
  'CANCELLED',
  'COMPLETED',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ['CONFIRMED', 'DECLINED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED', 'COMPLETED'],
  DECLINED: [],
  CANCELLED: [],
  COMPLETED: [],
};

interface IBookingAddOn {
  service: Types.ObjectId;
  quantity: number;
}

interface IBookingLineItem {
  name: string;
  quantity: number;
  unitPriceINR: number;
  discountPct: number;
  subtotalINR: number;
  discountLabel?: string;
}

interface IBookingPriceSnapshot {
  lineItems: IBookingLineItem[];
  total: number;
  depositAmount: number;
}

interface IBookingContactInfo {
  name: string;
  phone: string;
  email: string;
}

export const BOOKING_ACTORS = ['customer', 'admin', 'system'] as const;
export type BookingActor = (typeof BOOKING_ACTORS)[number];

export interface IBookingHistoryEntry {
  at: Date;
  actor: BookingActor;
  action: 'created' | 'status' | 'rescheduled';
  fromStatus?: BookingStatus;
  toStatus?: BookingStatus;
  fromDate?: Date;
  fromStartTime?: string;
  fromEndTime?: string;
  toDate?: Date;
  toStartTime?: string;
  toEndTime?: string;
  note?: string;
}

export const MAX_BOOKING_HISTORY = 100;

export interface IBooking extends Document {
  vendor: Types.ObjectId;
  service: Types.ObjectId;
  addOns: IBookingAddOn[];
  customer: Types.ObjectId;
  date: Date;
  startTime: string; // "HH:mm", 24-hour
  endTime: string; // "HH:mm", 24-hour
  status: BookingStatus;
  priceSnapshot: IBookingPriceSnapshot;
  contactInfo: IBookingContactInfo;
  customerNotes?: string;
  adminNotes?: string;
  idempotencyKey: string;
  rescheduleCount: number;
  lastRescheduledAt?: Date;
  confirmedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: Exclude<BookingActor, 'system'>;
  cancellationReason?: string;
  reviewedAt?: Date;
  history: IBookingHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BookingAddOnSchema = new Schema<IBookingAddOn>(
  {
    service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const BookingLineItemSchema = new Schema<IBookingLineItem>(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceINR: { type: Number, required: true, min: 0 },
    discountPct: { type: Number, required: true, default: 0, min: 0, max: 100 },
    subtotalINR: { type: Number, required: true, min: 0 },
    discountLabel: { type: String, trim: true },
  },
  { _id: false }
);

const BookingPriceSnapshotSchema = new Schema<IBookingPriceSnapshot>(
  {
    lineItems: { type: [BookingLineItemSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    depositAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const BookingContactInfoSchema = new Schema<IBookingContactInfo>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: { validator: (v: string) => EMAIL_RE.test(v), message: 'A valid email address is required.' },
    },
  },
  { _id: false }
);

const BookingHistoryEntrySchema = new Schema<IBookingHistoryEntry>(
  {
    at: { type: Date, required: true },
    actor: { type: String, enum: BOOKING_ACTORS, required: true },
    action: { type: String, enum: ['created', 'status', 'rescheduled'], required: true },
    fromStatus: { type: String, enum: BOOKING_STATUSES },
    toStatus: { type: String, enum: BOOKING_STATUSES },
    fromDate: { type: Date },
    fromStartTime: { type: String },
    fromEndTime: { type: String },
    toDate: { type: Date },
    toStartTime: { type: String },
    toEndTime: { type: String },
    note: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false }
);

const BookingSchema = new Schema<IBooking>(
  {
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    addOns: { type: [BookingAddOnSchema], default: [] },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    startTime: {
      type: String,
      required: true,
      validate: { validator: (v: string) => TIME_RE.test(v), message: 'startTime must be in HH:mm 24-hour format.' },
    },
    endTime: {
      type: String,
      required: true,
      validate: { validator: (v: string) => TIME_RE.test(v), message: 'endTime must be in HH:mm 24-hour format.' },
    },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      required: true,
      default: 'PENDING',
    },
    priceSnapshot: { type: BookingPriceSnapshotSchema, required: true },
    contactInfo: { type: BookingContactInfoSchema, required: true },
    customerNotes: { type: String, trim: true, maxlength: 500 },
    adminNotes: { type: String, trim: true, maxlength: 500 },
    idempotencyKey: { type: String, required: true, trim: true },
    rescheduleCount: { type: Number, default: 0, min: 0 },
    lastRescheduledAt: { type: Date },
    confirmedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelledBy: { type: String, enum: ['customer', 'admin'] },
    cancellationReason: { type: String, trim: true, maxlength: 300 },
    reviewedAt: { type: Date },
    history: {
      type: [BookingHistoryEntrySchema],
      default: [],
      validate: {
        validator: (entries: IBookingHistoryEntry[]) => entries.length <= MAX_BOOKING_HISTORY,
        message: `A booking can hold at most ${MAX_BOOKING_HISTORY} history entries.`,
      },
    },
  },
  {
    timestamps: true,
    collection: 'bookings',
  }
);

BookingSchema.index({ customer: 1, idempotencyKey: 1 }, { unique: true });
BookingSchema.index({ vendor: 1, date: 1, status: 1 });
BookingSchema.index({ customer: 1, createdAt: -1 });

// Atomic, DB-level backstop against double-booking the exact same slot: two
// PENDING/CONFIRMED bookings for the same vendor+service+date+startTime cannot
// both exist, regardless of request timing. This only correctly enforces
// maxConcurrentBookings = 1 (see VendorAvailability) — if capacity > 1 ever
// becomes settable, this index needs to change (e.g. drop the hard uniqueness
// and rely on an application-level count against maxConcurrentBookings instead).
BookingSchema.index(
  { vendor: 1, service: 1, date: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['PENDING', 'CONFIRMED'] } } }
);

const Booking = (models.Booking as Model<IBooking>) || model<IBooking>('Booking', BookingSchema);

export default Booking;

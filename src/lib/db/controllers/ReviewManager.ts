import { Types } from 'mongoose';
import Booking from '@/lib/db/models/Booking';
import Review, {
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
  REVIEW_TITLE_MAX,
} from '@/lib/db/models/Review';
import type { ReviewStatus } from '@/lib/db/models/Review';
import User from '@/lib/db/models/User';
import { runTransaction, TransactionsUnavailableError } from '@/lib/db/transaction';
import { getBookingPolicy } from '@/lib/booking/policy';
import { reviewDecision } from '@/lib/booking/rules';
import { refFromId } from './BookingManager';

export class ReviewError extends Error {
  readonly statusCode: 400 | 401 | 403 | 404 | 409 | 503;

  constructor(message: string, statusCode: 400 | 401 | 403 | 404 | 409 | 503 = 400) {
    super(message);
    this.name = 'ReviewError';
    this.statusCode = statusCode;
  }
}

export interface ReviewInput {
  rating: unknown;
  title?: unknown;
  body: unknown;
}

export interface PublicReview {
  id: string;
  rating: number;
  title?: string;
  body: string;
  authorDisplayName: string;
  serviceName: string;
  createdAt: string;
  editedAt?: string;
}

export interface VendorReviewStats {
  averageRating: number;
  totalReviews: number;
}

function toObjectId(value: string, label: string, statusCode: 400 | 401 = 400): Types.ObjectId {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
    throw new ReviewError(`Invalid ${label}.`, statusCode);
  }
  return new Types.ObjectId(value);
}

export function validateReviewInput(input: ReviewInput): { rating: number; title?: string; body: string } {
  if (!input || typeof input !== 'object') {
    throw new ReviewError('Request body must be a JSON object.');
  }
  const rating = input.rating;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < REVIEW_RATING_MIN || rating > REVIEW_RATING_MAX) {
    throw new ReviewError(`Rating must be a whole number from ${REVIEW_RATING_MIN} to ${REVIEW_RATING_MAX}.`);
  }
  if (input.title !== undefined && input.title !== null && typeof input.title !== 'string') {
    throw new ReviewError('Title must be text.');
  }
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (title.length > REVIEW_TITLE_MAX) {
    throw new ReviewError(`Title must be ${REVIEW_TITLE_MAX} characters or fewer.`);
  }
  if (typeof input.body !== 'string') {
    throw new ReviewError('Please write a few words about your experience.');
  }
  const body = input.body.trim();
  if (body.length < REVIEW_BODY_MIN) {
    throw new ReviewError(`Your review must be at least ${REVIEW_BODY_MIN} characters.`);
  }
  if (body.length > REVIEW_BODY_MAX) {
    throw new ReviewError(`Your review must be ${REVIEW_BODY_MAX} characters or fewer.`);
  }
  return { rating, title: title || undefined, body };
}

export function displayNameFor(name: string | undefined | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Verified client';
  const first = parts[0].slice(0, 40);
  const lastInitial = parts.length > 1 ? ` ${parts[parts.length - 1].charAt(0).toUpperCase()}.` : '';
  return `${first}${lastInitial}`;
}

function wrapTransactionErrors(err: unknown): never {
  if (err instanceof TransactionsUnavailableError) {
    console.error('[ReviewManager] Transactions unavailable:', err.message);
    throw new ReviewError('Reviews are temporarily unavailable. Please try again later.', 503);
  }
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    throw new ReviewError('You have already reviewed this appointment.', 409);
  }
  throw err;
}

export async function createReview(
  customerId: string,
  bookingId: string,
  input: ReviewInput,
  now: Date = new Date()
): Promise<{ reviewId: string }> {
  const customer = toObjectId(customerId, 'account', 401);
  const bookingObjectId = toObjectId(bookingId, 'booking ID');
  const { rating, title, body } = validateReviewInput(input);
  const policy = getBookingPolicy();

  const user = await User.findById(customer).select('name').lean<{ name?: string }>();
  if (!user) throw new ReviewError('Account not found.', 401);
  const authorDisplayName = displayNameFor(user.name);

  try {
    return await runTransaction(async (session) => {
      const booking = await Booking.findOne({ _id: bookingObjectId, customer })
        .select('vendor service status date startTime completedAt reviewedAt priceSnapshot.lineItems')
        .session(session)
        .lean<{
          _id: Types.ObjectId;
          vendor: Types.ObjectId;
          service: Types.ObjectId;
          status: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED';
          date: Date;
          startTime: string;
          completedAt?: Date;
          reviewedAt?: Date;
          priceSnapshot?: { lineItems?: Array<{ name: string }> };
        }>();
      if (!booking) throw new ReviewError('Booking not found.', 404);

      const existing = await Review.findOne({ booking: booking._id }).select('_id').session(session).lean();
      const decision = reviewDecision(
        {
          status: booking.status,
          date: booking.date,
          startTime: booking.startTime,
          completedAt: booking.completedAt,
          hasReview: Boolean(booking.reviewedAt) || Boolean(existing),
        },
        policy,
        now
      );
      if (!decision.allowed) {
        throw new ReviewError(decision.reason ?? 'This appointment cannot be reviewed.', booking.status === 'COMPLETED' ? 409 : 403);
      }

      const claimed = await Booking.updateOne(
        { _id: booking._id, customer, reviewedAt: { $exists: false } },
        { $set: { reviewedAt: now } },
        { session }
      );
      if (claimed.modifiedCount !== 1) {
        throw new ReviewError('You have already reviewed this appointment.', 409);
      }

      const [review] = await Review.create(
        [
          {
            booking: booking._id,
            customer,
            vendor: booking.vendor,
            service: booking.service,
            serviceName: (booking.priceSnapshot?.lineItems?.[0]?.name ?? 'Appointment').slice(0, 100),
            rating,
            title,
            body,
            authorDisplayName,
            status: 'published',
          },
        ],
        { session }
      );
      return { reviewId: (review._id as Types.ObjectId).toString() };
    });
  } catch (err) {
    wrapTransactionErrors(err);
  }
}

export async function updateOwnReview(
  customerId: string,
  reviewId: string,
  input: ReviewInput,
  now: Date = new Date()
): Promise<void> {
  const customer = toObjectId(customerId, 'account', 401);
  const _id = toObjectId(reviewId, 'review ID');
  const { rating, title, body } = validateReviewInput(input);
  const policy = getBookingPolicy();

  const review = await Review.findOne({ _id, customer }).select('booking').lean<{ booking: Types.ObjectId }>();
  if (!review) throw new ReviewError('Review not found.', 404);

  const booking = await Booking.findOne({ _id: review.booking, customer })
    .select('status date startTime completedAt')
    .lean<{ status: 'COMPLETED'; date: Date; startTime: string; completedAt?: Date }>();
  if (!booking) throw new ReviewError('Review not found.', 404);

  const window = reviewDecision({ ...booking, hasReview: false }, policy, now);
  if (!window.allowed) {
    throw new ReviewError(`Reviews can be edited within ${policy.reviewWindowDays} days of the appointment being completed.`, 409);
  }

  const result = await Review.updateOne(
    { _id, customer },
    {
      $set: { rating, body, editedAt: now, ...(title ? { title } : {}) },
      ...(title ? {} : { $unset: { title: '' } }),
    },
    { runValidators: true }
  );
  if (result.matchedCount === 0) throw new ReviewError('Review not found.', 404);
}

export async function deleteOwnReview(customerId: string, reviewId: string): Promise<void> {
  const customer = toObjectId(customerId, 'account', 401);
  const _id = toObjectId(reviewId, 'review ID');

  try {
    await runTransaction(async (session) => {
      const review = await Review.findOne({ _id, customer })
        .select('booking status')
        .session(session)
        .lean<{ booking: Types.ObjectId; status: ReviewStatus }>();
      if (!review) throw new ReviewError('Review not found.', 404);

      await Review.deleteOne({ _id, customer }, { session });
      if (review.status === 'published') {
        await Booking.updateOne({ _id: review.booking, customer }, { $unset: { reviewedAt: '' } }, { session });
      }
    });
  } catch (err) {
    wrapTransactionErrors(err);
  }
}

export async function moderateReview(
  adminUserId: string,
  reviewId: string,
  status: ReviewStatus,
  note?: unknown,
  now: Date = new Date()
): Promise<void> {
  const _id = toObjectId(reviewId, 'review ID');
  if (status !== 'published' && status !== 'hidden') {
    throw new ReviewError('status must be "published" or "hidden".');
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    throw new ReviewError('note must be text.');
  }
  const moderationNote = typeof note === 'string' ? note.trim() : '';
  if (moderationNote.length > 300) {
    throw new ReviewError('note must be 300 characters or fewer.');
  }

  const result = await Review.updateOne(
    { _id },
    {
      $set: {
        status,
        moderatedAt: now,
        ...(Types.ObjectId.isValid(adminUserId) ? { moderatedBy: new Types.ObjectId(adminUserId) } : {}),
        ...(moderationNote ? { moderationNote } : {}),
      },
      ...(moderationNote ? {} : { $unset: { moderationNote: '' } }),
    }
  );
  if (result.matchedCount === 0) throw new ReviewError('Review not found.', 404);
}

export async function deleteReviewAsAdmin(reviewId: string): Promise<void> {
  const _id = toObjectId(reviewId, 'review ID');
  const result = await Review.deleteOne({ _id });
  if (result.deletedCount === 0) throw new ReviewError('Review not found.', 404);
}

function toPublicReview(r: Record<string, any>): PublicReview {
  return {
    id: r._id.toString(),
    rating: r.rating,
    title: r.title || undefined,
    body: r.body,
    authorDisplayName: r.authorDisplayName,
    serviceName: r.serviceName,
    createdAt: new Date(r.createdAt).toISOString(),
    editedAt: r.editedAt ? new Date(r.editedAt).toISOString() : undefined,
  };
}

export async function getVendorReviewStats(vendorIds: Array<Types.ObjectId | string>): Promise<Map<string, VendorReviewStats>> {
  const ids = vendorIds
    .map((id) => (typeof id === 'string' ? (Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null) : id))
    .filter((id): id is Types.ObjectId => id !== null);
  const stats = new Map<string, VendorReviewStats>();
  if (ids.length === 0) return stats;

  const rows = await Review.aggregate<{ _id: Types.ObjectId; average: number; count: number }>([
    { $match: { vendor: { $in: ids }, status: 'published' } },
    { $group: { _id: '$vendor', average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  for (const row of rows) {
    stats.set(row._id.toString(), {
      averageRating: Math.round(row.average * 10) / 10,
      totalReviews: row.count,
    });
  }
  return stats;
}

export async function listPublishedReviewsForVendor(
  vendorId: Types.ObjectId | string,
  limit = 20
): Promise<PublicReview[]> {
  const vendor = typeof vendorId === 'string' ? toObjectId(vendorId, 'vendor ID') : vendorId;
  const rows = await Review.find({ vendor, status: 'published' })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 100))
    .select('rating title body authorDisplayName serviceName createdAt editedAt')
    .lean<Array<Record<string, any>>>();
  return rows.map(toPublicReview);
}

export interface RecentReview extends PublicReview {
  vendorName: string;
  vendorSlug: string;
}

export async function listRecentPublishedReviews(limit = 3): Promise<RecentReview[]> {
  const rows = await Review.find({ status: 'published' })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 20))
    .populate('vendor', 'name slug flags.isActive')
    .select('rating title body authorDisplayName serviceName createdAt editedAt vendor')
    .lean<Array<Record<string, any>>>();
  return rows
    .filter((r) => r.vendor && r.vendor.flags?.isActive)
    .map((r) => ({ ...toPublicReview(r), vendorName: r.vendor.name, vendorSlug: r.vendor.slug }));
}

export interface AdminReviewRow extends PublicReview {
  status: ReviewStatus;
  vendorName: string;
  vendorSlug: string;
  bookingRef: string;
  bookingId: string;
  moderatedAt?: string;
  moderationNote?: string;
}

export async function listReviewsForAdmin(filter: { status?: string; vendorId?: string } = {}): Promise<AdminReviewRow[]> {
  const query: Record<string, unknown> = {};
  if (filter.status === 'published' || filter.status === 'hidden') query.status = filter.status;
  if (filter.vendorId && Types.ObjectId.isValid(filter.vendorId)) query.vendor = new Types.ObjectId(filter.vendorId);

  const rows = await Review.find(query)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('vendor', 'name slug')
    .lean<Array<Record<string, any>>>();

  return rows.map((r) => ({
    ...toPublicReview(r),
    status: r.status,
    vendorName: r.vendor?.name ?? 'Removed artist',
    vendorSlug: r.vendor?.slug ?? '',
    bookingId: r.booking.toString(),
    bookingRef: refFromId(r.booking),
    moderatedAt: r.moderatedAt ? new Date(r.moderatedAt).toISOString() : undefined,
    moderationNote: r.moderationNote || undefined,
  }));
}

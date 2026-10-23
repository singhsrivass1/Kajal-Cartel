import { Schema, model, models, Model, Document, Types } from 'mongoose';

export const REVIEW_STATUSES = ['published', 'hidden'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;
export const REVIEW_TITLE_MAX = 100;
export const REVIEW_BODY_MIN = 20;
export const REVIEW_BODY_MAX = 2000;

export interface IReview extends Document {
  booking: Types.ObjectId;
  customer: Types.ObjectId;
  vendor: Types.ObjectId;
  service?: Types.ObjectId;
  serviceName: string;
  rating: number;
  title?: string;
  body: string;
  authorDisplayName: string;
  status: ReviewStatus;
  moderatedAt?: Date;
  moderatedBy?: Types.ObjectId;
  moderationNote?: string;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    service: { type: Schema.Types.ObjectId, ref: 'Service' },
    serviceName: { type: String, required: true, trim: true, maxlength: 100 },
    rating: {
      type: Number,
      required: true,
      min: REVIEW_RATING_MIN,
      max: REVIEW_RATING_MAX,
      validate: { validator: Number.isInteger, message: 'rating must be a whole number.' },
    },
    title: { type: String, trim: true, maxlength: REVIEW_TITLE_MAX },
    body: { type: String, required: true, trim: true, minlength: REVIEW_BODY_MIN, maxlength: REVIEW_BODY_MAX },
    authorDisplayName: { type: String, required: true, trim: true, maxlength: 60 },
    status: { type: String, enum: REVIEW_STATUSES, required: true, default: 'published' },
    moderatedAt: { type: Date },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    moderationNote: { type: String, trim: true, maxlength: 300 },
    editedAt: { type: Date },
  },
  { timestamps: true, collection: 'reviews' }
);

ReviewSchema.index({ booking: 1 }, { unique: true });
ReviewSchema.index({ vendor: 1, status: 1, createdAt: -1 });
ReviewSchema.index({ customer: 1, createdAt: -1 });
ReviewSchema.index({ status: 1, createdAt: -1 });

const Review = (models.Review as Model<IReview>) || model<IReview>('Review', ReviewSchema);

export default Review;

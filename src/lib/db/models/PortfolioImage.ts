import { Schema, model, models, Model, Document, Types } from 'mongoose';

/**
 * Portfolio images live in their own collection, one document per image, rather
 * than as base64 embedded in Vendor.portfolio[]. Vendor.portfolio requires a
 * minimum of 4 images — at the 10MB-per-upload ceiling used elsewhere that would
 * be ~53MB of base64 in a single Vendor document, well past Mongo's 16MB limit.
 * Splitting them keeps the size ceiling per-image, and keeps the Vendor document
 * small enough to stay cheap on the roster/discover read paths that load every
 * active vendor on every request.
 *
 * Vendor.portfolio[].imageUrl still holds a plain string, so it can point either
 * at a static /images/... asset (the seeded vendors) or at
 * /api/portfolio-images/<id> for an uploaded one. No Vendor schema change needed.
 */
export interface IPortfolioImage extends Document {
  vendor: Types.ObjectId;
  data: string; // base64, no data: prefix
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
}

export const PORTFOLIO_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * Deliberately lower than the 10MB used for single-upload moodboards: a vendor
 * carries 4-20 of these, so the per-vendor footprint is what matters here, not
 * the per-upload one.
 */
export const MAX_PORTFOLIO_IMAGE_BYTES = 2 * 1024 * 1024;

const PortfolioImageSchema = new Schema<IPortfolioImage>(
  {
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    data: { type: String, required: true },
    mimeType: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => PORTFOLIO_IMAGE_MIME_TYPES.includes(v),
        message: 'mimeType must be one of: ' + PORTFOLIO_IMAGE_MIME_TYPES.join(', '),
      },
    },
  },
  { timestamps: true, collection: 'portfolioimages' }
);

PortfolioImageSchema.index({ vendor: 1, createdAt: -1 });

const PortfolioImage =
  (models.PortfolioImage as Model<IPortfolioImage>) ||
  model<IPortfolioImage>('PortfolioImage', PortfolioImageSchema);

export default PortfolioImage;

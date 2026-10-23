import { Schema, model, models, Model, Document, Types } from 'mongoose';

export const BOARD_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_BOARD_IMAGE_BYTES = 1.5 * 1024 * 1024;
export const MAX_BOARD_IMAGES_PER_USER = 40;

export interface IBoardImage extends Document {
  user: Types.ObjectId;
  board: Types.ObjectId;
  data: string;
  mimeType: string;
  bytes: number;
  createdAt: Date;
  updatedAt: Date;
}

const BoardImageSchema = new Schema<IBoardImage>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    board: { type: Schema.Types.ObjectId, ref: 'PlanningBoard', required: true },
    data: { type: String, required: true },
    mimeType: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => BOARD_IMAGE_MIME_TYPES.includes(v),
        message: 'mimeType must be one of: ' + BOARD_IMAGE_MIME_TYPES.join(', '),
      },
    },
    bytes: { type: Number, required: true, min: 1, max: MAX_BOARD_IMAGE_BYTES },
  },
  { timestamps: true, collection: 'boardimages' }
);

BoardImageSchema.index({ user: 1, createdAt: -1 });
BoardImageSchema.index({ board: 1 });

const BoardImage =
  (models.BoardImage as Model<IBoardImage>) || model<IBoardImage>('BoardImage', BoardImageSchema);

export default BoardImage;

import { Schema, model, models, Model, Document, Types } from 'mongoose';

export interface IBlockedDate extends Document {
  vendor: Types.ObjectId;
  startDate: Date; // UTC midnight, inclusive
  endDate: Date; // UTC midnight, inclusive
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BlockedDateSchema = new Schema<IBlockedDate>(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (this: IBlockedDate, end: Date) {
          return end.getTime() >= this.startDate.getTime();
        },
        message: 'endDate must be on or after startDate.',
      },
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 200,
    },
  },
  {
    timestamps: true,
    collection: 'blockeddates',
  }
);

BlockedDateSchema.index({ vendor: 1, startDate: 1, endDate: 1 });

const BlockedDate =
  (models.BlockedDate as Model<IBlockedDate>) || model<IBlockedDate>('BlockedDate', BlockedDateSchema);

export default BlockedDate;

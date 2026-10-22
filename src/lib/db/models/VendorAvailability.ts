import { Schema, model, models, Model, Document, Types } from 'mongoose';

export interface IWorkingHours {
  dayOfWeek: number; // 0 = Sunday ... 6 = Saturday
  isOpen: boolean;
  startTime: string; // "HH:mm", 24-hour
  endTime: string; // "HH:mm", 24-hour
}

export interface IVendorAvailability extends Document {
  vendor: Types.ObjectId;
  workingHours: IWorkingHours[];
  slotIntervalMinutes: number;
  maxConcurrentBookings: number;
  createdAt: Date;
  updatedAt: Date;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const WorkingHoursSchema = new Schema<IWorkingHours>(
  {
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    isOpen: {
      type: Boolean,
      required: true,
      default: false,
    },
    startTime: {
      type: String,
      required: true,
      default: '10:00',
      validate: {
        validator: (v: string) => TIME_RE.test(v),
        message: 'startTime must be in HH:mm 24-hour format.',
      },
    },
    endTime: {
      type: String,
      required: true,
      default: '19:00',
      validate: {
        validator: (v: string) => TIME_RE.test(v),
        message: 'endTime must be in HH:mm 24-hour format.',
      },
    },
  },
  { _id: false }
);

const VendorAvailabilitySchema = new Schema<IVendorAvailability>(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      unique: true,
    },
    workingHours: {
      type: [WorkingHoursSchema],
      required: true,
      validate: [
        {
          validator: (arr: IWorkingHours[]) => {
            const days = new Set(arr.map((w) => w.dayOfWeek));
            return arr.length === 7 && days.size === 7;
          },
          message: 'workingHours must contain exactly one entry for each day of the week (0-6).',
        },
        {
          validator: (arr: IWorkingHours[]) =>
            arr.every((w) => {
              if (!w.isOpen) return true;
              const [sh, sm] = w.startTime.split(':').map(Number);
              const [eh, em] = w.endTime.split(':').map(Number);
              return eh * 60 + em > sh * 60 + sm;
            }),
          message: 'endTime must be after startTime for every open day.',
        },
      ],
    },
    slotIntervalMinutes: {
      type: Number,
      required: true,
      default: 30,
      min: 5,
    },
    maxConcurrentBookings: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
    collection: 'vendoravailabilities',
  }
);

const VendorAvailability =
  (models.VendorAvailability as Model<IVendorAvailability>) ||
  model<IVendorAvailability>('VendorAvailability', VendorAvailabilitySchema);

export default VendorAvailability;

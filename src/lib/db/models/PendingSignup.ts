import { Schema, model, models, Model, Document } from 'mongoose';

export interface IPendingSignup extends Document {
  email: string;
  name: string;
  passwordHash: string;
  tokenHash: string;
  initiatorHash: string;
  issuedAt: Date;
  expiresAt: Date;
}

const PendingSignupSchema = new Schema<IPendingSignup>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    passwordHash: { type: String, required: true, select: false },
    tokenHash: { type: String, required: true, unique: true },
    initiatorHash: { type: String, required: true },
    issuedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  {
    collection: 'pendingsignups',
  }
);

PendingSignupSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PendingSignup =
  (models.PendingSignup as Model<IPendingSignup>) ||
  model<IPendingSignup>('PendingSignup', PendingSignupSchema);

export default PendingSignup;

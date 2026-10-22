import { Schema, model, models, type Document } from 'mongoose';

export const USER_ROLES = ['customer', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface IUser extends Document {
  name?: string;
  email: string;
  emailVerified?: Date;
  image?: string;
  role: UserRole;
  passwordHash?: string;
  credentialsVerifiedAt?: Date;
  resetPasswordTokenHash?: string;
  resetPasswordExpires?: Date;
  savedArtists: string[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerified: { type: Date },
    image: { type: String },
    role: { type: String, enum: [...USER_ROLES], default: 'customer' },
    passwordHash: { type: String, select: false },
    credentialsVerifiedAt: { type: Date },
    resetPasswordTokenHash: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    savedArtists: {
      type: [String],
      default: [],
      validate: {
        validator: (arr: string[]) => arr.length <= 50,
        message: 'Cannot save more than 50 artists.',
      },
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

UserSchema.index({ savedArtists: 1 });

const User = models.User ?? model<IUser>('User', UserSchema);
export default User;

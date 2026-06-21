import mongoose, { Schema, model, models, type Document } from 'mongoose';

export interface MatchHistoryEntry {
  id: string;
  styleDNA: Array<{ label: string; score: number }>;
  editorialAnalysis: string;
  matches: Array<{
    artistSlug: string;
    artistName: string;
    confidenceScore: number;
    rationale: string;
    profileImageUrl: string;
  }>;
  savedAt: Date;
}

export interface IUser extends Document {
  name?: string;
  email: string;
  emailVerified?: Date;
  image?: string;
  savedArtists: string[];
  matchHistory: MatchHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const MatchEntrySchema = new Schema<MatchHistoryEntry>(
  {
    id: { type: String, required: true },
    styleDNA: [
      {
        label: { type: String, required: true },
        score: { type: Number, required: true, min: 0, max: 100 },
      },
    ],
    editorialAnalysis: { type: String, default: '' },
    matches: [
      {
        artistSlug: { type: String, required: true },
        artistName: { type: String, required: true },
        confidenceScore: { type: Number, required: true, min: 0, max: 1 },
        rationale: { type: String, default: '' },
        profileImageUrl: { type: String, default: '' },
      },
    ],
    savedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerified: { type: Date },
    image: { type: String },
    savedArtists: {
      type: [String],
      default: [],
      validate: {
        validator: (arr: string[]) => arr.length <= 50,
        message: 'Cannot save more than 50 artists.',
      },
    },
    matchHistory: {
      type: [MatchEntrySchema],
      default: [],
      validate: {
        validator: (arr: MatchHistoryEntry[]) => arr.length <= 100,
        message: 'Match history limit reached.',
      },
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ savedArtists: 1 });

const User = models.User ?? model<IUser>('User', UserSchema);
export default User;
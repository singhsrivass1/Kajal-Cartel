import { Schema, model, models, Model, Document, Types } from 'mongoose';

interface ISavedMoodboardStyleDNA {
  label: string;
  score: number;
}

interface ISavedMoodboardImageProfile {
  styleArchetypes: string[];
  makeupFinishTags: string[];
  colorPaletteAffinity: string[];
  occasionSignals: string[];
  skinToneSignals: string[];
  visualNarrative: string;
}

interface ISavedMoodboardImage {
  data: string; // base64
  mimeType: string;
}

export interface ISavedMoodboard extends Document {
  user: Types.ObjectId;
  label: string;
  image: ISavedMoodboardImage;
  imageProfile: ISavedMoodboardImageProfile;
  styleDNA: ISavedMoodboardStyleDNA[];
  editorialAnalysis: string;
  createdAt: Date;
  updatedAt: Date;
}

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const SavedMoodboardStyleDNASchema = new Schema<ISavedMoodboardStyleDNA>(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    score: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const SavedMoodboardImageProfileSchema = new Schema<ISavedMoodboardImageProfile>(
  {
    styleArchetypes: { type: [String], default: [] },
    makeupFinishTags: { type: [String], default: [] },
    colorPaletteAffinity: { type: [String], default: [] },
    occasionSignals: { type: [String], default: [] },
    skinToneSignals: { type: [String], default: [] },
    visualNarrative: { type: String, default: '', trim: true, maxlength: 600 },
  },
  { _id: false }
);

const SavedMoodboardImageSchema = new Schema<ISavedMoodboardImage>(
  {
    data: { type: String, required: true },
    mimeType: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => ALLOWED_IMAGE_MIME_TYPES.includes(v),
        message: 'mimeType must be one of: ' + ALLOWED_IMAGE_MIME_TYPES.join(', '),
      },
    },
  },
  { _id: false }
);

const SavedMoodboardSchema = new Schema<ISavedMoodboard>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    image: { type: SavedMoodboardImageSchema, required: true },
    imageProfile: { type: SavedMoodboardImageProfileSchema, required: true },
    styleDNA: { type: [SavedMoodboardStyleDNASchema], default: [] },
    editorialAnalysis: { type: String, required: true, trim: true, maxlength: 600 },
  },
  {
    timestamps: true,
    collection: 'savedmoodboards',
  }
);

SavedMoodboardSchema.index({ user: 1, createdAt: -1 });

const SavedMoodboard =
  (models.SavedMoodboard as Model<ISavedMoodboard>) ||
  model<ISavedMoodboard>('SavedMoodboard', SavedMoodboardSchema);

export default SavedMoodboard;

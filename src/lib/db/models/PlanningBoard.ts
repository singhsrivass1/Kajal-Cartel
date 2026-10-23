import { Schema, model, models, Model, Document, Types } from 'mongoose';

export const BOARD_EVENT_TYPES = [
  'wedding',
  'engagement',
  'sangeet',
  'mehendi',
  'haldi',
  'reception',
  'cocktail',
  'party',
  'pre-wedding-shoot',
  'other',
] as const;
export type BoardEventType = (typeof BOARD_EVENT_TYPES)[number];

export const BOARD_ITEM_KINDS = ['look', 'portfolio', 'upload', 'artist', 'service'] as const;
export type BoardItemKind = (typeof BOARD_ITEM_KINDS)[number];

export const MAX_BOARD_NAME_LENGTH = 80;
export const MAX_BOARD_NOTES_LENGTH = 2000;
export const MAX_BOARD_ITEMS = 60;
export const MAX_BOARD_ITEM_NOTE_LENGTH = 300;
export const MAX_STYLE_PREFERENCES = 12;
export const MAX_STYLE_PREFERENCE_LENGTH = 40;

export interface IBoardItem {
  _id: Types.ObjectId;
  kind: BoardItemKind;
  note?: string;
  addedAt: Date;
  savedLook?: Types.ObjectId;
  vendorSlug?: string;
  imageUrl?: string;
  imageAlt?: string;
  upload?: Types.ObjectId;
  service?: Types.ObjectId;
  serviceName?: string;
}

export interface IPlanningBoard extends Document {
  user: Types.ObjectId;
  name: string;
  eventType: BoardEventType;
  eventDate?: Date;
  notes?: string;
  stylePreferences: string[];
  items: Types.DocumentArray<IBoardItem & Document>;
  createdAt: Date;
  updatedAt: Date;
}

const BoardItemSchema = new Schema<IBoardItem>({
  kind: { type: String, enum: BOARD_ITEM_KINDS, required: true },
  note: { type: String, trim: true, maxlength: MAX_BOARD_ITEM_NOTE_LENGTH },
  addedAt: { type: Date, required: true },
  savedLook: { type: Schema.Types.ObjectId, ref: 'SavedMoodboard' },
  vendorSlug: { type: String, trim: true, lowercase: true, maxlength: 120 },
  imageUrl: { type: String, trim: true, maxlength: 300 },
  imageAlt: { type: String, trim: true, maxlength: 150 },
  upload: { type: Schema.Types.ObjectId, ref: 'BoardImage' },
  service: { type: Schema.Types.ObjectId, ref: 'Service' },
  serviceName: { type: String, trim: true, maxlength: 100 },
});

const PlanningBoardSchema = new Schema<IPlanningBoard>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: MAX_BOARD_NAME_LENGTH },
    eventType: { type: String, enum: BOARD_EVENT_TYPES, required: true, default: 'wedding' },
    eventDate: { type: Date },
    notes: { type: String, trim: true, maxlength: MAX_BOARD_NOTES_LENGTH },
    stylePreferences: {
      type: [{ type: String, trim: true, maxlength: MAX_STYLE_PREFERENCE_LENGTH }],
      default: [],
      validate: {
        validator: (arr: string[]) => arr.length <= MAX_STYLE_PREFERENCES,
        message: `A board can have at most ${MAX_STYLE_PREFERENCES} style preferences.`,
      },
    },
    items: {
      type: [BoardItemSchema],
      default: [],
      validate: {
        validator: (arr: IBoardItem[]) => arr.length <= MAX_BOARD_ITEMS,
        message: `A board can hold at most ${MAX_BOARD_ITEMS} items.`,
      },
    },
  },
  { timestamps: true, collection: 'planningboards' }
);

PlanningBoardSchema.index({ user: 1, updatedAt: -1 });

const PlanningBoard =
  (models.PlanningBoard as Model<IPlanningBoard>) || model<IPlanningBoard>('PlanningBoard', PlanningBoardSchema);

export default PlanningBoard;

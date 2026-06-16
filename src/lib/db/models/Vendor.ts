import { Schema, model, models, Model, Document, Types } from 'mongoose';
import {
  STYLE_ARCHETYPES,
  MAKEUP_FINISH_TAGS,
  COLOR_PALETTE_TAGS,
  OCCASION_TAGS,
  SKIN_TONE_TAGS,
  HAIR_STYLE_TAGS,
  MICRO_LOCATIONS,
  TRAVEL_POLICY,
  PRICING_TIER,
  BADGE_TYPE,
  CONTRA_INDICATORS,
} from '../enums/taxonomy';
import type {
  StyleArchetype,
  MakeupFinishTag,
  ColorPaletteTag,
  OccasionTag,
  SkinToneTag,
  HairStyleTag,
  MicroLocation,
  TravelPolicy,
  PricingTier,
  BadgeType,
  ContraIndicator,
} from '../enums/taxonomy';

interface IGeoJSONPoint {
  type: 'Point';
  coordinates: [number, number];
}

interface ILocation {
  microLocation: MicroLocation;
  city: string;
  fullAddress?: string;
  coordinates?: IGeoJSONPoint;
  travelPolicy: TravelPolicy;
  serviceRadius: number;
}

interface IContact {
  phone: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  website?: string;
}

interface IBusinessMeta {
  yearsOfExperience: number;
  teamSize: number;
  languagesSpoken: string[];
  bookingLeadTimeDays: number;
  trialsOffered: boolean;
  trialDurationMinutes?: number;
}

interface IVendorPricing {
  tier: PricingTier;
  startingFromINR: number;
  currency: string;
  travelSurchargePerKm?: number;
}

interface IAestheticProfile {
  styleArchetypes: StyleArchetype[];
  makeupFinishTags: MakeupFinishTag[];
  hairStyleTags: HairStyleTag[];
  occasionSpecializations: OccasionTag[];
  colorPaletteAffinity: ColorPaletteTag[];
  skinToneExpertise: SkinToneTag[];
  inspirationReferences?: string[];
  signatureElements?: string;
  aestheticBio: string;
  moodKeywords?: string[];
  contraIndicators?: ContraIndicator[];
  contraIndicatorsNotes?: string;
}

interface IPortfolioItem {
  imageUrl: string;
  altText: string;
  primaryOccasion: OccasionTag;
  styleArchetypesShown: StyleArchetype[];
  colorPaletteShown: ColorPaletteTag[];
  captionForAI: string;
  isHeroImage: boolean;
  sortOrder: number;
}

interface IRatings {
  averageRating: number;
  totalReviews: number;
  skillScore: number;
  punctualityScore: number;
  communicationScore: number;
  valueScore: number;
}

interface IPriceRange {
  min: number;
  max: number;
}

interface IServiceSummary {
  serviceCount: number;
  anchorServiceCount: number;
  priceRangeINR: IPriceRange;
  occasionCoverage: OccasionTag[];
  hasTrialOffering: boolean;
}

interface IVendorFlags {
  isActive: boolean;
  isVerified: boolean;
  isFeatured: boolean;
  badgeType: BadgeType | null;
}

export interface IVendor extends Document {
  name: string;
  slug: string;
  tagline: string;
  bio?: string;
  profileImageUrl: string;
  location: ILocation;
  contact: IContact;
  businessMeta: IBusinessMeta;
  pricing: IVendorPricing;
  aestheticProfile: IAestheticProfile;
  portfolio: Types.DocumentArray<IPortfolioItem & Document>;
  ratings: IRatings;
  serviceSummary: IServiceSummary;
  flags: IVendorFlags;
  createdAt: Date;
  updatedAt: Date;
}

const GeoJSONPointSchema = new Schema<IGeoJSONPoint>(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  { _id: false }
);

const LocationSchema = new Schema<ILocation>(
  {
    microLocation: {
      type: String,
      enum: [...MICRO_LOCATIONS],
      required: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      default: 'New Delhi',
    },
    fullAddress: {
      type: String,
      trim: true,
    },
    coordinates: {
      type: GeoJSONPointSchema,
      default: undefined,
    },
    travelPolicy: {
      type: String,
      enum: [...TRAVEL_POLICY],
      required: true,
    },
    serviceRadius: {
      type: Number,
      required: true,
      min: 0,
      default: 15,
    },
  },
  { _id: false }
);

const ContactSchema = new Schema<IContact>(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    whatsapp: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    instagram: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const BusinessMetaSchema = new Schema<IBusinessMeta>(
  {
    yearsOfExperience: {
      type: Number,
      required: true,
      min: 0,
    },
    teamSize: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    languagesSpoken: {
      type: [String],
      required: true,
      default: ['Hindi', 'English'],
    },
    bookingLeadTimeDays: {
      type: Number,
      required: true,
      min: 0,
      default: 7,
    },
    trialsOffered: {
      type: Boolean,
      required: true,
      default: false,
    },
    trialDurationMinutes: {
      type: Number,
      min: 15,
    },
  },
  { _id: false }
);

const VendorPricingSchema = new Schema<IVendorPricing>(
  {
    tier: {
      type: String,
      enum: [...PRICING_TIER],
      required: true,
    },
    startingFromINR: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: 'INR',
    },
    travelSurchargePerKm: {
      type: Number,
      min: 0,
    },
  },
  { _id: false }
);

const AestheticProfileSchema = new Schema<IAestheticProfile>(
  {
    styleArchetypes: {
      type: [String],
      enum: [...STYLE_ARCHETYPES],
      required: true,
      validate: [
        {
          validator: (arr: string[]) => arr.length >= 1 && arr.length <= 3,
          message: 'styleArchetypes must contain between 1 and 3 values',
        },
      ],
    },
    makeupFinishTags: {
      type: [String],
      enum: [...MAKEUP_FINISH_TAGS],
      required: true,
      validate: [
        {
          validator: (arr: string[]) => arr.length >= 1,
          message: 'makeupFinishTags must contain at least one value',
        },
      ],
    },
    hairStyleTags: {
      type: [String],
      enum: [...HAIR_STYLE_TAGS],
      required: true,
      validate: [
        {
          validator: (arr: string[]) => arr.length >= 1,
          message: 'hairStyleTags must contain at least one value',
        },
      ],
    },
    occasionSpecializations: {
      type: [String],
      enum: [...OCCASION_TAGS],
      required: true,
      validate: [
        {
          validator: (arr: string[]) => arr.length >= 1,
          message: 'occasionSpecializations must contain at least one value',
        },
      ],
    },
    colorPaletteAffinity: {
      type: [String],
      enum: [...COLOR_PALETTE_TAGS],
      required: true,
      validate: [
        {
          validator: (arr: string[]) => arr.length >= 1,
          message: 'colorPaletteAffinity must contain at least one value',
        },
      ],
    },
    skinToneExpertise: {
      type: [String],
      enum: [...SKIN_TONE_TAGS],
      required: true,
      validate: [
        {
          validator: (arr: string[]) => arr.length >= 1,
          message: 'skinToneExpertise must contain at least one value',
        },
      ],
    },
    inspirationReferences: {
      type: [String],
      default: [],
      validate: [
        {
          validator: (arr: string[]) => arr.length <= 5,
          message: 'inspirationReferences cannot exceed 5 items',
        },
      ],
    },
    signatureElements: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    aestheticBio: {
      type: String,
      required: true,
      trim: true,
      minlength: 80,
      maxlength: 400,
    },
    moodKeywords: {
      type: [String],
      default: [],
      validate: [
        {
          validator: (arr: string[]) => arr.length <= 10,
          message: 'moodKeywords cannot exceed 10 items',
        },
      ],
    },
    contraIndicators: {
      type: [String],
      enum: [...CONTRA_INDICATORS],
      default: [],
    },
    contraIndicatorsNotes: {
      type: String,
      trim: true,
      maxlength: 300,
    },
  },
  { _id: false }
);

const PortfolioItemSchema = new Schema<IPortfolioItem>({
  imageUrl: {
    type: String,
    required: true,
    trim: true,
  },
  altText: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150,
  },
  primaryOccasion: {
    type: String,
    enum: [...OCCASION_TAGS],
    required: true,
  },
  styleArchetypesShown: {
    type: [String],
    enum: [...STYLE_ARCHETYPES],
    required: true,
    validate: [
      {
        validator: (arr: string[]) => arr.length >= 1,
        message: 'styleArchetypesShown must contain at least one value',
      },
    ],
  },
  colorPaletteShown: {
    type: [String],
    enum: [...COLOR_PALETTE_TAGS],
    required: true,
    validate: [
      {
        validator: (arr: string[]) => arr.length >= 1,
        message: 'colorPaletteShown must contain at least one value',
      },
    ],
  },
  captionForAI: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  isHeroImage: {
    type: Boolean,
    required: true,
    default: false,
  },
  sortOrder: {
    type: Number,
    required: true,
    default: 0,
  },
});

const RatingsSchema = new Schema<IRatings>(
  {
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    skillScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    punctualityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    communicationScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    valueScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
  },
  { _id: false }
);

const PriceRangeSchema = new Schema<IPriceRange>(
  {
    min: {
      type: Number,
      default: 0,
      min: 0,
    },
    max: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const ServiceSummarySchema = new Schema<IServiceSummary>(
  {
    serviceCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    anchorServiceCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    priceRangeINR: {
      type: PriceRangeSchema,
      default: () => ({ min: 0, max: 0 }),
    },
    occasionCoverage: {
      type: [String],
      enum: [...OCCASION_TAGS],
      default: [],
    },
    hasTrialOffering: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const VendorFlagsSchema = new Schema<IVendorFlags>(
  {
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    badgeType: {
      type: String,
      enum: [...BADGE_TYPE, null],
      default: null,
    },
  },
  { _id: false }
);

const VendorSchema = new Schema<IVendor>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    tagline: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 800,
    },
    profileImageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: LocationSchema,
      required: true,
    },
    contact: {
      type: ContactSchema,
      required: true,
    },
    businessMeta: {
      type: BusinessMetaSchema,
      required: true,
    },
    pricing: {
      type: VendorPricingSchema,
      required: true,
    },
    aestheticProfile: {
      type: AestheticProfileSchema,
      required: true,
    },
    portfolio: {
      type: [PortfolioItemSchema],
      required: true,
      validate: [
        {
          validator: (items: IPortfolioItem[]) => items.length >= 4,
          message: 'A vendor portfolio must contain at least 4 images',
        },
        {
          validator: (items: IPortfolioItem[]) => items.length <= 20,
          message: 'A vendor portfolio cannot exceed 20 images',
        },
        {
          validator: (items: IPortfolioItem[]) =>
            items.filter((item) => item.isHeroImage).length <= 1,
          message: 'A vendor portfolio may have at most one designated hero image',
        },
      ],
    },
    ratings: {
      type: RatingsSchema,
      default: () => ({
        averageRating: 0,
        totalReviews: 0,
        skillScore: 0,
        punctualityScore: 0,
        communicationScore: 0,
        valueScore: 0,
      }),
    },
    serviceSummary: {
      type: ServiceSummarySchema,
      default: () => ({
        serviceCount: 0,
        anchorServiceCount: 0,
        priceRangeINR: { min: 0, max: 0 },
        occasionCoverage: [],
        hasTrialOffering: false,
      }),
    },
    flags: {
      type: VendorFlagsSchema,
      default: () => ({
        isActive: true,
        isVerified: false,
        isFeatured: false,
        badgeType: null,
      }),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

VendorSchema.index({ 'location.coordinates': '2dsphere' }, { sparse: true });
VendorSchema.index({ 'location.microLocation': 1 });
VendorSchema.index({ 'pricing.tier': 1 });
VendorSchema.index({ 'aestheticProfile.styleArchetypes': 1 });
VendorSchema.index({ 'aestheticProfile.occasionSpecializations': 1 });
VendorSchema.index({ 'aestheticProfile.colorPaletteAffinity': 1 });
VendorSchema.index({ 'flags.isActive': 1, 'flags.isFeatured': 1 });
VendorSchema.index({ 'flags.isActive': 1, 'location.microLocation': 1 });
VendorSchema.index(
  {
    'aestheticProfile.aestheticBio': 'text',
    'aestheticProfile.signatureElements': 'text',
    'aestheticProfile.moodKeywords': 'text',
    tagline: 'text',
  },
  {
    weights: {
      'aestheticProfile.aestheticBio': 10,
      'aestheticProfile.signatureElements': 8,
      'aestheticProfile.moodKeywords': 5,
      tagline: 3,
    },
    name: 'vendor_aesthetic_text_index',
  }
);

const Vendor = (models.Vendor as Model<IVendor>) || model<IVendor>('Vendor', VendorSchema);

export default Vendor;

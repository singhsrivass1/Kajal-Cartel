import { Schema, model, models, Model, Document, Types } from 'mongoose';
import {
  SERVICE_CATEGORY,
  SERVICE_ROLE,
  PRICE_TYPE,
  CHECKOUT_CATEGORY,
  ESTIMATE_CONTRIBUTION,
  RECIPIENT_TYPE,
  OCCASION_TAGS,
  STYLE_ARCHETYPES,
} from '../enums/taxonomy';
import type {
  ServiceCategory,
  ServiceRole,
  PriceType,
  CheckoutCategory,
  EstimateContribution,
  RecipientType,
  OccasionTag,
  StyleArchetype,
} from '../enums/taxonomy';

interface IGroupDiscountTier {
  minQuantity: number;
  discountPercent: number;
  tierLabel: string;
}

interface IServiceDuration {
  baseDurationMinutes: number;
  additionalPersonMinutes: number;
  bufferMinutes: number;
  canRunConcurrentlyWithAnchor: boolean;
}

interface IServicePricing {
  unitPriceINR: number;
  priceType: PriceType;
  minimumChargeINR?: number;
  groupDiscountTiers: IGroupDiscountTier[];
  travelSurchargeApplicable: boolean;
  trialCreditINR?: number;
}

interface IPartyConfig {
  isQuantifiable: boolean;
  recipientType: RecipientType;
  quantityLabel: string;
  minQuantity: number;
  maxQuantity: number;
  defaultQuantity: number;
  requiresAnchorService: boolean;
}

interface IAestheticSignals {
  occasionTags: OccasionTag[];
  styleArchetypeTags: StyleArchetype[];
  aiDescription: string;
}

interface ICheckoutMeta {
  checkoutCategory: CheckoutCategory;
  displayPriority: number;
  estimateContribution: EstimateContribution;
  bundleEligible: boolean;
  requiresConsultation: boolean;
}

interface IServiceFlags {
  isActive: boolean;
  isSignatureService: boolean;
  isNewlyAdded: boolean;
  newlyAddedExpiresAt?: Date;
}

export interface IService extends Document {
  vendor: Types.ObjectId;
  name: string;
  slug: string;
  category: ServiceCategory;
  serviceRole: ServiceRole;
  description?: string;
  compatibleAnchorCategories: ServiceCategory[];
  duration: IServiceDuration;
  pricing: IServicePricing;
  partyConfig: IPartyConfig;
  aestheticSignals: IAestheticSignals;
  checkoutMeta: ICheckoutMeta;
  flags: IServiceFlags;
  createdAt: Date;
  updatedAt: Date;
}

const GroupDiscountTierSchema = new Schema<IGroupDiscountTier>(
  {
    minQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    discountPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    tierLabel: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
  },
  { _id: false }
);

const ServiceDurationSchema = new Schema<IServiceDuration>(
  {
    baseDurationMinutes: {
      type: Number,
      required: true,
      min: 15,
    },
    additionalPersonMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    bufferMinutes: {
      type: Number,
      default: 15,
      min: 0,
    },
    canRunConcurrentlyWithAnchor: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { _id: false }
);

const ServicePricingSchema = new Schema<IServicePricing>(
  {
    unitPriceINR: {
      type: Number,
      required: true,
      min: 0,
    },
    priceType: {
      type: String,
      enum: [...PRICE_TYPE],
      required: true,
    },
    minimumChargeINR: {
      type: Number,
      min: 0,
    },
    groupDiscountTiers: {
      type: [GroupDiscountTierSchema],
      default: [],
      validate: [
        {
          validator: (tiers: IGroupDiscountTier[]) => {
            if (tiers.length < 2) return true;
            for (let i = 1; i < tiers.length; i++) {
              const prevTier = tiers[i - 1];
              const currTier = tiers[i];
              if (currTier.minQuantity <= prevTier.minQuantity) return false;
              if (currTier.discountPercent <= prevTier.discountPercent) return false;
            }
            return true;
          },
          message:
            'groupDiscountTiers must be ordered with strictly ascending minQuantity and discountPercent values',
        },
      ],
    },
    travelSurchargeApplicable: {
      type: Boolean,
      default: true,
    },
    trialCreditINR: {
      type: Number,
      min: 0,
    },
  },
  { _id: false }
);

const PartyConfigSchema = new Schema<IPartyConfig>(
  {
    isQuantifiable: {
      type: Boolean,
      required: true,
      default: false,
    },
    recipientType: {
      type: String,
      enum: [...RECIPIENT_TYPE],
      required: true,
    },
    quantityLabel: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
      default: 'Person',
    },
    minQuantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    maxQuantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
      validate: [
        {
          validator: function (this: IPartyConfig, max: number) {
            return max >= this.minQuantity;
          },
          message: 'maxQuantity must be greater than or equal to minQuantity',
        },
      ],
    },
    defaultQuantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
      validate: [
        {
          validator: function (this: IPartyConfig, def: number) {
            return def >= this.minQuantity && def <= this.maxQuantity;
          },
          message: 'defaultQuantity must be between minQuantity and maxQuantity inclusive',
        },
      ],
    },
    requiresAnchorService: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { _id: false }
);

const AestheticSignalsSchema = new Schema<IAestheticSignals>(
  {
    occasionTags: {
      type: [String],
      enum: [...OCCASION_TAGS],
      required: true,
      validate: [
        {
          validator: (arr: string[]) => arr.length >= 1,
          message: 'occasionTags must contain at least one value',
        },
      ],
    },
    styleArchetypeTags: {
      type: [String],
      enum: [...STYLE_ARCHETYPES],
      default: [],
    },
    aiDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
  },
  { _id: false }
);

const CheckoutMetaSchema = new Schema<ICheckoutMeta>(
  {
    checkoutCategory: {
      type: String,
      enum: [...CHECKOUT_CATEGORY],
      required: true,
    },
    displayPriority: {
      type: Number,
      default: 0,
    },
    estimateContribution: {
      type: String,
      enum: [...ESTIMATE_CONTRIBUTION],
      required: true,
    },
    bundleEligible: {
      type: Boolean,
      default: false,
    },
    requiresConsultation: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const ServiceFlagsSchema = new Schema<IServiceFlags>(
  {
    isActive: {
      type: Boolean,
      default: true,
    },
    isSignatureService: {
      type: Boolean,
      default: false,
    },
    isNewlyAdded: {
      type: Boolean,
      default: false,
    },
    newlyAddedExpiresAt: {
      type: Date,
    },
  },
  { _id: false }
);

const ServiceSchema = new Schema<IService>(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [...SERVICE_CATEGORY],
      required: true,
    },
    serviceRole: {
      type: String,
      enum: [...SERVICE_ROLE],
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 600,
    },
    compatibleAnchorCategories: {
      type: [String],
      enum: [...SERVICE_CATEGORY],
      default: [],
    },
    duration: {
      type: ServiceDurationSchema,
      required: true,
    },
    pricing: {
      type: ServicePricingSchema,
      required: true,
    },
    partyConfig: {
      type: PartyConfigSchema,
      required: true,
    },
    aestheticSignals: {
      type: AestheticSignalsSchema,
      required: true,
    },
    checkoutMeta: {
      type: CheckoutMetaSchema,
      required: true,
    },
    flags: {
      type: ServiceFlagsSchema,
      default: () => ({
        isActive: true,
        isSignatureService: false,
        isNewlyAdded: false,
      }),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ServiceSchema.index({ vendor: 1, slug: 1 }, { unique: true });
ServiceSchema.index({ vendor: 1, serviceRole: 1 });
ServiceSchema.index({ vendor: 1, 'flags.isActive': 1 });
ServiceSchema.index({ vendor: 1, 'checkoutMeta.checkoutCategory': 1, 'checkoutMeta.displayPriority': 1 });
ServiceSchema.index({ category: 1, 'pricing.unitPriceINR': 1 });
ServiceSchema.index({ serviceRole: 1, 'pricing.unitPriceINR': 1 });
ServiceSchema.index({ 'aestheticSignals.occasionTags': 1 });
ServiceSchema.index({ 'aestheticSignals.styleArchetypeTags': 1 });
ServiceSchema.index({ 'flags.isActive': 1, serviceRole: 1 });
ServiceSchema.index({ 'flags.isSignatureService': 1, vendor: 1 });

const Service = (models.Service as Model<IService>) || model<IService>('Service', ServiceSchema);

export default Service;

import type { ClientVendor } from './match';

export interface PortfolioItem {
  _id: string;
  imageUrl: string;
  altText: string;
  primaryOccasion: string;
  styleArchetypesShown: string[];
  colorPaletteShown: string[];
  captionForAI: string;
  isHeroImage: boolean;
  sortOrder: number;
}

export interface ArtistContact {
  phone: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  website?: string;
}

export interface ArtistBusinessMeta {
  yearsOfExperience: number;
  teamSize: number;
  languagesSpoken: string[];
  bookingLeadTimeDays: number;
  trialsOffered: boolean;
  trialDurationMinutes?: number;
}

export interface ArtistAestheticProfile {
  styleArchetypes: string[];
  makeupFinishTags: string[];
  hairStyleTags: string[];
  occasionSpecializations: string[];
  colorPaletteAffinity: string[];
  skinToneExpertise: string[];
  inspirationReferences?: string[];
  signatureElements?: string;
  aestheticBio: string;
  moodKeywords?: string[];
  contraIndicators?: string[];
  contraIndicatorsNotes?: string;
}

export interface ArtistProfile extends Omit<ClientVendor, 'aestheticProfile'> {
  bio?: string;
  contact: ArtistContact;
  businessMeta: ArtistBusinessMeta;
  aestheticProfile: ArtistAestheticProfile;
  portfolio: PortfolioItem[];
}

export interface GroupDiscountTier {
  minQuantity: number;
  discountPercent: number;
  tierLabel: string;
}

export interface ClientService {
  _id: string;
  vendor: string;
  name: string;
  slug: string;
  category: string;
  serviceRole: 'anchor' | 'add-on' | 'standalone' | 'trial';
  description?: string;
  compatibleAnchorCategories: string[];
  duration: {
    baseDurationMinutes: number;
    additionalPersonMinutes: number;
    bufferMinutes: number;
    canRunConcurrentlyWithAnchor: boolean;
  };
  pricing: {
    unitPriceINR: number;
    priceType: string;
    minimumChargeINR?: number;
    groupDiscountTiers: GroupDiscountTier[];
    travelSurchargeApplicable: boolean;
    trialCreditINR?: number;
  };
  partyConfig: {
    isQuantifiable: boolean;
    recipientType: string;
    quantityLabel: string;
    minQuantity: number;
    maxQuantity: number;
    defaultQuantity: number;
    requiresAnchorService: boolean;
  };
  aestheticSignals: {
    occasionTags: string[];
    styleArchetypeTags: string[];
    aiDescription: string;
  };
  checkoutMeta: {
    checkoutCategory: string;
    displayPriority: number;
    estimateContribution: string;
    bundleEligible: boolean;
    requiresConsultation: boolean;
  };
  flags: {
    isActive: boolean;
    isSignatureService: boolean;
    isNewlyAdded: boolean;
  };
}

export interface EstimateLineItem {
  name: string;
  quantity: number;
  unitPriceINR: number;
  discountPct: number;
  subtotalINR: number;
  discountLabel?: string;
}

export interface EstimateResult {
  lineItems: EstimateLineItem[];
  total: number;
  depositAmount: number;
}

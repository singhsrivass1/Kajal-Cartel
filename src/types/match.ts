export interface ClientVendorLocation {
  microLocation: string;
  city: string;
  travelPolicy: string;
}

export interface ClientVendorPricing {
  tier: string;
  startingFromINR: number;
}

export interface ClientVendorRatings {
  averageRating: number;
  totalReviews: number;
}

export interface ClientVendorFlags {
  badgeType: string | null;
  isVerified: boolean;
  isFeatured: boolean;
}

export interface ClientVendorAestheticProfile {
  styleArchetypes: string[];
  signatureElements?: string;
}

export interface ClientVendorServiceSummary {
  serviceCount: number;
  anchorServiceCount: number;
  priceRangeINR: { min: number; max: number };
  occasionCoverage: string[];
  hasTrialOffering: boolean;
}

export interface ClientVendor {
  _id: string;
  name: string;
  slug: string;
  tagline: string;
  profileImageUrl: string;
  location: ClientVendorLocation;
  pricing: ClientVendorPricing;
  ratings: ClientVendorRatings;
  flags: ClientVendorFlags;
  aestheticProfile: ClientVendorAestheticProfile;
  serviceSummary: ClientVendorServiceSummary;
}

export interface MatchResult {
  vendor: ClientVendor;
  matchedTags: string[];
  confidenceScore: number;
  matchRationale: string;
}

export interface StyleDNAEntry {
  label: string;
  score: number;
}

export interface ImageProfile {
  styleArchetypes: string[];
  makeupFinishTags: string[];
  colorPaletteAffinity: string[];
  occasionSignals: string[];
  skinToneSignals: string[];
  visualNarrative: string;
}

export interface MatchResponse {
  matches: MatchResult[];
  imageProfile: ImageProfile;
  styleDNA: StyleDNAEntry[];
  editorialAnalysis: string;
}
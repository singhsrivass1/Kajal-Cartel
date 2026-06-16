export const STYLE_ARCHETYPES = [
  'sabyasachi-minimalist',
  'heavy-royal-mughlai',
  'glass-skin-glam',
  'old-delhi-heritage',
  'contemporary-editorial',
  'pastel-dreamscape',
  'dark-romanticism',
  'punjabi-grandeur',
  'south-delhi-chic',
  'indo-western-fusion',
  'manish-malhotra-shimmer',
  'raw-mango-organic',
] as const;

export const MAKEUP_FINISH_TAGS = [
  'dewy-glass-skin',
  'matte-velvet',
  'satin-glow',
  'hd-matte-flash',
  'no-makeup-makeup',
  'dramatic-cut-crease',
  'smoky-kohl-eye',
  'glitter-foil-statement',
  'airbrush-finish',
] as const;

export const COLOR_PALETTE_TAGS = [
  'ivory-and-gold-neutral',
  'jewel-tone-maximalist',
  'champagne-and-blush-soft',
  'saffron-and-vermillion-traditional',
  'monochrome-editorial',
  'earth-and-terracotta-organic',
  'deep-burgundy-and-plum-moody',
  'pastel-multicolor',
] as const;

export const OCCASION_TAGS = [
  'wedding-day-bridal',
  'sangeet-night-glam',
  'mehendi-ceremony',
  'haldi-ceremony',
  'baraat-reception',
  'cocktail-pre-wedding',
  'pre-wedding-shoot',
] as const;

export const SKIN_TONE_TAGS = [
  'fair-and-porcelain',
  'wheatish-warm-undertone',
  'deep-and-rich',
  'olive-mediterranean',
  'pan-spectrum-expert',
] as const;

export const HAIR_STYLE_TAGS = [
  'gajra-forward-traditional',
  'sleek-low-bun-couture',
  'loose-boho-waves',
  'heavy-floral-crown',
  'structured-updo',
  'retro-vintage-set',
  'extension-and-volume',
] as const;

export const MICRO_LOCATIONS = [
  'Greater Kailash I',
  'Greater Kailash II',
  'South Extension',
  'Hauz Khas',
  'Vasant Kunj',
  'Vasant Vihar',
  'Malviya Nagar',
  'Saket',
  'Karol Bagh',
  'Lajpat Nagar',
  'Defence Colony',
  'Khan Market',
  'Connaught Place',
  'Dwarka',
  'Noida',
  'Gurugram',
] as const;

export const TRAVEL_POLICY = [
  'studio-only',
  'home-visits',
  'venue-visits',
  'all',
] as const;

export const PRICING_TIER = [
  'ultra-luxury',
  'luxury',
  'premium',
  'aspirational',
] as const;

export const BADGE_TYPE = [
  'The Cartel Core',
  'Vanguard Stylist',
  'Heritage Master',
] as const;

export const CONTRA_INDICATORS = [
  'no-airbrush',
  'no-at-home-service',
  'no-synthetic-extensions',
  'no-heavy-contouring',
] as const;

export const SERVICE_CATEGORY = [
  'bridal-beauty',
  'hair-styling',
  'skincare-prep',
  'airbrush-artistry',
  'mehndi-coordination',
  'party-glam',
  'grooming',
] as const;

export const SERVICE_ROLE = [
  'anchor',
  'add-on',
  'standalone',
  'trial',
] as const;

export const PRICE_TYPE = [
  'per-person',
  'per-service',
  'per-hour',
] as const;

export const CHECKOUT_CATEGORY = [
  'primary',
  'secondary',
  'optional',
] as const;

export const ESTIMATE_CONTRIBUTION = [
  'fixed',
  'per-unit',
  'tiered',
] as const;

export const RECIPIENT_TYPE = [
  'bride',
  'bridesmaid',
  'mother-of-bride',
  'family-member',
  'any',
] as const;

export type StyleArchetype = (typeof STYLE_ARCHETYPES)[number];
export type MakeupFinishTag = (typeof MAKEUP_FINISH_TAGS)[number];
export type ColorPaletteTag = (typeof COLOR_PALETTE_TAGS)[number];
export type OccasionTag = (typeof OCCASION_TAGS)[number];
export type SkinToneTag = (typeof SKIN_TONE_TAGS)[number];
export type HairStyleTag = (typeof HAIR_STYLE_TAGS)[number];
export type MicroLocation = (typeof MICRO_LOCATIONS)[number];
export type TravelPolicy = (typeof TRAVEL_POLICY)[number];
export type PricingTier = (typeof PRICING_TIER)[number];
export type BadgeType = (typeof BADGE_TYPE)[number];
export type ContraIndicator = (typeof CONTRA_INDICATORS)[number];
export type ServiceCategory = (typeof SERVICE_CATEGORY)[number];
export type ServiceRole = (typeof SERVICE_ROLE)[number];
export type PriceType = (typeof PRICE_TYPE)[number];
export type CheckoutCategory = (typeof CHECKOUT_CATEGORY)[number];
export type EstimateContribution = (typeof ESTIMATE_CONTRIBUTION)[number];
export type RecipientType = (typeof RECIPIENT_TYPE)[number];

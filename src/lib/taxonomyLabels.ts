export const ARCHETYPE_LABEL: Record<string, string> = {
  'sabyasachi-minimalist': 'Minimal, understated bridal looks',
  'raw-mango-organic': 'Natural, handloom-inspired styles',
  'south-delhi-chic': 'Clean, refined finishes',
  'heavy-royal-mughlai': 'Rich Mughal-inspired traditional looks',
  'old-delhi-heritage': 'Classic Old Delhi bridal styles',
  'punjabi-grandeur': 'Vibrant, celebratory Punjabi looks',
  'manish-malhotra-shimmer': 'Glamorous Bollywood-inspired styles',
  'dark-romanticism': 'Dramatic, moody evening looks',
  'contemporary-editorial': 'Fashion-forward editorial styles',
  'glass-skin-glam': 'Dewy, photography-perfect skin',
  'indo-western-fusion': 'Modern fusion bridal looks',
  'pastel-dreamscape': 'Soft romantic pastel looks',
};

export const ARCHETYPE_SHORT_LABEL: Record<string, string> = {
  'sabyasachi-minimalist': 'Minimal bridal',
  'raw-mango-organic': 'Natural & organic',
  'south-delhi-chic': 'Refined chic',
  'heavy-royal-mughlai': 'Royal Mughal',
  'old-delhi-heritage': 'Old Delhi heritage',
  'punjabi-grandeur': 'Punjabi grandeur',
  'manish-malhotra-shimmer': 'Bollywood glam',
  'dark-romanticism': 'Dark romantic',
  'contemporary-editorial': 'Editorial',
  'glass-skin-glam': 'Glass skin',
  'indo-western-fusion': 'Indo-western fusion',
  'pastel-dreamscape': 'Pastel dreamy',
};

export const OCCASION_LABEL: Record<string, string> = {
  'wedding-day-bridal': 'Wedding ceremony',
  'sangeet-night-glam': 'Sangeet and evening events',
  'mehendi-ceremony': 'Mehendi',
  'haldi-ceremony': 'Haldi',
  'baraat-reception': 'Reception',
  'cocktail-pre-wedding': 'Engagement and cocktail events',
  'pre-wedding-shoot': 'Pre-wedding photo shoots',
};

export const SERVICE_CATEGORY_LABEL: Record<string, string> = {
  'bridal-beauty': 'Bridal makeup',
  'hair-styling': 'Hair styling',
  'skincare-prep': 'Skin prep',
  'airbrush-artistry': 'Airbrush makeup',
  'mehndi-coordination': 'Mehndi',
  'party-glam': 'Party glam',
  grooming: 'Grooming',
};

export const TRAVEL_LABEL: Record<string, string> = {
  'studio-only': 'Studio only',
  'home-visits': 'Studio and home visits',
  'venue-visits': 'Studio and venue visits',
  all: 'Studio, home and venue visits',
};

export const PRICE_TYPE_LABEL: Record<string, string> = {
  'per-person': 'per person',
  'per-service': 'per service',
  'per-hour': 'per hour',
};

export const SERVICE_ROLE_LABEL: Record<string, string> = {
  anchor: 'Main look',
  'add-on': 'Add-on',
  standalone: 'Standalone service',
  trial: 'Trial',
};

export function labelFor(map: Record<string, string>, value: string): string {
  return map[value] ?? value.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

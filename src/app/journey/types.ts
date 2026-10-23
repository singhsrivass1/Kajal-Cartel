import type { CustomerBookingSummary } from '@/lib/db/controllers/BookingViews';
import type { BoardSummary } from '@/lib/db/controllers/BoardManager';

export type JourneyTab = 'bookings' | 'artists' | 'looks' | 'boards';

export interface SavedVendorView {
  slug: string;
  name: string;
  tagline: string;
  profileImageUrl: string;
  microLocation: string;
  fromPriceINR: number | null;
  averageRating: number;
  totalReviews: number;
  badgeType: string | null;
}

export interface SavedMoodboardSummary {
  id: string;
  label: string;
  styleDNA: Array<{ label: string; score: number }>;
  editorialAnalysis: string;
  savedAt: string;
}

export interface JourneyData {
  user: { name: string; email: string; image: string };
  savedVendors: SavedVendorView[];
  savedMoodboards: SavedMoodboardSummary[];
  bookings: CustomerBookingSummary[];
  boards: BoardSummary[];
}

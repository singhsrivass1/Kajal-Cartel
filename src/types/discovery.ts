import type { ClientVendor } from './match';

export interface DiscoverVendorFacets {
  fromPriceINR: number | null;
  serviceCategories: string[];
  occasions: string[];
  acceptsOnlineBooking: boolean;
}

export interface DiscoverVendor extends ClientVendor {
  facets: DiscoverVendorFacets;
}

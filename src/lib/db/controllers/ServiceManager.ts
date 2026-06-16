import { Types } from 'mongoose';
import Service from '@/lib/db/models/Service';
import type { EstimateLineItem, EstimateResult } from '@/types/artist';

export class EstimateValidationError extends Error {
  readonly statusCode: 400 | 404 | 422;

  constructor(message: string, statusCode: 400 | 404 | 422 = 400) {
    super(message);
    this.name = 'EstimateValidationError';
    this.statusCode = statusCode;
  }
}

export interface AddOnRequest {
  serviceId: string;
  quantity: number;
}

export interface BookingEstimateRequest {
  anchorServiceId: string;
  addOns: AddOnRequest[];
}

interface RawGroupDiscountTier {
  minQuantity: number;
  discountPercent: number;
  tierLabel: string;
}

function applyTieredDiscount(
  baseUnitPriceINR: number,
  quantity: number,
  tiers: RawGroupDiscountTier[]
): { unitPrice: number; discountPct: number; discountLabel?: string } {
  const activeTier = tiers
    .filter((t) => quantity >= t.minQuantity)
    .sort((a, b) => b.discountPercent - a.discountPercent)[0];

  if (!activeTier) {
    return { unitPrice: baseUnitPriceINR, discountPct: 0 };
  }

  return {
    unitPrice: Math.round((baseUnitPriceINR * (100 - activeTier.discountPercent)) / 100),
    discountPct: activeTier.discountPercent,
    discountLabel: activeTier.tierLabel,
  };
}

export async function calculateBookingEstimate(
  request: BookingEstimateRequest
): Promise<EstimateResult> {
  const { anchorServiceId, addOns } = request;

  const anchor = await Service.findOne({
    _id: new Types.ObjectId(anchorServiceId),
    serviceRole: 'anchor',
    'flags.isActive': true,
  }).lean<Record<string, any>>();

  if (!anchor) {
    throw new EstimateValidationError(
      'The selected look is no longer available. Please refresh and choose again.',
      404
    );
  }

  if (!addOns.length) {
    const unitPrice: number = anchor.pricing.unitPriceINR;
    return {
      lineItems: [
        {
          name: anchor.name,
          quantity: 1,
          unitPriceINR: unitPrice,
          discountPct: 0,
          subtotalINR: unitPrice,
        },
      ],
      total: unitPrice,
      depositAmount: Math.round(unitPrice * 0.3),
    };
  }

  const addOnIds = addOns.map((a) => a.serviceId);
  const uniqueAddOnIds = new Set(addOnIds);

  if (uniqueAddOnIds.size !== addOnIds.length) {
    throw new EstimateValidationError(
      'Duplicate service IDs found in the add-ons list. Each service may only appear once.'
    );
  }

  if (addOnIds.includes(anchorServiceId)) {
    throw new EstimateValidationError(
      'The anchor service cannot also appear as an add-on.'
    );
  }

  const fetchedAddOns = await Service.find({
    _id: { $in: addOnIds.map((id) => new Types.ObjectId(id)) },
    'flags.isActive': true,
  }).lean<Record<string, any>[]>();

  if (fetchedAddOns.length !== addOnIds.length) {
    const foundIds = new Set(fetchedAddOns.map((s) => s._id.toString()));
    const missingId = addOnIds.find((id) => !foundIds.has(id));
    throw new EstimateValidationError(
      `Service ${missingId} was not found or is no longer available.`,
      404
    );
  }

  const anchorVendorId = anchor.vendor.toString();

  for (const service of fetchedAddOns) {
    if (service.vendor.toString() !== anchorVendorId) {
      throw new EstimateValidationError(
        'All services must belong to the same artist. This request has been rejected.'
      );
    }

    if (service.serviceRole !== 'add-on') {
      throw new EstimateValidationError(
        `"${service.name}" is not a valid add-on service and cannot be included in this estimate.`
      );
    }

    const compatibleCategories: string[] = service.compatibleAnchorCategories ?? [];
    if (
      compatibleCategories.length > 0 &&
      !compatibleCategories.includes(anchor.category)
    ) {
      throw new EstimateValidationError(
        `"${service.name}" is not compatible with the selected look.`
      );
    }
  }

  const quantityMap = new Map<string, number>(
    addOns.map((a) => [a.serviceId, a.quantity])
  );

  for (const service of fetchedAddOns) {
    const qty = quantityMap.get(service._id.toString())!;
    const { minQuantity, maxQuantity } = service.partyConfig;
    if (qty < minQuantity || qty > maxQuantity) {
      throw new EstimateValidationError(
        `Quantity ${qty} for "${service.name}" is outside the permitted range of ${minQuantity}–${maxQuantity}.`
      );
    }
  }

  const lineItems: EstimateLineItem[] = [];

  lineItems.push({
    name: anchor.name,
    quantity: 1,
    unitPriceINR: anchor.pricing.unitPriceINR,
    discountPct: 0,
    subtotalINR: anchor.pricing.unitPriceINR,
  });

  const addOnServiceMap = new Map(
    fetchedAddOns.map((s) => [s._id.toString(), s])
  );

  for (const addOnRequest of addOns) {
    const service = addOnServiceMap.get(addOnRequest.serviceId)!;
    const { quantity } = addOnRequest;
    const baseUnitPrice: number = service.pricing.unitPriceINR;

    let computedUnitPrice = baseUnitPrice;
    let discountPct = 0;
    let discountLabel: string | undefined;

    if (service.checkoutMeta.estimateContribution === 'tiered') {
      const tiers: RawGroupDiscountTier[] = service.pricing.groupDiscountTiers ?? [];
      const result = applyTieredDiscount(baseUnitPrice, quantity, tiers);
      computedUnitPrice = result.unitPrice;
      discountPct = result.discountPct;
      discountLabel = result.discountLabel;
    }

    let subtotalINR = computedUnitPrice * quantity;

    if (
      typeof service.pricing.minimumChargeINR === 'number' &&
      service.pricing.minimumChargeINR > subtotalINR
    ) {
      subtotalINR = service.pricing.minimumChargeINR;
    }

    lineItems.push({
      name: service.name,
      quantity,
      unitPriceINR: baseUnitPrice,
      discountPct,
      subtotalINR,
      discountLabel,
    });
  }

  const total = lineItems.reduce((sum, item) => sum + item.subtotalINR, 0);
  const depositAmount = Math.round(total * 0.3);

  return { lineItems, total, depositAmount };
}

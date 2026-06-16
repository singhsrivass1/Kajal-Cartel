import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { dbConnect } from '@/lib/db/connect';
import {
  calculateBookingEstimate,
  EstimateValidationError,
} from '@/lib/db/controllers/ServiceManager';
import type {
  AddOnRequest,
  BookingEstimateRequest,
} from '@/lib/db/controllers/ServiceManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isValidObjectId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Types.ObjectId.isValid(value);
}

function validatePayload(body: unknown): BookingEstimateRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new EstimateValidationError(
      'Request body must be a JSON object with anchorServiceId and addOns fields.'
    );
  }

  const raw = body as Record<string, unknown>;

  if (!isValidObjectId(raw.anchorServiceId)) {
    throw new EstimateValidationError(
      'anchorServiceId must be a valid service ID string.'
    );
  }

  if (!Array.isArray(raw.addOns)) {
    throw new EstimateValidationError('addOns must be an array.');
  }

  if (raw.addOns.length > 20) {
    throw new EstimateValidationError(
      'addOns cannot contain more than 20 items per estimate request.'
    );
  }

  const addOns: AddOnRequest[] = [];

  for (const [i, item] of (raw.addOns as unknown[]).entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new EstimateValidationError(
        `addOns[${i}] must be an object with serviceId and quantity fields.`
      );
    }

    const entry = item as Record<string, unknown>;

    if (!isValidObjectId(entry.serviceId)) {
      throw new EstimateValidationError(
        `addOns[${i}].serviceId must be a valid service ID string.`
      );
    }

    if (
      typeof entry.quantity !== 'number' ||
      !Number.isInteger(entry.quantity) ||
      entry.quantity < 1 ||
      entry.quantity > 50
    ) {
      throw new EstimateValidationError(
        `addOns[${i}].quantity must be a positive integer between 1 and 50.`
      );
    }

    addOns.push({
      serviceId: entry.serviceId as string,
      quantity: entry.quantity as number,
    });
  }

  return {
    anchorServiceId: raw.anchorServiceId as string,
    addOns,
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  try {
    const payload = validatePayload(body);
    await dbConnect();
    const result = await calculateBookingEstimate(payload);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof EstimateValidationError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }

    console.error('[POST /api/estimate] Unhandled error:', err);

    return NextResponse.json(
      { error: 'An unexpected error occurred while calculating the estimate.' },
      { status: 500 }
    );
  }
}

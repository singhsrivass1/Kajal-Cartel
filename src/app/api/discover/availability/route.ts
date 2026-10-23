import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { findVendorSlugsAvailableOn } from '@/lib/db/controllers/DiscoveryManager';
import { AvailabilityValidationError } from '@/lib/db/controllers/AvailabilityManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<NextResponse> {
  const limited = enforceRateLimit(request, 'availability-search', RATE_LIMITS.availabilitySearch);
  if (limited) return limited;

  const date = new URL(request.url).searchParams.get('date') ?? '';
  try {
    await dbConnect();
    const slugs = await findVendorSlugsAvailableOn(date);
    return NextResponse.json({ date, slugs }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof AvailabilityValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[GET /api/vendors/available] Unhandled error:', err);
    return NextResponse.json({ error: 'Could not check availability right now. Please try again.' }, { status: 500 });
  }
}

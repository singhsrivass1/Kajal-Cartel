import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import { getDailyAvailability, AvailabilityValidationError } from '@/lib/db/controllers/AvailabilityManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const serviceId = searchParams.get('serviceId');

  if (!date) {
    return NextResponse.json(
      { error: 'date query parameter is required (YYYY-MM-DD).' },
      { status: 400 }
    );
  }
  if (!serviceId) {
    return NextResponse.json(
      { error: 'serviceId query parameter is required.' },
      { status: 400 }
    );
  }

  try {
    await dbConnect();
    const result = await getDailyAvailability({ vendorSlug: params.slug, serviceId, date });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof AvailabilityValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }

    console.error('[GET /api/vendors/[slug]/availability] Unhandled error:', err);

    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching availability.' },
      { status: 500 }
    );
  }
}

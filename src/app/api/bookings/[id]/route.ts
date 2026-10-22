import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin';
import { dbConnect } from '@/lib/db/connect';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { updateBookingStatus, BookingValidationError } from '@/lib/db/controllers/BookingManager';
import { BOOKING_STATUSES } from '@/lib/db/models/Booking';
import type { BookingStatus } from '@/lib/db/models/Booking';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const session = await getAdminSession();

  if (!session) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  // This route predates the withAdmin wrapper and gates itself, so it needs the
  // admin rate limit applied explicitly rather than inheriting it.
  const adminId = (session.user as { id?: string } | undefined)?.id ?? session.user?.email ?? 'admin';
  const limited = enforceRateLimit(request, 'admin', RATE_LIMITS.admin, { userId: adminId });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;

  if (typeof raw.status !== 'string' || !(BOOKING_STATUSES as readonly string[]).includes(raw.status)) {
    return NextResponse.json(
      { error: `status is required and must be one of: ${BOOKING_STATUSES.join(', ')}.` },
      { status: 400 }
    );
  }

  try {
    await dbConnect();
    const result = await updateBookingStatus({
      bookingId: params.id,
      status: raw.status as BookingStatus,
      adminNotes: typeof raw.adminNotes === 'string' ? raw.adminNotes : undefined,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[PATCH /api/bookings/[id]] Unhandled error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while updating the booking.' },
      { status: 500 }
    );
  }
}

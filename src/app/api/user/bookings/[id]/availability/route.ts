import { withUser } from '@/lib/api/userRoute';
import { RATE_LIMITS } from '@/lib/api/rateLimit';
import { getRescheduleAvailability } from '@/lib/db/controllers/BookingManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const date = new URL(request.url).searchParams.get('date') ?? '';
  return withUser(
    request,
    'GET /api/user/bookings/[id]/availability',
    async ({ userId }) => getRescheduleAvailability(userId, params.id, date),
    { scope: 'availability', rule: RATE_LIMITS.availabilitySearch }
  );
}

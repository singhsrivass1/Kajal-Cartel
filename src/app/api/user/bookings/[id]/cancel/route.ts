import { withUser, readJsonObject } from '@/lib/api/userRoute';
import { RATE_LIMITS } from '@/lib/api/rateLimit';
import { cancelBookingAsCustomer } from '@/lib/db/controllers/BookingManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return withUser(
    request,
    'POST /api/user/bookings/[id]/cancel',
    async ({ userId }) => {
      const body = await readJsonObject(request);
      const booking = await cancelBookingAsCustomer(userId, params.id, body.reason);
      return { booking };
    },
    { scope: 'booking-change', rule: RATE_LIMITS.bookingChange }
  );
}

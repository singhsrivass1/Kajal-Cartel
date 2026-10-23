import { withUser, readJsonObject } from '@/lib/api/userRoute';
import { RATE_LIMITS } from '@/lib/api/rateLimit';
import { rescheduleBookingAsCustomer } from '@/lib/db/controllers/BookingManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return withUser(
    request,
    'POST /api/user/bookings/[id]/reschedule',
    async ({ userId }) => {
      const body = await readJsonObject(request);
      const booking = await rescheduleBookingAsCustomer(userId, params.id, {
        date: typeof body.date === 'string' ? body.date : '',
        slotStart: typeof body.slotStart === 'string' ? body.slotStart : '',
      });
      return { booking };
    },
    { scope: 'booking-change', rule: RATE_LIMITS.bookingChange }
  );
}

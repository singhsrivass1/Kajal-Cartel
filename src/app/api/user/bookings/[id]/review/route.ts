import { withUser, readJsonObject } from '@/lib/api/userRoute';
import { RATE_LIMITS } from '@/lib/api/rateLimit';
import { createReview } from '@/lib/db/controllers/ReviewManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return withUser(
    request,
    'POST /api/user/bookings/[id]/review',
    async ({ userId }) => {
      const body = await readJsonObject(request);
      return createReview(userId, params.id, { rating: body.rating, title: body.title, body: body.body });
    },
    { scope: 'review', rule: RATE_LIMITS.review }
  );
}

import { withUser, readJsonObject } from '@/lib/api/userRoute';
import { RATE_LIMITS } from '@/lib/api/rateLimit';
import { updateOwnReview, deleteOwnReview } from '@/lib/db/controllers/ReviewManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return withUser(
    request,
    'PATCH /api/user/reviews/[id]',
    async ({ userId }) => {
      const body = await readJsonObject(request);
      await updateOwnReview(userId, params.id, { rating: body.rating, title: body.title, body: body.body });
      return { success: true };
    },
    { scope: 'review', rule: RATE_LIMITS.review }
  );
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  return withUser(
    request,
    'DELETE /api/user/reviews/[id]',
    async ({ userId }) => {
      await deleteOwnReview(userId, params.id);
      return { success: true };
    },
    { scope: 'review', rule: RATE_LIMITS.review }
  );
}

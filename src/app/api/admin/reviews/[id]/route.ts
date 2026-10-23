import { getAdminSession } from '@/lib/auth/admin';
import { withAdmin, readJson } from '@/lib/api/adminRoute';
import { deleteReviewAsAdmin, moderateReview, ReviewError } from '@/lib/db/controllers/ReviewManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return withAdmin(
    async () => {
      const body = await readJson(request);
      if (body.status !== 'published' && body.status !== 'hidden') {
        throw new ReviewError('status must be "published" or "hidden".');
      }
      const session = await getAdminSession();
      const adminId = (session?.user as { id?: string } | undefined)?.id ?? '';
      await moderateReview(adminId, params.id, body.status, body.note);
      return { success: true };
    },
    'PATCH /api/admin/reviews/[id]',
    request
  );
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  return withAdmin(
    async () => {
      await deleteReviewAsAdmin(params.id);
      return { success: true };
    },
    'DELETE /api/admin/reviews/[id]',
    request
  );
}

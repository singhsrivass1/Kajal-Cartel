import { withUser, readJsonObject } from '@/lib/api/userRoute';
import { RATE_LIMITS } from '@/lib/api/rateLimit';
import { removeItem, updateItemNote } from '@/lib/db/controllers/BoardManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: { id: string; itemId: string } }) {
  return withUser(
    request,
    'PATCH /api/user/boards/[id]/items/[itemId]',
    async ({ userId }) => {
      const body = await readJsonObject(request);
      await updateItemNote(userId, params.id, params.itemId, body.note);
      return { success: true };
    },
    { scope: 'boards', rule: RATE_LIMITS.generalWrite }
  );
}

export async function DELETE(request: Request, { params }: { params: { id: string; itemId: string } }) {
  return withUser(
    request,
    'DELETE /api/user/boards/[id]/items/[itemId]',
    async ({ userId }) => {
      await removeItem(userId, params.id, params.itemId);
      return { success: true };
    },
    { scope: 'boards', rule: RATE_LIMITS.generalWrite }
  );
}

import { withUser, readJsonObject } from '@/lib/api/userRoute';
import { RATE_LIMITS } from '@/lib/api/rateLimit';
import { BoardError, deleteBoard, getBoard, updateBoard } from '@/lib/db/controllers/BoardManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  return withUser(request, 'GET /api/user/boards/[id]', async ({ userId }) => {
    const board = await getBoard(userId, params.id);
    if (!board) throw new BoardError('Moodboard not found.', 404);
    return { board };
  });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return withUser(
    request,
    'PATCH /api/user/boards/[id]',
    async ({ userId }) => {
      const body = await readJsonObject(request);
      return { board: await updateBoard(userId, params.id, body) };
    },
    { scope: 'boards', rule: RATE_LIMITS.generalWrite }
  );
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  return withUser(
    request,
    'DELETE /api/user/boards/[id]',
    async ({ userId }) => {
      await deleteBoard(userId, params.id);
      return { success: true };
    },
    { scope: 'boards', rule: RATE_LIMITS.generalWrite }
  );
}

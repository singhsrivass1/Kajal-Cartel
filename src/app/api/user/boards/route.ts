import { withUser, readJsonObject } from '@/lib/api/userRoute';
import { RATE_LIMITS } from '@/lib/api/rateLimit';
import { createBoard, listBoards } from '@/lib/db/controllers/BoardManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  return withUser(request, 'GET /api/user/boards', async ({ userId }) => ({ boards: await listBoards(userId) }));
}

export async function POST(request: Request) {
  return withUser(
    request,
    'POST /api/user/boards',
    async ({ userId }) => {
      const body = await readJsonObject(request);
      return { board: await createBoard(userId, body) };
    },
    { scope: 'boards', rule: RATE_LIMITS.generalWrite }
  );
}

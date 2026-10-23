import { withUser, readJsonObject } from '@/lib/api/userRoute';
import { RATE_LIMITS } from '@/lib/api/rateLimit';
import { addItem, uploadBoardImage } from '@/lib/db/controllers/BoardManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const isUpload = new URL(request.url).searchParams.get('upload') === '1';
  return withUser(
    request,
    'POST /api/user/boards/[id]/items',
    async ({ userId }) => {
      const body = await readJsonObject(request);
      return isUpload ? uploadBoardImage(userId, params.id, body) : addItem(userId, params.id, body);
    },
    isUpload
      ? { scope: 'board-upload', rule: RATE_LIMITS.boardUpload }
      : { scope: 'boards', rule: RATE_LIMITS.generalWrite }
  );
}

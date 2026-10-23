import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { dbConnect } from '@/lib/db/connect';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { deleteMoodboard, renameMoodboard, MoodboardValidationError } from '@/lib/db/controllers/MoodboardManager';
import { withUser, readJsonObject } from '@/lib/api/userRoute';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  return withUser(
    request,
    'PATCH /api/user/moodboards/[id]',
    async ({ userId }) => {
      const body = await readJsonObject(request);
      return renameMoodboard(userId, params.id, body.label);
    },
    { scope: 'moodboard-rename', rule: RATE_LIMITS.generalWrite }
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  }

  const limited = enforceRateLimit(request, 'moodboard-delete', RATE_LIMITS.generalWrite, { userId });
  if (limited) return limited;

  try {
    await dbConnect();
    await deleteMoodboard(userId, params.id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof MoodboardValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[DELETE /api/user/moodboards/[id]] Unhandled error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while deleting this look.' },
      { status: 500 }
    );
  }
}

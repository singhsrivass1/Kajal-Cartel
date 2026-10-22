import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { dbConnect } from '@/lib/db/connect';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { rematchSavedMoodboard, MoodboardValidationError } from '@/lib/db/controllers/MoodboardManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  }

  // Each call is a fresh Gemini request — capped for cost, not just abuse.
  const limited = enforceRateLimit(request, 'moodboard-rematch', RATE_LIMITS.moodboardRematch, {
    userId,
    message: 'You have refreshed matches several times recently. Please wait a little while before trying again.',
  });
  if (limited) return limited;

  try {
    await dbConnect();
    const matches = await rematchSavedMoodboard(userId, params.id);
    return NextResponse.json({ matches }, { status: 200 });
  } catch (err) {
    if (err instanceof MoodboardValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[POST /api/user/moodboards/[id]/matches] Unhandled error:', err);
    return NextResponse.json(
      {
        error:
          'Kajal Cartel is currently styling an unprecedented number of brides. Please try again in a few moments.',
      },
      { status: 500 }
    );
  }
}

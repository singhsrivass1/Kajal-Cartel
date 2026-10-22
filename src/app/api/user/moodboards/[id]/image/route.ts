import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { dbConnect } from '@/lib/db/connect';
import { getMoodboardImage, MoodboardValidationError } from '@/lib/db/controllers/MoodboardManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  }

  try {
    await dbConnect();
    const image = await getMoodboardImage(userId, params.id);
    const bytes = Buffer.from(image.data, 'base64');
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': image.mimeType,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    if (err instanceof MoodboardValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[GET /api/user/moodboards/[id]/image] Unhandled error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while loading this image.' },
      { status: 500 }
    );
  }
}

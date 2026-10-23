import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/api/userRoute';
import { dbConnect } from '@/lib/db/connect';
import { getBoardImage } from '@/lib/db/controllers/BoardManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const user = await getSessionUserId();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  }

  try {
    await dbConnect();
    const image = await getBoardImage(user.userId, params.id);
    if (!image) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }
    return new NextResponse(Buffer.from(image.data, 'base64'), {
      status: 200,
      headers: {
        'Content-Type': image.mimeType,
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('[GET /api/user/board-images/[id]] Unhandled error:', err);
    return NextResponse.json({ error: 'Could not load this image.' }, { status: 500 });
  }
}

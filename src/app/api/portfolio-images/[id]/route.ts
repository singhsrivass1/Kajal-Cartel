import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { dbConnect } from '@/lib/db/connect';
import PortfolioImage from '@/lib/db/models/PortfolioImage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Public by design, unlike /api/user/moodboards/[id]/image: portfolio images are
 * rendered on public artist profile pages, so gating this behind a session would
 * break the very pages it exists to serve.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  if (!Types.ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  try {
    await dbConnect();
    const image = await PortfolioImage.findById(params.id)
      .select('data mimeType')
      .lean<{ data: string; mimeType: string }>();

    if (!image) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    const bytes = Buffer.from(image.data, 'base64');
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': image.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('[GET /api/portfolio-images/[id]] Unhandled error:', err);
    return NextResponse.json({ error: 'Could not load this image.' }, { status: 500 });
  }
}

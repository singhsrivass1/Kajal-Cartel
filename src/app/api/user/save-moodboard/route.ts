import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { dbConnect } from '@/lib/db/connect';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { saveMoodboard, MoodboardValidationError } from '@/lib/db/controllers/MoodboardManager';
import type { SaveMoodboardRequest } from '@/lib/db/controllers/MoodboardManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function validatePayload(body: unknown): SaveMoodboardRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new MoodboardValidationError('Request body must be a JSON object.');
  }
  const raw = body as Record<string, unknown>;

  if (!raw.image || typeof raw.image !== 'object' || Array.isArray(raw.image)) {
    throw new MoodboardValidationError('image is required.');
  }
  const imageRaw = raw.image as Record<string, unknown>;
  if (typeof imageRaw.data !== 'string' || !imageRaw.data) {
    throw new MoodboardValidationError('image.data is required.');
  }
  if (typeof imageRaw.mimeType !== 'string' || !imageRaw.mimeType) {
    throw new MoodboardValidationError('image.mimeType is required.');
  }

  if (!raw.imageProfile || typeof raw.imageProfile !== 'object' || Array.isArray(raw.imageProfile)) {
    throw new MoodboardValidationError('imageProfile is required.');
  }
  const ip = raw.imageProfile as Record<string, unknown>;

  if (!Array.isArray(raw.styleDNA)) {
    throw new MoodboardValidationError('styleDNA must be an array.');
  }
  const styleDNA: SaveMoodboardRequest['styleDNA'] = [];
  for (const [i, item] of raw.styleDNA.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new MoodboardValidationError(`styleDNA[${i}] must be an object.`);
    }
    const entry = item as Record<string, unknown>;
    if (typeof entry.label !== 'string' || typeof entry.score !== 'number') {
      throw new MoodboardValidationError(`styleDNA[${i}] must have a string label and numeric score.`);
    }
    styleDNA.push({ label: entry.label, score: entry.score });
  }

  if (typeof raw.editorialAnalysis !== 'string') {
    throw new MoodboardValidationError('editorialAnalysis is required.');
  }

  if (raw.label !== undefined && typeof raw.label !== 'string') {
    throw new MoodboardValidationError('label must be a string.');
  }

  return {
    label: typeof raw.label === 'string' ? raw.label : undefined,
    image: { data: imageRaw.data, mimeType: imageRaw.mimeType },
    imageProfile: {
      styleArchetypes: Array.isArray(ip.styleArchetypes) ? ip.styleArchetypes.map(String) : [],
      makeupFinishTags: Array.isArray(ip.makeupFinishTags) ? ip.makeupFinishTags.map(String) : [],
      colorPaletteAffinity: Array.isArray(ip.colorPaletteAffinity) ? ip.colorPaletteAffinity.map(String) : [],
      occasionSignals: Array.isArray(ip.occasionSignals) ? ip.occasionSignals.map(String) : [],
      skinToneSignals: Array.isArray(ip.skinToneSignals) ? ip.skinToneSignals.map(String) : [],
      visualNarrative: typeof ip.visualNarrative === 'string' ? ip.visualNarrative : '',
    },
    styleDNA,
    editorialAnalysis: raw.editorialAnalysis,
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json(
      { error: 'You must be signed in to save a look.' },
      { status: 401 }
    );
  }

  const limited = enforceRateLimit(request, 'moodboard-save', RATE_LIMITS.moodboardSave, {
    userId,
    message: 'You have saved several looks in a short time. Please wait a little while before saving another.',
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  try {
    const payload = validatePayload(body);
    await dbConnect();
    const result = await saveMoodboard(userId, payload);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof MoodboardValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[POST /api/user/save-moodboard] Unhandled error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while saving this look.' },
      { status: 500 }
    );
  }
}

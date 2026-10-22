import { Types } from 'mongoose';
import SavedMoodboard from '@/lib/db/models/SavedMoodboard';
import { generateWithFallbacks } from '@/lib/ai/gemini';
import { fetchActiveRosterVendors, formatRosterBrief } from '@/lib/ai/rosterBrief';
import { serializeClientVendor } from '@/lib/db/serializers/clientVendor';
import type { MatchResult } from '@/types/match';

export class MoodboardValidationError extends Error {
  readonly statusCode: 400 | 401 | 404 | 422;

  constructor(message: string, statusCode: 400 | 401 | 404 | 422 = 400) {
    super(message);
    this.name = 'MoodboardValidationError';
    this.statusCode = statusCode;
  }
}

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
// A 10MB original becomes ~13.3MB as base64. This project's Mongo tier isn't
// confirmed, so this is sized against the conservative assumption of an
// Atlas M0 free cluster (512MB total, shared across every collection, not
// just this one): 10 boards × ~13.3MB ≈ 133MB worst case per user, leaving
// real headroom for multiple users plus the rest of the database. Raise this
// once the actual tier is confirmed to have more room.
const MAX_SAVED_MOODBOARDS_PER_USER = 10;

export interface SaveMoodboardImageProfileInput {
  styleArchetypes: string[];
  makeupFinishTags: string[];
  colorPaletteAffinity: string[];
  occasionSignals: string[];
  skinToneSignals: string[];
  visualNarrative: string;
}

export interface SaveMoodboardRequest {
  label?: string;
  image: { data: string; mimeType: string };
  imageProfile: SaveMoodboardImageProfileInput;
  styleDNA: Array<{ label: string; score: number }>;
  editorialAnalysis: string;
}

export interface SaveMoodboardResult {
  moodboardId: string;
  label: string;
  createdAt: string;
}

function defaultLabel(): string {
  return `Saved Look — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export async function saveMoodboard(
  userId: string,
  request: SaveMoodboardRequest
): Promise<SaveMoodboardResult> {
  const { image, imageProfile, styleDNA, editorialAnalysis } = request;

  if (!image || typeof image.data !== 'string' || !image.data) {
    throw new MoodboardValidationError('image.data is required.');
  }
  if (!image.mimeType || !ALLOWED_IMAGE_MIME_TYPES.includes(image.mimeType)) {
    throw new MoodboardValidationError(
      `image.mimeType must be one of: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}.`
    );
  }
  const estimatedBytes = Math.ceil(image.data.length * 0.75);
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    throw new MoodboardValidationError('Image must be under 10MB.');
  }

  const label = request.label?.trim() ? request.label.trim().slice(0, 80) : defaultLabel();

  const existingCount = await SavedMoodboard.countDocuments({ user: userId });
  if (existingCount >= MAX_SAVED_MOODBOARDS_PER_USER) {
    throw new MoodboardValidationError(
      `You've saved the maximum of ${MAX_SAVED_MOODBOARDS_PER_USER} looks. Please remove one before saving another.`,
      422
    );
  }

  const board = await SavedMoodboard.create({
    user: new Types.ObjectId(userId),
    label,
    image: { data: image.data, mimeType: image.mimeType },
    imageProfile: {
      styleArchetypes: imageProfile?.styleArchetypes ?? [],
      makeupFinishTags: imageProfile?.makeupFinishTags ?? [],
      colorPaletteAffinity: imageProfile?.colorPaletteAffinity ?? [],
      occasionSignals: imageProfile?.occasionSignals ?? [],
      skinToneSignals: imageProfile?.skinToneSignals ?? [],
      visualNarrative: imageProfile?.visualNarrative ?? '',
    },
    styleDNA: Array.isArray(styleDNA)
      ? styleDNA.map((d) => ({ label: String(d.label), score: Math.min(100, Math.max(0, Number(d.score) || 0)) }))
      : [],
    editorialAnalysis: typeof editorialAnalysis === 'string' ? editorialAnalysis : '',
  });

  return {
    moodboardId: (board._id as Types.ObjectId).toString(),
    label: board.label,
    createdAt: board.createdAt.toISOString(),
  };
}

export async function deleteMoodboard(userId: string, moodboardId: string): Promise<void> {
  if (!Types.ObjectId.isValid(moodboardId)) {
    throw new MoodboardValidationError('Invalid moodboard id.');
  }
  const result = await SavedMoodboard.deleteOne({ _id: moodboardId, user: userId });
  if (result.deletedCount === 0) {
    throw new MoodboardValidationError('Saved look not found.', 404);
  }
}

export async function getMoodboardImage(
  userId: string,
  moodboardId: string
): Promise<{ data: string; mimeType: string }> {
  if (!Types.ObjectId.isValid(moodboardId)) {
    throw new MoodboardValidationError('Invalid moodboard id.');
  }
  const board = await SavedMoodboard.findOne({ _id: moodboardId, user: userId })
    .select('image')
    .lean<{ image: { data: string; mimeType: string } }>();
  if (!board) {
    throw new MoodboardValidationError('Saved look not found.', 404);
  }
  return board.image;
}

function buildRematchPrompt(
  styleDNA: Array<{ label: string; score: number }>,
  editorialAnalysis: string,
  visualNarrative: string,
  rosterBrief: string
): string {
  const styleDNALine = styleDNA.length
    ? styleDNA.map((d) => `${d.label} (${d.score}%)`).join(', ')
    : 'Not specified';
  const narrativeLine =
    visualNarrative && visualNarrative !== editorialAnalysis
      ? `\n- Visual Narrative: "${visualNarrative}"`
      : '';

  return `You are the elite Artistic Director for Kajal Cartel, Delhi's most exclusive bridal beauty platform. A bride's reference photo has already been analyzed — do not re-analyze any image. Your task now is ONLY to match her established style profile to our artist roster.

HER STYLE PROFILE:
- Style DNA: ${styleDNALine}
- Editorial Analysis: "${editorialAnalysis}"${narrativeLine}

STEP 1: THE MATCHING PROTOCOL
Match this style profile to EXACTLY THREE artists from our official roster below. You MUST ONLY use the exact slugs provided here:
${rosterBrief}

STEP 2: OUTPUT CONSTRAINTS
Output ONLY a raw, minified JSON object. Do NOT wrap the JSON in markdown code blocks (e.g., \`\`\`json). Do not include any conversational text.

{
  "matches": [
    {
      "artistSlug": "String (Must exactly match a slug from the roster)",
      "confidenceScore": Number (0.00 to 1.00, two decimal places, highest score first),
      "rationale": "String (One precise sentence explaining exactly how this style profile aligns with this artist's signature technique.)"
    }
  ]
}`;
}

function parseRematchResponse(raw: string): {
  matches: Array<{ artistSlug: string; confidenceScore: number; rationale: string }>;
} {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed.matches)) parsed.matches = [];
  return parsed;
}

export async function rematchSavedMoodboard(
  userId: string,
  moodboardId: string
): Promise<MatchResult[]> {
  if (!Types.ObjectId.isValid(moodboardId)) {
    throw new MoodboardValidationError('Invalid moodboard id.');
  }

  const board = await SavedMoodboard.findOne({ _id: moodboardId, user: userId }).lean<{
    styleDNA: Array<{ label: string; score: number }>;
    editorialAnalysis: string;
    imageProfile: { visualNarrative: string };
  }>();
  if (!board) {
    throw new MoodboardValidationError('Saved look not found.', 404);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on this server.');
  }

  const activeVendors = await fetchActiveRosterVendors();
  if (activeVendors.length === 0) {
    throw new Error('No artists are currently available for matching.');
  }

  const prompt = buildRematchPrompt(
    board.styleDNA ?? [],
    board.editorialAnalysis ?? '',
    board.imageProfile?.visualNarrative ?? '',
    formatRosterBrief(activeVendors)
  );

  const rawAI = await generateWithFallbacks([{ text: prompt }], apiKey, '[moodboard-rematch]');
  const parsed = parseRematchResponse(rawAI);

  const validSlugs = parsed.matches
    .map((m) => m.artistSlug)
    .filter((s) => typeof s === 'string' && s.length > 0);
  if (validSlugs.length === 0) {
    throw new Error('No valid artist matches were returned by the AI.');
  }

  // Hydrate from the same roster fetch used to build the prompt — no second query needed.
  const vendorMap = new Map(activeVendors.map((v) => [v.slug, v]));

  const matchedTags = (board.styleDNA ?? []).map((d) => d.label);
  const results: MatchResult[] = [];
  for (const m of parsed.matches) {
    const vendorDoc = vendorMap.get(m.artistSlug);
    if (!vendorDoc) continue;
    results.push({
      vendor: serializeClientVendor(vendorDoc),
      matchedTags,
      confidenceScore: Math.min(1, Math.max(0, Number(m.confidenceScore))),
      matchRationale: m.rationale,
    });
  }

  if (results.length === 0) {
    throw new Error('We could not re-match this saved look. Please try again.');
  }

  return results;
}

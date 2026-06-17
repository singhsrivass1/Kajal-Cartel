import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbConnect } from '@/lib/db/connect';
import Vendor from '@/lib/db/models/Vendor';
import type {
  ClientVendor,
  MatchResult,
  ImageProfile,
  StyleDNAEntry,
  MatchResponse,
} from '@/types/match';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
] as const;

const MASTER_PROMPT = `You are the elite Artistic Director for Kajal Cartel, Delhi's most exclusive bridal beauty platform. Your task is to analyze an uploaded image like a Vogue Beauty Editor.

STEP 1: THE RELEVANCE GATEKEEPER
First, determine if the image is relevant. It must contain a face, makeup, jewelry, bridal wear, or clear aesthetic fashion elements. 
If the image is completely irrelevant (e.g., a car, an animal, a blank screen, food), you MUST abort analysis and return this exact JSON structure:
{
  "isBridalContext": false,
  "styleDNA": [],
  "editorialAnalysis": "This does not appear to be a bridal or beauty reference. Please upload a clear mood board, portrait, or makeup reference.",
  "matches": []
}

STEP 2: THE EDITORIAL ANALYSIS
If the image IS relevant ("isBridalContext": true), examine three dimensions precisely:
1. SKIN ARCHITECTURE — texture philosophy, coverage density, finish quality (dewy/matte/satin/glass), preparation approach, luminosity.
2. EYE CONSTRUCTION — liner weight and technique, shadow layering, kohl usage style, drama level, cut crease vs waterline emphasis.
3. COLOR THEORY — palette temperature (warm/cool/neutral), saturation register, cultural aesthetic reference, harmony system.

STEP 3: THE MATCHING PROTOCOL
Match the image's aesthetic to EXACTLY THREE artists from our official roster below. You MUST ONLY use the exact slugs provided here:
1. slug: "studio-noor" — Botanical multi-session skin prep, no-makeup satin finish, mogra hairline. Quiet luxury. Sabyasachi minimalist.
2. slug: "meher-atelier" — Mughlai kohl to orbital bone, gold passa structure, mogra braid, luminous matte airbrush. Heritage sovereign.
3. slug: "studio-aara" — Korean twelve-step glass skin protocol, zero-powder dewy base, photography-optimised. Contemporary editorial.
4. slug: "priya-bhandari-artistry" — Cinematic dual-tone cut crease, plum-to-nude lip gradient, champagne brow bone highlight. Bollywood editorial.
5. slug: "the-riya-edit" — Old-money restraint, single precise liner stroke, structured silk-press blowout. South Delhi couture.
6. slug: "kamakshi-and-co" — Punjabi grandeur, dual-layer airbrush, vivid cut crease, gajra crown, maximum outdoor durability.
7. slug: "safiya-studio" — Angular single-stroke graphic liner, glass skin base, architectural updo. Fashion-forward editorial.
8. slug: "the-malviya-bride" — Triple-coat kohl, ceremonial sindoor placement, mogra braid, gold passa. Ancestral Old Delhi traditional.

STEP 4: OUTPUT CONSTRAINTS
Output ONLY a raw, minified JSON object. Do NOT wrap the JSON in markdown code blocks (e.g., \`\`\`json). Do not include any conversational text.

{
  "isBridalContext": true,
  "styleDNA": [
    { "label": "String (Limit strictly to: Quiet Luxury, Heritage Indian, Natural Glow, Fashion Forward, Celebratory Glam, Moody Romance, Modern Classic, Soft Romance, Bollywood Glam, Old Delhi Heritage)", "score": Number (0-100, ensure realistic variation) }
  ],
  "editorialAnalysis": "String (Exactly 2 sentences. Sentence 1: Precise beauty-editorial breakdown of the skin and eye architecture. Sentence 2: The cultural and stylistic register this image belongs to.)",
  "matches": [
    {
      "artistSlug": "String (Must exactly match a slug from the roster)",
      "confidenceScore": Number (0.00 to 1.00, two decimal places, highest score first),
      "rationale": "String (One precise sentence explaining exactly how a specific detail in the user's photo aligns with this artist's signature technique.)"
    }
  ]
}`;

async function generateWithFallbacks(
  imageBase64: string,
  mimeType: string,
  apiKey: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);

  const imagePart = {
    inlineData: { data: imageBase64, mimeType },
  };

  let lastError: unknown;

  for (const modelId of FALLBACK_MODELS) {
    try {
      console.info(`[/api/match] Attempting model: ${modelId}`);
      const model = genAI.getGenerativeModel({ model: modelId });
      const result = await model.generateContent([imagePart, { text: MASTER_PROMPT }]);
      const text = result.response.text();
      if (!text || !text.trim()) throw new Error(`Empty response from ${modelId}`);
      console.info(`[/api/match] Success with model: ${modelId}`);
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[/api/match] ${modelId} failed — ${msg}. Trying next fallback.`);
      lastError = err;
    }
  }

  throw lastError ?? new Error('All models in the fallback cascade failed.');
}

function parseAIResponse(raw: string): {
  isBridalContext: boolean;
  styleDNA: StyleDNAEntry[];
  editorialAnalysis: string;
  matches: Array<{ artistSlug: string; confidenceScore: number; rationale: string }>;
} {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  if (typeof parsed.isBridalContext !== 'boolean') parsed.isBridalContext = true;
  if (!Array.isArray(parsed.styleDNA)) parsed.styleDNA = [];
  if (typeof parsed.editorialAnalysis !== 'string') parsed.editorialAnalysis = '';
  if (!Array.isArray(parsed.matches)) parsed.matches = [];

  return parsed;
}

function serializeVendor(v: Record<string, any>): ClientVendor {
  return {
    _id: v._id.toString(),
    name: v.name,
    slug: v.slug,
    tagline: v.tagline,
    profileImageUrl: v.profileImageUrl,
    location: {
      microLocation: v.location?.microLocation ?? '',
      city: v.location?.city ?? 'New Delhi',
      travelPolicy: v.location?.travelPolicy ?? 'all',
    },
    pricing: {
      tier: v.pricing?.tier ?? 'premium',
      startingFromINR: v.pricing?.startingFromINR ?? 0,
    },
    ratings: {
      averageRating: v.ratings?.averageRating ?? 0,
      totalReviews: v.ratings?.totalReviews ?? 0,
    },
    flags: {
      badgeType: v.flags?.badgeType ?? null,
      isVerified: v.flags?.isVerified ?? false,
      isFeatured: v.flags?.isFeatured ?? false,
    },
    aestheticProfile: {
      styleArchetypes: v.aestheticProfile?.styleArchetypes ?? [],
      signatureElements: v.aestheticProfile?.signatureElements,
    },
    serviceSummary: {
      serviceCount: v.serviceSummary?.serviceCount ?? 0,
      anchorServiceCount: v.serviceSummary?.anchorServiceCount ?? 0,
      priceRangeINR: v.serviceSummary?.priceRangeINR ?? { min: 0, max: 0 },
      occasionCoverage: v.serviceSummary?.occasionCoverage ?? [],
      hasTrialOffering: v.serviceSummary?.hasTrialOffering ?? false,
    },
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured on this server.' },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  const raw = body as Record<string, unknown>;

  if (!raw.imageBase64 || typeof raw.imageBase64 !== 'string' || raw.imageBase64.length === 0) {
    return NextResponse.json(
      { error: 'imageBase64 is required and must be a non-empty string.' },
      { status: 400 }
    );
  }

  if (!raw.mimeType || typeof raw.mimeType !== 'string') {
    return NextResponse.json({ error: 'mimeType is required.' }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.includes(raw.mimeType as string)) {
    return NextResponse.json(
      { error: `Unsupported file type. Accepted: ${ALLOWED_MIME_TYPES.join(', ')}.` },
      { status: 400 }
    );
  }

  const estimatedBytes = Math.ceil((raw.imageBase64 as string).length * 0.75);
  if (estimatedBytes > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'Image must be under 10MB.' }, { status: 400 });
  }

  let rawAI: string;
  try {
    rawAI = await generateWithFallbacks(
      raw.imageBase64 as string,
      raw.mimeType as string,
      apiKey
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/match] All fallback models failed:', msg);
    return NextResponse.json(
      {
        error:
          'The Kajal Cartel AI is currently styling an unprecedented number of brides. Please try your upload again in a few moments.',
      },
      { status: 500 }
    );
  }

  let parsed: ReturnType<typeof parseAIResponse>;
  try {
    parsed = parseAIResponse(rawAI);
  } catch (err) {
    console.error('[/api/match] Failed to parse AI response:', rawAI, err);
    return NextResponse.json(
      {
        error:
          'The Kajal Cartel AI is currently styling an unprecedented number of brides. Please try your upload again in a few moments.',
      },
      { status: 500 }
    );
  }

  if (parsed.isBridalContext === false) {
    return NextResponse.json(
      {
        error:
          'Please upload a bridal makeup or beauty reference photo, a celebrity look, a magazine editorial, or a Pinterest save. This image does not contain enough style signals for a match.',
      },
      { status: 422 }
    );
  }

  try {
    await dbConnect();
  } catch (err) {
    console.error('[/api/match] DB connection failed:', err);
    return NextResponse.json(
      { error: 'Database connection failed. Please try again.' },
      { status: 500 }
    );
  }

  const validSlugs = parsed.matches
    .map((m) => m.artistSlug)
    .filter((s) => typeof s === 'string' && s.length > 0);

  if (validSlugs.length === 0) {
    return NextResponse.json(
      { error: 'No valid artist matches were returned by the AI. Please try a different image.' },
      { status: 422 }
    );
  }

  const vendorDocs = await Vendor.find({
    slug: { $in: validSlugs },
    'flags.isActive': true,
  }).lean<Record<string, any>[]>();

  const vendorMap = new Map(vendorDocs.map((v) => [v.slug, v]));

  const matches: MatchResult[] = [];
  for (const aiMatch of parsed.matches) {
    const vendorDoc = vendorMap.get(aiMatch.artistSlug);
    if (!vendorDoc) {
      console.warn(`[/api/match] AI returned unknown or inactive slug: "${aiMatch.artistSlug}"`);
      continue;
    }
    matches.push({
      vendor: serializeVendor(vendorDoc),
      matchedTags: parsed.styleDNA.map((d) => d.label),
      confidenceScore: Math.min(1, Math.max(0, Number(aiMatch.confidenceScore))),
      matchRationale: aiMatch.rationale,
    });
  }

  if (matches.length === 0) {
    return NextResponse.json(
      {
        error:
          'We could not find matching artists for this image. Please try uploading a bridal makeup or beauty reference photo.',
      },
      { status: 422 }
    );
  }

  const styleDNA: StyleDNAEntry[] = parsed.styleDNA.map((d) => ({
    label: String(d.label),
    score: Math.min(100, Math.max(0, Number(d.score))),
  }));

  const imageProfile: ImageProfile = {
    styleArchetypes: styleDNA.map((d) => d.label),
    makeupFinishTags: [],
    colorPaletteAffinity: [],
    occasionSignals: [],
    skinToneSignals: [],
    visualNarrative: parsed.editorialAnalysis,
  };

  const response: MatchResponse = {
    matches,
    imageProfile,
    styleDNA,
    editorialAnalysis: parsed.editorialAnalysis,
  };

  return NextResponse.json(response, { status: 200 });
}
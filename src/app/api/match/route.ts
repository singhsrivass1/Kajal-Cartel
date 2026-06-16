import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbConnect } from '@/lib/db/connect';
import Vendor from '@/lib/db/models/Vendor';
import {
  STYLE_ARCHETYPES,
  MAKEUP_FINISH_TAGS,
  COLOR_PALETTE_TAGS,
  OCCASION_TAGS,
  SKIN_TONE_TAGS,
} from '@/lib/db/enums/taxonomy';
 
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
 
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const CANDIDATE_POOL_SIZE = 6;
const TOP_MATCH_COUNT = 3;
 
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
 
const IMAGE_ANALYSIS_SYSTEM_INSTRUCTION = `
You are the Visual Aesthetic Analyst for Kajal Cartel, Delhi's premier bridal beauty marketplace. Your role is to analyse mood board images uploaded by brides and extract precise aesthetic signals that map to our platform's controlled taxonomy.
 
Examine the uploaded image for visual signals across five categories. Return ONLY values from the approved taxonomy lists. If a category has no clear visual signal, return an empty array for that category. Do not approximate or invent values. If a tag is not visually confirmed, exclude it.
 
APPROVED TAXONOMY:
 
styleArchetypes — the dominant aesthetic school of the mood board. Select a maximum of 3:
${[...STYLE_ARCHETYPES].join(' | ')}
 
makeupFinishTags — the skin or makeup finish visible or strongly implied by the imagery. Select a maximum of 4:
${[...MAKEUP_FINISH_TAGS].join(' | ')}
 
colorPaletteAffinity — the dominant colour vocabulary across the image. Select a maximum of 4:
${[...COLOR_PALETTE_TAGS].join(' | ')}
 
occasionSignals — the ceremony or event type this mood board is coded for. Select a maximum of 3:
${[...OCCASION_TAGS].join(' | ')}
 
skinToneSignals — the skin tone emphasis if identifiable in the image. Select a maximum of 2:
${[...SKIN_TONE_TAGS].join(' | ')}
 
For the visualNarrative field: write 2–3 sentences describing the mood board's overall aesthetic intent as a Vogue art director would brief a makeup artist. Be specific about texture, colour register, draping weight, and emotional tone. This narrative will be used to generate AI match rationales for real artists.
`.trim();
 
const VENDOR_RANKING_SYSTEM_INSTRUCTION = `
You are the Aesthetic Matcher for Kajal Cartel, Delhi's elite bridal beauty marketplace. You will receive a client's mood board aesthetic profile and a shortlist of bridal artists. Your task is to rank the artists by how precisely their artistic vocabulary and documented signature techniques align with the client's visual intent.
 
CONFIDENCE SCORE GUIDE — be rigorous, not generous:
0.90–1.0: The artist's entire body of work could have been sourced directly from this mood board. Complete aesthetic alignment across all primary signals.
0.70–0.89: Strong alignment across primary aesthetic signals, minor divergence in secondary elements.
0.50–0.69: Meaningful overlap in some dimensions with notable gaps in others.
Below 0.50: Fundamental aesthetic misalignment. Do not manufacture a match that does not exist.
 
MATCHED TAGS: Return only the specific taxonomy tags from the mood board profile that this artist demonstrably and specifically specialises in. Do not pad this list.
 
MATCH RATIONALE: Write in luxury editorial tone — specific, visual, and authoritative. Each rationale must reference a concrete visual element observed in the mood board, connect it to a documented technique or signature from the artist's profile, and be a maximum of 3 sentences. No filler. No generic praise. Treat each rationale as a sentence that would appear in a Vogue India feature.
 
NEGATIVE SIGNALS: If an artist's contraIndicators conflict with signals present in the mood board, reduce the confidenceScore proportionally. Reference the conflict with honesty.
 
Return all artists in the rankings array, ordered by descending confidenceScore.
`.trim();
 
const IMAGE_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    styleArchetypes: {
      type: 'array',
      items: { type: 'string' },
    },
    makeupFinishTags: {
      type: 'array',
      items: { type: 'string' },
    },
    colorPaletteAffinity: {
      type: 'array',
      items: { type: 'string' },
    },
    occasionSignals: {
      type: 'array',
      items: { type: 'string' },
    },
    skinToneSignals: {
      type: 'array',
      items: { type: 'string' },
    },
    visualNarrative: {
      type: 'string',
    },
  },
  required: [
    'styleArchetypes',
    'makeupFinishTags',
    'colorPaletteAffinity',
    'occasionSignals',
    'skinToneSignals',
    'visualNarrative',
  ],
};
 
const VENDOR_RANKING_SCHEMA = {
  type: 'object',
  properties: {
    rankings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          vendorSlug: {
            type: 'string',
          },
          matchedTags: {
            type: 'array',
            items: { type: 'string' },
          },
          confidenceScore: {
            type: 'number',
          },
          matchRationale: {
            type: 'string',
          },
        },
        required: ['vendorSlug', 'matchedTags', 'confidenceScore', 'matchRationale'],
      },
    },
  },
  required: ['rankings'],
};
 
interface ImageProfile {
  styleArchetypes: string[];
  makeupFinishTags: string[];
  colorPaletteAffinity: string[];
  occasionSignals: string[];
  skinToneSignals: string[];
  visualNarrative: string;
}
 
interface VendorRankingEntry {
  vendorSlug: string;
  matchedTags: string[];
  confidenceScore: number;
  matchRationale: string;
}
 
interface VendorRankingResponse {
  rankings: VendorRankingEntry[];
}
 
interface GeminiVendorProfile {
  slug: string;
  name: string;
  aestheticBio: string;
  styleArchetypes: string[];
  colorPaletteAffinity: string[];
  makeupFinishTags: string[];
  signatureElements: string | undefined;
  moodKeywords: string[];
  contraIndicators: string[];
  heroPortraitCaption: string;
}
 
interface ClientVendor {
  _id: string;
  name: string;
  slug: string;
  tagline: string;
  profileImageUrl: string;
  location: {
    microLocation: string;
    city: string;
    travelPolicy: string;
  };
  pricing: {
    tier: string;
    startingFromINR: number;
  };
  ratings: {
    averageRating: number;
    totalReviews: number;
  };
  flags: {
    badgeType: string | null;
    isVerified: boolean;
    isFeatured: boolean;
  };
  aestheticProfile: {
    styleArchetypes: string[];
    signatureElements: string | undefined;
  };
  serviceSummary: {
    serviceCount: number;
    anchorServiceCount: number;
    priceRangeINR: { min: number; max: number };
    occasionCoverage: string[];
    hasTrialOffering: boolean;
  };
}
 
interface MatchResult {
  vendor: ClientVendor;
  matchedTags: string[];
  confidenceScore: number;
  matchRationale: string;
}
 
function getImageAnalysisModel() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: IMAGE_ANALYSIS_SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: IMAGE_ANALYSIS_SCHEMA as any,
    },
  });
}
 
function getVendorRankingModel() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: VENDOR_RANKING_SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: VENDOR_RANKING_SCHEMA as any,
    },
  });
}
 
async function analyzeImage(base64: string, mimeType: string): Promise<ImageProfile> {
  const model = getImageAnalysisModel();
 
  const result = await model.generateContent([
    {
      inlineData: { data: base64, mimeType },
    },
    {
      text: 'Analyse this bridal mood board image and extract the aesthetic signals according to your taxonomy instructions.',
    },
  ]);
 
  const rawJson = result.response.text();
  return JSON.parse(rawJson) as ImageProfile;
}
 
function buildCandidateQuery(profile: ImageProfile): Record<string, unknown> {
  const orConditions: Record<string, unknown>[] = [];
 
  if (profile.styleArchetypes.length) {
    orConditions.push({
      'aestheticProfile.styleArchetypes': { $in: profile.styleArchetypes },
    });
  }
  if (profile.colorPaletteAffinity.length) {
    orConditions.push({
      'aestheticProfile.colorPaletteAffinity': { $in: profile.colorPaletteAffinity },
    });
  }
  if (profile.makeupFinishTags.length) {
    orConditions.push({
      'aestheticProfile.makeupFinishTags': { $in: profile.makeupFinishTags },
    });
  }
  if (profile.occasionSignals.length) {
    orConditions.push({
      'aestheticProfile.occasionSpecializations': { $in: profile.occasionSignals },
    });
  }
 
  return {
    'flags.isActive': true,
    ...(orConditions.length > 0 ? { $or: orConditions } : {}),
  };
}
 
function computePreScore(vendor: Record<string, any>, profile: ImageProfile): number {
  const ap = vendor.aestheticProfile;
  let score = 0;
 
  const styleOverlap = (ap.styleArchetypes as string[]).filter((t) =>
    profile.styleArchetypes.includes(t)
  ).length;
  score += styleOverlap * 3;
 
  const paletteOverlap = (ap.colorPaletteAffinity as string[]).filter((t) =>
    profile.colorPaletteAffinity.includes(t)
  ).length;
  score += paletteOverlap * 2;
 
  const makeupOverlap = (ap.makeupFinishTags as string[]).filter((t) =>
    profile.makeupFinishTags.includes(t)
  ).length;
  score += makeupOverlap * 1.5;
 
  const occasionOverlap = (ap.occasionSpecializations as string[]).filter((t) =>
    profile.occasionSignals.includes(t)
  ).length;
  score += occasionOverlap * 1;
 
  const skinOverlap = (ap.skinToneExpertise as string[]).filter((t) =>
    profile.skinToneSignals.includes(t)
  ).length;
  score += skinOverlap * 0.5;
 
  const contraConflicts = ((ap.contraIndicators ?? []) as string[]).filter((ci) => {
    if (ci === 'no-airbrush' && profile.makeupFinishTags.includes('airbrush-finish')) return true;
    if (ci === 'no-heavy-contouring' && profile.styleArchetypes.includes('manish-malhotra-shimmer')) return true;
    return false;
  }).length;
  score -= contraConflicts * 1.5;
 
  return score;
}
 
function buildGeminiVendorProfile(vendor: Record<string, any>): GeminiVendorProfile {
  const portfolio = (vendor.portfolio ?? []) as Array<Record<string, any>>;
  const heroCaption =
    portfolio.find((p) => p.isHeroImage)?.captionForAI ??
    portfolio[0]?.captionForAI ??
    '';
 
  return {
    slug: vendor.slug,
    name: vendor.name,
    aestheticBio: vendor.aestheticProfile.aestheticBio,
    styleArchetypes: vendor.aestheticProfile.styleArchetypes,
    colorPaletteAffinity: vendor.aestheticProfile.colorPaletteAffinity,
    makeupFinishTags: vendor.aestheticProfile.makeupFinishTags,
    signatureElements: vendor.aestheticProfile.signatureElements,
    moodKeywords: vendor.aestheticProfile.moodKeywords ?? [],
    contraIndicators: vendor.aestheticProfile.contraIndicators ?? [],
    heroPortraitCaption: heroCaption,
  };
}
 
async function rankCandidates(
  profile: ImageProfile,
  candidates: Record<string, any>[]
): Promise<VendorRankingEntry[]> {
  const model = getVendorRankingModel();
 
  const vendorProfiles = candidates.map(buildGeminiVendorProfile);
 
  const rankingPrompt = `
MOOD BOARD AESTHETIC PROFILE:
Visual Narrative: ${profile.visualNarrative}
Detected Style Archetypes: ${profile.styleArchetypes.join(', ') || 'None identified'}
Detected Colour Palette: ${profile.colorPaletteAffinity.join(', ') || 'None identified'}
Detected Makeup Finish: ${profile.makeupFinishTags.join(', ') || 'None identified'}
Detected Occasion Signals: ${profile.occasionSignals.join(', ') || 'None identified'}
Detected Skin Tone Signals: ${profile.skinToneSignals.join(', ') || 'None identified'}
 
SHORTLISTED ARTISTS FOR RANKING (${vendorProfiles.length} total):
${JSON.stringify(vendorProfiles, null, 2)}
 
Rank all ${vendorProfiles.length} artists. Use each artist's exact slug value as the vendorSlug identifier. Return in descending order of confidenceScore.
  `.trim();
 
  const result = await model.generateContent(rankingPrompt);
  const rawJson = result.response.text();
  const parsed = JSON.parse(rawJson) as VendorRankingResponse;
  return parsed.rankings;
}
 
function toClientVendor(vendor: Record<string, any>): ClientVendor {
  return {
    _id: vendor._id.toString(),
    name: vendor.name,
    slug: vendor.slug,
    tagline: vendor.tagline,
    profileImageUrl: vendor.profileImageUrl,
    location: {
      microLocation: vendor.location.microLocation,
      city: vendor.location.city,
      travelPolicy: vendor.location.travelPolicy,
    },
    pricing: {
      tier: vendor.pricing.tier,
      startingFromINR: vendor.pricing.startingFromINR,
    },
    ratings: {
      averageRating: vendor.ratings.averageRating,
      totalReviews: vendor.ratings.totalReviews,
    },
    flags: {
      badgeType: vendor.flags.badgeType ?? null,
      isVerified: vendor.flags.isVerified,
      isFeatured: vendor.flags.isFeatured,
    },
    aestheticProfile: {
      styleArchetypes: vendor.aestheticProfile.styleArchetypes,
      signatureElements: vendor.aestheticProfile.signatureElements,
    },
    serviceSummary: {
      serviceCount: vendor.serviceSummary.serviceCount,
      anchorServiceCount: vendor.serviceSummary.anchorServiceCount,
      priceRangeINR: vendor.serviceSummary.priceRangeINR,
      occasionCoverage: vendor.serviceSummary.occasionCoverage,
      hasTrialOffering: vendor.serviceSummary.hasTrialOffering,
    },
  };
}
 
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.GEMINI_API_KEY) {
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
    return NextResponse.json(
      { error: 'mimeType is required.' },
      { status: 400 }
    );
  }
 
  if (!ALLOWED_MIME_TYPES.includes(raw.mimeType as string)) {
    return NextResponse.json(
      {
        error: `Unsupported file type "${raw.mimeType}". Accepted types: ${ALLOWED_MIME_TYPES.join(', ')}.`,
      },
      { status: 400 }
    );
  }
 
  const estimatedBytes = Math.ceil((raw.imageBase64 as string).length * 0.75);
  if (estimatedBytes > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'Image must be under 10MB.' },
      { status: 400 }
    );
  }
 
  const imageBase64 = raw.imageBase64 as string;
  const imageMimeType = raw.mimeType as string;
 
  try {
    const imageProfile = await analyzeImage(imageBase64, imageMimeType);
 
    await dbConnect();
 
    const candidateQuery = buildCandidateQuery(imageProfile);
    const rawCandidates = await Vendor.find(candidateQuery)
      .lean<Record<string, any>[]>()
      .limit(CANDIDATE_POOL_SIZE * 2);
 
    if (!rawCandidates.length) {
      return NextResponse.json(
        {
          matches: [],
          imageProfile,
          message:
            'No artists in the Cartel matched the visual profile of this mood board. Try a different image.',
        },
        { status: 200 }
      );
    }
 
    const preScoredCandidates = rawCandidates
      .map((vendor) => ({ vendor, preScore: computePreScore(vendor, imageProfile) }))
      .sort((a, b) => b.preScore - a.preScore)
      .slice(0, CANDIDATE_POOL_SIZE);
 
    const rankings = await rankCandidates(
      imageProfile,
      preScoredCandidates.map((c) => c.vendor)
    );
 
    const vendorBySlug = new Map(
      preScoredCandidates.map((c) => [c.vendor.slug as string, c.vendor])
    );
 
    const matches: MatchResult[] = rankings
      .filter((r) => vendorBySlug.has(r.vendorSlug))
      .slice(0, TOP_MATCH_COUNT)
      .map((ranking) => ({
        vendor: toClientVendor(vendorBySlug.get(ranking.vendorSlug)!),
        matchedTags: ranking.matchedTags,
        confidenceScore: Math.min(1.0, Math.max(0.0, ranking.confidenceScore)),
        matchRationale: ranking.matchRationale,
      }));
 
    return NextResponse.json({ matches, imageProfile }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

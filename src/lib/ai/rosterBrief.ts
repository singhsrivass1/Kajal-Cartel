import Vendor from '@/lib/db/models/Vendor';

/**
 * Formats already-fetched active vendors into the numbered roster block the
 * matching prompts embed. Kept separate from the fetch so callers that also
 * need the full vendor docs afterward (to hydrate Gemini's chosen slugs) can
 * reuse one query instead of two.
 */
export function formatRosterBrief(vendors: Array<Record<string, any>>): string {
  return vendors
    .map((v, i) => {
      const description =
        v.aestheticProfile?.signatureElements?.trim() ||
        v.aestheticProfile?.aestheticBio?.trim() ||
        v.tagline;
      return `${i + 1}. slug: "${v.slug}" — ${description}`;
    })
    .join('\n');
}

export async function fetchActiveRosterVendors(): Promise<Array<Record<string, any>>> {
  // Every active vendor is loaded on every match and rematch call, so exclude
  // `portfolio` — it is used by neither the prompt nor serializeClientVendor.
  return Vendor.find({ 'flags.isActive': true })
    .select('-portfolio')
    .sort({ name: 1 })
    .lean<Array<Record<string, any>>>();
}

/** Convenience wrapper for callers that don't need the vendor docs themselves afterward. */
export async function buildRosterBrief(): Promise<string> {
  const vendors = await fetchActiveRosterVendors();
  return formatRosterBrief(vendors);
}

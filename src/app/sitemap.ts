import type { MetadataRoute } from 'next';
import { dbConnect } from '@/lib/db/connect';
import { listPublicServices } from '@/lib/db/controllers/DiscoveryManager';
import Vendor from '@/lib/db/models/Vendor';
import { getSiteUrl } from '@/lib/site/config';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const abs = (path: string) => (siteUrl ? new URL(path, siteUrl).toString() : path);
  const entries: MetadataRoute.Sitemap = ['/', '/discover', '/services', '/policies', '/help'].map((path) => ({ url: abs(path) }));

  try {
    await dbConnect();
    const [vendors, services] = await Promise.all([
      Vendor.find({ 'flags.isActive': true }).select('slug updatedAt').lean<Array<{ slug: string; updatedAt?: Date }>>(),
      listPublicServices(),
    ]);
    for (const v of vendors) entries.push({ url: abs(`/artists/${v.slug}`), lastModified: v.updatedAt });
    for (const s of services) entries.push({ url: abs(`/artists/${s.vendor.slug}/services/${s.slug}`) });
  } catch (err) {
    console.error('[sitemap] Failed to load dynamic entries:', err instanceof Error ? err.name : 'unknown');
  }
  return entries;
}

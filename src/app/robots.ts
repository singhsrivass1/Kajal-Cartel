import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site/config';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/artist', '/journey', '/account', '/moodboards', '/api/', '/auth', '/unauthorized'],
    },
    ...(siteUrl ? { sitemap: new URL('/sitemap.xml', siteUrl).toString() } : {}),
  };
}

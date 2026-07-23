import type { MetadataRoute } from 'next';

/// Same fallback `app/layout.tsx` uses for social cards, so a build that forgets
/// NEXT_PUBLIC_SITE_URL still points crawlers at the deployed site, not a local machine.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://qeltrun.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // No user data is ever queried through it, but it is a route with no content for a
      // crawler to index.
      disallow: '/api/',
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

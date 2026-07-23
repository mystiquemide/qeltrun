import type { MetadataRoute } from 'next';

import { DOCS_TREE } from '@/components/docs/docs-nav';

/// Same fallback `app/layout.tsx` uses for social cards.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://qeltrun.vercel.app';

/// Static marketing and product routes. `/app` is included even though it is a live console
/// rather than prose, because it is the product's main entry point and has its own canonical URL.
/// `/api/local-gateway` is excluded: it is a route handler with no page to index, and `robots.ts`
/// disallows the whole `/api/` prefix anyway.
const STATIC_ROUTES = ['/', '/app', '/proof', '/docs', '/privacy', '/terms'];

export default function sitemap(): MetadataRoute.Sitemap {
  const docsRoutes = DOCS_TREE.flatMap((group) => group.links.map((link) => link.href));
  const routes = [...new Set([...STATIC_ROUTES, ...docsRoutes])];

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));
}

import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Inter } from 'next/font/google';

import './globals.css';
import { Providers } from './providers';

/// Self-hosted at build time by `next/font`, so there is no render-blocking request to Google and
/// no layout shift on load. Display headlines run at -1.9% tracking, which needs the real Inter
/// rather than a system fallback.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
});

const TITLE = 'Qeltrun: Before funds move, prove the change';
const DESCRIPTION =
  'A fail-closed payout firewall. A vendor payment destination changes only when an iExec Nox TEE-sealed approval, bound to the approver’s wallet and to the contract, proves it should.';

/// The origin social cards resolve their absolute image URLs against. It falls back to the
/// production domain rather than localhost, because a card shared from a build that forgot to set
/// NEXT_PUBLIC_SITE_URL should still point at the deployed site, not a machine nobody else can
/// reach. Set NEXT_PUBLIC_SITE_URL per deployment to override.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://qeltrun.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'Qeltrun',
  keywords: ['iExec', 'Nox', 'TEE', 'confidential computing', 'treasury', 'payout firewall'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Qeltrun',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/opengraph-image'],
  },
  icons: { icon: '/icon', shortcut: '/icon', apple: '/icon' },
};

/// The landing page is the first thing anyone loads, and it is light. The console sets its own
/// dark surface through `.surface-console`.
export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable}`}>
      <body>
        {/* First tab stop on every page. Hidden until focused, then jumps a keyboard or screen
            reader user past the nav to the page body. Every page renders its content inside a
            <main id="main-content">. */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

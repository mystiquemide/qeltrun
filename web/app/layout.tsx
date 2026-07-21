import type { Metadata, Viewport } from 'next';

import './globals.css';
import { Providers } from './providers';

const TITLE = 'Qeltrun — Before funds move, prove the change';
const DESCRIPTION =
  'A fail-closed payout firewall. A vendor payment destination changes only when an iExec Nox TEE-sealed approval, bound to the approver’s wallet and to the contract, proves it should.';

/// Set NEXT_PUBLIC_SITE_URL once the app is deployed so social cards resolve absolute image
/// URLs. Falls back to localhost, which is correct for the local demo and harmless otherwise.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

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

export const viewport: Viewport = {
  themeColor: '#080a0d',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

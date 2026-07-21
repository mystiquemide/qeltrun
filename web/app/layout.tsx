import type { Metadata } from 'next';

import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Qeltrun — Before funds move, prove the change',
  description:
    'A fail-closed payout firewall. A vendor payment destination changes only when an iExec Nox TEE-sealed approval proves it should.',
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

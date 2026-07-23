import type { Metadata } from 'next';
import Link from 'next/link';

import { Confidentiality } from '@/components/marketing/confidentiality';
import { Deployment } from '@/components/marketing/deployment';
import { Footer, FooterCta } from '@/components/marketing/footer';
import { Governance } from '@/components/marketing/governance';
import { Nav } from '@/components/marketing/nav';
import { ProofSummary } from '@/components/marketing/proof-summary';
import { Receipts } from '@/components/marketing/receipts';
import { Rail } from '@/components/marketing/rail';

export const metadata: Metadata = {
  title: 'Proof: Qeltrun',
  description:
    'Every claim Qeltrun makes, with the contract addresses, Nox handles, governance receipts '
    + 'and the eighteen transactions behind them, all on Ethereum Sepolia.',
  alternates: { canonical: '/proof' },
};

/**
 * The evidence, kept off the landing page.
 *
 * A treasury operator does not audit block numbers, so this material was crowding out the
 * questions an actual visitor arrives with. It is far too valuable to delete, so it lives here
 * instead, one click from the landing page and one click from the README.
 *
 * The sections are the same components the landing page used to render, unchanged.
 */
export default function Page() {
  return (
    <>
      <Nav />
      <main id="main-content">
        <Rail>
          <div className="px-6 pt-16 pb-4 md:px-12 md:pt-20">
            <Link
              href="/"
              className="text-[13px] text-[var(--color-ink-600)] transition-colors hover:text-[var(--color-ink-900)]"
            >
              Back to Qeltrun
            </Link>
            <h1 className="h-section mt-6 max-w-[22ch] text-[var(--color-ink-900)]">
              Everything on this page can be checked.
            </h1>
            <p className="mt-4 max-w-[64ch] text-[16px] leading-[1.6] text-[var(--color-ink-600)]">
              The contracts, the sealed Nox handles, the approver governance and the full run that
              moved a vendor payout destination. All of it is on Ethereum Sepolia, and every row
              links to the transaction that produced it.
            </p>
          </div>
        </Rail>

        <ProofSummary />
        <Deployment />
        <Confidentiality />
        <Governance />
        <Receipts />
      </main>
      <FooterCta />
      <Footer />
    </>
  );
}

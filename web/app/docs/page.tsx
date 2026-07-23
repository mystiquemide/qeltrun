import type { Metadata } from 'next';
import Link from 'next/link';

import { Callout, DocHeader, P } from '@/components/docs/prose';

export const metadata: Metadata = {
  title: 'Docs: Qeltrun',
  description:
    'Qeltrun documentation: quickstart, deployment guides, the firewall contract reference, the '
    + 'CLI, configuration, and how the confidential approval works.',
  alternates: { canonical: '/docs' },
};

export default function Page() {
  return (
    <article>
      <DocHeader
        kind="Overview"
        title="Qeltrun documentation"
        intro="Qeltrun is a payout firewall. It blocks a vendor payment until three reviewers seal a private approval inside an iExec Nox enclave and the sealed verdict says yes."
      />

      <P>
        These docs cover how to run Qeltrun, how to deploy it, the exact contract and CLI surfaces,
        and how the confidential approval works. Every command and function here matches the source
        in the repository.
      </P>

      <Callout tone="warning" title="Test network">
        The live deployment runs on Ethereum Sepolia, a test network. The contracts are not
        audited. Read the <Link href="/terms" className="text-[var(--color-accent)] underline underline-offset-2">terms</Link> before you reuse this code.
      </Callout>

      <P>Start with the sidebar: Quickstart to run it, Guides to deploy or drive the reviewer flow, Reference for the exact contract and CLI surfaces, Concepts for how the confidential approval works.</P>
    </article>
  );
}

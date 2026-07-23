import type { Metadata } from 'next';
import Link from 'next/link';

import { DOCS_TREE } from '@/components/docs/docs-nav';
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

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {DOCS_TREE.map((group) => (
          <div key={group.title} className="rounded-md border border-[var(--color-rule)] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
              {group.kind}
            </p>
            <p className="mt-1 text-[15px] font-semibold text-[var(--color-ink-900)]">
              {group.title}
            </p>
            <ul className="mt-3 space-y-1.5">
              {group.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[14px] text-[var(--color-ink-600)] transition-colors hover:text-[var(--color-ink-900)]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </article>
  );
}

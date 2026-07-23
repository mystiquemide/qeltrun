import { Rail, RailInner } from './rail';

/**
 * What the page proves, before the tables that prove it.
 *
 * The evidence below this card is dense: four contract addresses, eighteen transactions, two
 * governance failure cases. A non-technical reader skims all of it and leaves without the story.
 * This card states the outcome first, then the tables become the receipts for a claim the reader
 * already understands.
 *
 * Every figure here is backed by material further down the page. Four contracts is the deployment
 * section, eighteen transactions is the receipts run, the three-reviewer seal and the halted
 * refusal are both rows in that run. Nothing here is a number without a transaction behind it.
 */
const CLAIMS: { label: string; value: string }[] = [
  { label: 'Contracts live on Sepolia', value: '4' },
  { label: 'Transactions in the certified run', value: '18' },
  { label: 'Reviewer positions sealed in Nox', value: '3' },
  { label: 'Payout moved only after the sealed verdict', value: 'Yes' },
  { label: 'Payout refused while the firewall was halted', value: 'Yes' },
  { label: 'Recovery is delayed seven days and vetoable', value: 'Yes' },
];

export function ProofSummary() {
  return (
    <Rail>
      <RailInner className="py-12 md:py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-400)]">
          What this proves
        </p>
        <div className="mt-6 grid gap-px overflow-hidden rounded-md border border-[var(--color-rule)] bg-[var(--color-rule)] sm:grid-cols-2 lg:grid-cols-3">
          {CLAIMS.map((c) => (
            <div key={c.label} className="bg-[var(--color-canvas)] px-5 py-5">
              <p className="ledger text-[24px] font-semibold leading-none text-[var(--color-ink-900)]">
                {c.value}
              </p>
              <p className="mt-2 text-[13.5px] leading-snug text-[var(--color-ink-600)]">
                {c.label}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-[var(--color-ink-600)]">
          Each figure is a claim the sections below back with an on-chain transaction.
        </p>
      </RailInner>
    </Rail>
  );
}

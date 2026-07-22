import { RECEIPT_GROUPS, etherscanTx, shortAddress } from '@/lib/sepolia-facts';
import { Rail } from './rail';

/**
 * The whole certified run, eighteen transactions, every one verified on chain before shipping.
 *
 * One table with group subheadings, so the columns line up across all four phases and a reader
 * can scan block numbers and outcomes down a single axis.
 *
 * The paused rows need care. Both transactions have status `success` because the Safe confirmed,
 * while the inner payout reverted and the Safe emitted `ExecutionFailure`. Describing them as
 * failed transactions would be wrong; so would describing them as successful payouts. The outcome
 * column says exactly what the logs say.
 */
export function Receipts() {
  return (
    <Rail band id="receipts">
      <div className="px-6 py-16 md:px-12 md:py-24">
        <h2 className="h-section max-w-[22ch] text-[var(--color-ink-900)]">
          One destination change, end to end.
        </h2>
        <p className="mt-4 max-w-[66ch] text-[16px] leading-[1.6] text-[var(--color-ink-600)]">
          A vendor asked to be paid at a new address. Three reviewers weighed in without seeing
          each other, the treasury paid the destination once it cleared, and the same payment was
          refused the moment the firewall was halted. Every step is a transaction on Ethereum
          Sepolia you can open right now.
        </p>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr className="border-y border-[var(--color-rule)]">
                <Th className="w-[42%]">Step</Th>
                <Th className="w-[16%]">Block</Th>
                <Th className="w-[26%]">Outcome</Th>
                <Th className="w-[16%] text-right">Transaction</Th>
              </tr>
            </thead>

            {RECEIPT_GROUPS.map((g) => (
              <tbody key={g.title}>
                <tr>
                  <td colSpan={4} className="pt-9 pb-3">
                    <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-ink-900)]">
                      {g.title}
                    </p>
                    <p className="mt-1 max-w-[74ch] text-[13.5px] leading-[1.5] text-[var(--color-ink-600)]">
                      {g.note}
                    </p>
                  </td>
                </tr>

                {g.rows.map((r) => (
                  <tr key={r.hash} className="border-t border-[var(--color-rule)]">
                    <td className="py-3.5 pr-4 text-[14px] text-[var(--color-ink-900)]">{r.step}</td>
                    <td className="ledger py-3.5 pr-4 text-[12.5px] text-[var(--color-ink-400)]">
                      {r.block.toLocaleString('en-GB')}
                    </td>
                    <td className="py-3.5 pr-4 text-[13.5px] text-[var(--color-ink-600)]">
                      {r.outcome}
                    </td>
                    <td className="py-3.5 text-right">
                      <a
                        href={etherscanTx(r.hash)}
                        target="_blank"
                        rel="noreferrer"
                        title={r.hash}
                        className="ledger whitespace-nowrap text-[12px] text-[var(--color-accent)] underline decoration-transparent underline-offset-4 transition hover:decoration-current"
                      >
                        {shortAddress(r.hash, 6, 4)}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </Rail>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`py-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-400)] ${className}`}
    >
      {children}
    </th>
  );
}

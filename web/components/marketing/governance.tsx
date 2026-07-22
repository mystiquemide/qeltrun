'use client';

import { useEffect, useState } from 'react';

import {
  GOVERNANCE_TXS,
  RECOVERY_EXECUTE_AFTER,
  etherscanTx,
  shortAddress,
} from '@/lib/sepolia-facts';
import { Rail } from './rail';

/**
 * Approver rotation and recovery, with the receipts that prove the safety properties.
 *
 * The interesting transactions here are the failures. An early execution that reverted and a veto
 * that cancelled an accepted recovery say more about whether the delay is real than the happy
 * path does, so both are listed.
 */
export function Governance() {
  return (
    <Rail id="governance">
      <div className="px-6 py-16 md:px-12 md:py-24">
        <h2 className="h-section max-w-[22ch] text-[var(--color-ink-900)]">
          Losing a reviewer key should not lose the vendor.
        </h2>
        <p className="mt-4 max-w-[64ch] text-[16px] leading-[1.6] text-[var(--color-ink-600)]">
          Reviewers change and keys get lost, so there are two ways to replace an approver. Both
          are slow on purpose, because a fast path to replacing the approver would be the same
          hijack the firewall exists to stop.
        </p>

        <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className="text-[19px] font-semibold tracking-[-0.01em] text-[var(--color-ink-900)]">
              Two party rotation
            </h3>
            <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.6] text-[var(--color-ink-600)]">
              The owner proposes a candidate, the candidate accepts, and the sitting approver
              approves. A state read between the second and third steps confirmed that either
              action alone leaves the approver unchanged. This ran to completion on the live
              vendor, which is why its approver epoch is now 2.
            </p>
            <Receipts
              rows={[
                { label: 'Safe proposed', hash: GOVERNANCE_TXS.rotationProposed },
                { label: 'Candidate accepted', hash: GOVERNANCE_TXS.rotationCandidateAccepted },
                { label: 'Approver approved', hash: GOVERNANCE_TXS.rotationApproved },
              ]}
            />
          </div>

          <div>
            <h3 className="text-[19px] font-semibold tracking-[-0.01em] text-[var(--color-ink-900)]">
              Seven day recovery, vetoable
            </h3>
            <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.6] text-[var(--color-ink-600)]">
              When the approver key is gone there is nobody left to approve, so the owner schedules
              a recovery the candidate accepts. It cannot execute for seven days, and the sitting
              approver can veto it at any point in that window, even while the firewall is paused.
            </p>
            <Receipts
              rows={[
                { label: 'Early execution reverted', hash: GOVERNANCE_TXS.recoveryEarlyAttemptFailed },
                { label: 'Approver vetoed', hash: GOVERNANCE_TXS.recoveryVetoed },
                { label: 'Rescheduled', hash: GOVERNANCE_TXS.recoveryScheduled },
                { label: 'Candidate accepted', hash: GOVERNANCE_TXS.recoveryAccepted },
              ]}
            />
            <Countdown />
          </div>
        </div>
      </div>
    </Rail>
  );
}

function Receipts({ rows }: { rows: { label: string; hash: string }[] }) {
  return (
    <ul className="mt-6 border-t border-[var(--color-rule)]">
      {rows.map((r) => (
        <li
          key={r.hash}
          className="flex items-baseline justify-between gap-3 border-b border-[var(--color-rule)] py-3"
        >
          <span className="min-w-0 truncate text-[13px] text-[var(--color-ink-600)]">{r.label}</span>
          <a
            href={etherscanTx(r.hash)}
            target="_blank"
            rel="noreferrer"
            title={r.hash}
            className="ledger shrink-0 whitespace-nowrap text-[12px] text-[var(--color-accent)] underline decoration-transparent underline-offset-4 transition hover:decoration-current"
          >
            {shortAddress(r.hash, 6, 4)}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * A real countdown against a real `executeAfter` stored on chain.
 *
 * Rendered empty on the server and filled after mount, because the server and the browser would
 * otherwise disagree about the current second and React would report a hydration mismatch.
 */
function Countdown() {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(RECOVERY_EXECUTE_AFTER - Math.floor(Date.now() / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const ready = left !== null && left <= 0;
  const d = left === null ? 0 : Math.max(0, Math.floor(left / 86400));
  const h = left === null ? 0 : Math.max(0, Math.floor((left % 86400) / 3600));
  const m = left === null ? 0 : Math.max(0, Math.floor((left % 3600) / 60));
  const s = left === null ? 0 : Math.max(0, left % 60);

  return (
    <div className="panel mt-6 rounded-lg p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-ink-dim)]">
        Recovery pending on chain
      </p>
      <p className="ledger mt-3 text-[24px] font-medium tracking-tight text-[var(--color-nox)]">
        {left === null ? 'reading' : ready ? 'executable now' : `${d}d ${h}h ${m}m ${s}s`}
      </p>
      <p className="mt-3 text-[12.5px] leading-[1.6] text-[var(--color-ink-muted)]">
        Executable after 2026-07-28 20:02:12 UTC. This one sits on a disposable test vendor,
        created to watch the delay elapse on a public chain. The live vendor has no recovery
        pending.
      </p>
    </div>
  );
}

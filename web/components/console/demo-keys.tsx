'use client';

import { useState } from 'react';

import { DEMO_REVIEWERS } from '@/lib/demo-reviewers';
import { truncate } from './primitives';

/**
 * The demo reviewer keys, shown on the console so a visitor can drive the seal flow.
 *
 * Only the three registered reviewer wallets can seal a position, so a visitor with their own
 * wallet cannot experience the core action. This panel hands them the three throwaway keys to
 * import. It is the live-chain equivalent of the local quickstart, where the flow needs the three
 * Hardhat accounts.
 *
 * The keys are burners with no real value. The warning says so, because a key on screen invites a
 * mistake if the reader does not know it is disposable.
 */
export function DemoKeys() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    } catch {
      // Clipboard can be blocked; the key is visible to select by hand either way.
    }
  };

  return (
    <section className="tpanel p-4">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-divider)] pb-2.5">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-dim)]">
          Demo reviewer keys
        </h2>
        <span className="rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-warning)]">
          testnet burners
        </span>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-ink-dim)]">
        Only the three reviewer wallets can seal a position. Import all three keys below into your
        wallet, then connect each in turn to seal and settle. These are throwaway Sepolia keys with
        no value. Never send real funds to them.
      </p>

      <ul className="mt-3 space-y-2">
        {DEMO_REVIEWERS.map((r) => (
          <li
            key={r.role}
            className="rounded-md border border-[var(--color-panel-border)] bg-[var(--color-panel-raised)] p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[var(--color-ink)]">{r.role}</span>
              <span className="tnum text-[11px] text-[var(--color-ink-muted)]">
                {truncate(r.address, 6, 4)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="tnum min-w-0 flex-1 truncate text-[11px] text-[var(--color-ink-dim)]">
                {r.privateKey}
              </code>
              <button
                type="button"
                onClick={() => copy(r.privateKey, r.role)}
                className="shrink-0 rounded border border-[var(--color-panel-border)] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[var(--color-ink-dim)] hover:border-[var(--color-nox)] hover:text-[var(--color-nox)]"
              >
                {copied === r.role ? 'copied' : 'copy'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

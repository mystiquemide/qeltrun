'use client';

import { useState } from 'react';

import { etherscanTx, shortAddress } from '@/lib/sepolia-facts';
import { Rail } from './rail';

/**
 * The three-stage lifecycle, with the real Sepolia run behind it.
 *
 * Every transaction hash below is from the certified three-reviewer run recorded in the project
 * memory. Nothing here is illustrative. A reader who does not believe the description can open
 * any row and read the receipt.
 *
 * Numbered rows are allowed here because the content is genuinely ordinal, a sequence that only
 * runs one way. That is the exception to keeping section numbering off this page.
 */
type Stage = {
  index: string;
  key: string;
  title: string;
  body: string;
  gate: { label: string; tone: 'blocked' | 'allowed' };
  txs: { label: string; hash: string }[];
};

const STAGES: Stage[] = [
  {
    index: '01',
    key: 'open',
    title: 'Anyone may open a request',
    body: 'Opening records intent and moves nothing. The request id is derived on chain from the vendor, both wallets, the requester, a nonce and the approver epoch, so it cannot be chosen by the caller or replayed onto another deployment.',
    gate: { label: 'APPROVAL_REQUIRED', tone: 'blocked' },
    txs: [
      { label: 'Open change request', hash: '0xdbb4e084e78a6ddbdecb8bc8a2c26d9b0232c742ac7ca1e0544d78def98cd6b0' },
    ],
  },
  {
    index: '02',
    key: 'signal',
    title: 'Three reviewers seal in private',
    body: 'Each reviewer encrypts a value to the contract through the Nox gateway. Anything above one is clamped to zero inside the enclave, so a single reviewer cannot submit a three and clear the threshold alone. The running total stays encrypted throughout.',
    gate: { label: 'APPROVAL_REQUIRED', tone: 'blocked' },
    txs: [
      { label: 'Approver signal', hash: '0x1f5e837c4b32cd9e61f963579e89e20a664ec1638a1b3fbabdb343ffdbb955bd' },
      { label: 'Treasury signal', hash: '0x3e5bbc1afaa6a8bc4d810bd830c373562998962c8e632977860f16988386cdc7' },
      { label: 'Risk signal', hash: '0xeb950db8fbff6edf164429ebffe4eda84d28b932a478e088801062d936b5f021' },
    ],
  },
  {
    index: '03',
    key: 'settle',
    title: 'One verdict becomes public',
    body: 'The third signal seals the verdict and marks that single handle publicly decryptable. Settlement is permissionless, because the authority is the gateway signature and not the caller. A true verdict moves the payout wallet exactly once.',
    gate: { label: 'DESTINATION_UNCHANGED', tone: 'allowed' },
    txs: [
      { label: 'Settle approval', hash: '0x0743b8760fc8f27bdb5212b99ece5bd9811169e9c2d1ceec2b9aa25dc4071364' },
    ],
  },
];

/// `receipts` is off on the landing page and on at /proof. A treasury operator does not open
/// transaction hashes; the gate verdict is the part that means something to them.
export function Lifecycle({ receipts = false }: { receipts?: boolean }) {
  const [active, setActive] = useState(0);
  const stage = STAGES[active] as Stage;

  return (
    <Rail id="lifecycle">
      <div className="px-6 py-16 md:px-12 md:py-24">
        <h2 className="h-section max-w-[20ch] text-[var(--color-ink-900)]">
          From request to settlement.
        </h2>
        <p className="mt-4 max-w-[62ch] text-[16px] leading-[1.6] text-[var(--color-ink-600)]">
          Three stages, and the gate stays shut through the first two.
        </p>

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <ul className="border-t border-[var(--color-rule)]">
            {STAGES.map((s, i) => {
              const on = i === active;
              return (
                <li key={s.key} className="border-b border-[var(--color-rule)]">
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-expanded={on}
                    className="w-full cursor-pointer py-6 text-left"
                  >
                    <span className="ledger text-[11px] tracking-[0.12em] text-[var(--color-ink-400)]">
                      {s.index}
                    </span>
                    <span
                      className="mt-2 block text-[19px] font-semibold leading-snug tracking-[-0.01em] transition-colors"
                      style={{
                        color: on ? 'var(--color-ink-900)' : 'var(--color-ink-400)',
                      }}
                    >
                      {s.title}
                    </span>
                    {on && (
                      <span className="mt-3 block max-w-[52ch] text-[15px] leading-[1.6] text-[var(--color-ink-600)]">
                        {s.body}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* The console surface, so the receipt reads as chain state and not as marketing. */}
          <div className="panel h-fit rounded-lg p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-ink-dim)]">
                Gate after stage {stage.index}
              </span>
              <span className="ledger text-[11px] text-[var(--color-ink-muted)]">sepolia</span>
            </div>

            <p
              className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.01em]"
              style={{
                color:
                  stage.gate.tone === 'allowed' ? 'var(--color-approved)' : 'var(--color-blocked)',
              }}
            >
              {stage.gate.tone === 'allowed' ? 'Payout allowed' : 'Payout blocked'}
            </p>
            <p className="ledger mt-1 text-[12px] text-[var(--color-ink-dim)]">{stage.gate.label}</p>

            {receipts && (
            <div className="mt-6 space-y-3 border-t hairline pt-5">
              {stage.txs.map((t) => (
                <div key={t.hash} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[12px] text-[var(--color-ink-muted)]">
                    {t.label}
                  </span>
                  {/* The hash must never wrap. A clickable that breaks across two lines is a
                      broken hit target, and at 320px this one did. */}
                  <a
                    href={etherscanTx(t.hash)}
                    target="_blank"
                    rel="noreferrer"
                    title={t.hash}
                    className="ledger shrink-0 whitespace-nowrap text-[12px] text-[var(--color-nox)] underline decoration-transparent underline-offset-4 transition hover:decoration-current"
                  >
                    {shortAddress(t.hash, 6, 4)}
                  </a>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
      </div>
    </Rail>
  );
}

'use client';

import {
  DEFAULT_PROPOSED_WALLET,
  defaultChainId,
  deploymentFor,
  isLocalChain,
} from '@/lib/config';
import { useGate, useVendorView } from '@/lib/use-firewall';
import { truncate } from '@/components/primitives';

/**
 * The live gate, embedded in the marketing page.
 *
 * The real component, reading the real chain. If the
 * chain says the destination is blocked, this says blocked. That is the entire argument of the
 * page, so faking it here would be self-defeating.
 *
 * It renders on the console's dark surface inside the light page, which is the same seam the
 * reference uses when it drops product UI into a marketing section.
 */
export function HeroConsole() {
  const chainId = defaultChainId();
  const deployment = deploymentFor(chainId);
  const destination = deployment?.proposedWallet ?? DEFAULT_PROPOSED_WALLET;

  const { vendor } = useVendorView(deployment);
  const gate = useGate(deployment, destination);

  const [allowed, reason] = (gate.data as readonly [boolean, string] | undefined) ?? [false, ''];
  const pending = gate.isLoading || deployment === undefined;
  const accent = allowed ? 'var(--color-approved)' : 'var(--color-blocked)';

  return (
    <div className="panel rounded-lg p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-2 w-2 rounded-full ${pending ? 'pulse-live' : ''}`}
            style={{ background: pending ? 'var(--color-ink-muted)' : accent }}
          />
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-ink-dim)]">
            Live payout gate
          </span>
        </div>
        <span className="ledger text-[11px] text-[var(--color-ink-muted)]">
          {deployment === undefined
            ? 'no deployment'
            : isLocalChain(deployment.chainId)
              ? 'local chain'
              : `chain ${deployment.chainId}`}
        </span>
      </div>

      <p
        className="mt-4 text-[30px] font-semibold leading-tight tracking-[-0.02em]"
        style={{ color: pending ? 'var(--color-ink-muted)' : accent }}
      >
        {pending ? 'Reading gate' : allowed ? 'Payout allowed' : 'Payout blocked'}
      </p>

      <dl className="mt-5 space-y-2.5 border-t hairline pt-4">
        <Row label="Reason" value={reason === '' ? 'reading' : reason} mono />
        <Row label="Destination tested" value={truncate(destination, 10, 8)} mono />
        <Row
          label="Vendor payout wallet"
          value={vendor === undefined ? 'reading' : truncate(vendor.payoutWallet, 10, 8)}
          mono
        />
      </dl>

      <p className="mt-4 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
        Read live from chain on page load. No wallet needed to see the gate.
      </p>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[12px] text-[var(--color-ink-muted)]">{label}</dt>
      <dd className={`text-[13px] text-[var(--color-ink)] ${mono ? 'ledger' : ''}`}>{value}</dd>
    </div>
  );
}

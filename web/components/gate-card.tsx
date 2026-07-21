'use client';

import { Mono, truncate } from './primitives';

export type GateReason =
  | 'VENDOR_NOT_REGISTERED'
  | 'ZERO_DESTINATION'
  | 'DESTINATION_UNCHANGED'
  | 'APPROVAL_REQUIRED';

/// One line per verdict, phrased the way an operator would want to read it in an incident.
const COPY: Record<GateReason, { headline: string; detail: string }> = {
  DESTINATION_UNCHANGED: {
    headline: 'Payout allowed',
    detail: 'This destination is the vendor’s current payout wallet.',
  },
  APPROVAL_REQUIRED: {
    headline: 'Payout blocked',
    detail:
      'This destination is not the vendor’s payout wallet. Moving it requires a Nox-sealed approval from the registered approver.',
  },
  VENDOR_NOT_REGISTERED: {
    headline: 'Payout blocked',
    detail: 'This vendor is not registered with the firewall, so no destination is cleared.',
  },
  ZERO_DESTINATION: {
    headline: 'Payout blocked',
    detail: 'The destination is the zero address.',
  },
};

export function GateCard({
  allowed,
  reason,
  destination,
  pending,
}: {
  allowed: boolean;
  reason: GateReason | string;
  destination: string;
  pending: boolean;
}) {
  const copy = COPY[reason as GateReason] ?? {
    headline: allowed ? 'Payout allowed' : 'Payout blocked',
    detail: reason,
  };

  const accent = allowed ? 'var(--color-approved)' : 'var(--color-blocked)';

  return (
    <section
      className="panel rounded-md p-6"
      style={{ borderColor: pending ? undefined : accent }}
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`h-2 w-2 rounded-full ${pending ? 'pulse-live' : ''}`}
          style={{ background: pending ? 'var(--color-ink-muted)' : accent }}
        />
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-ink-dim)]">
          Payout gate
        </span>
      </div>

      <p
        className="mt-3 text-[26px] leading-tight font-semibold tracking-tight"
        style={{ color: pending ? 'var(--color-ink-muted)' : accent }}
      >
        {pending ? 'Reading gate…' : copy.headline}
      </p>

      <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-[var(--color-ink-dim)]">
        {copy.detail}
      </p>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t hairline pt-3">
        <span className="text-[12px] text-[var(--color-ink-muted)]">Destination tested</span>
        <Mono value={truncate(destination, 14, 10)} title={destination} />
        <span className="ledger text-[11px] text-[var(--color-ink-muted)]">{reason}</span>
      </div>
    </section>
  );
}

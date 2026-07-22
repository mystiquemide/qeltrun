'use client';

import type { Address, Deployment, Hex } from '@/lib/config';
import { ROLE_LABELS, useHasSubmitted, type ReviewerRole, type VendorView } from '@/lib/use-firewall';
import { Mono, truncate } from './primitives';

/**
 * The three seats and whether each has sealed.
 *
 * This shows who has signed and never how they signed. That distinction is the product: a
 * reviewer can see that two colleagues have already sealed without learning which way, so nobody
 * waits to follow the room.
 *
 * With no request open there is nothing to have signed, so the rows report the seats only.
 */
export function Reviewers({
  deployment,
  vendor,
  requestId,
  connected,
  connectedRole,
}: {
  deployment: Deployment | undefined;
  vendor: VendorView | undefined;
  requestId: Hex | undefined;
  connected: Address | undefined;
  connectedRole: ReviewerRole | undefined;
}) {
  const seats: { role: ReviewerRole; address: Address | undefined }[] = [
    { role: 'approver', address: vendor?.approver },
    { role: 'treasury', address: vendor?.treasuryReviewer },
    { role: 'risk', address: vendor?.riskReviewer },
  ];

  return (
    <ul className="divide-y divide-[var(--color-divider)]">
      {seats.map((s) => (
        <Seat
          key={s.role}
          deployment={deployment}
          requestId={requestId}
          role={s.role}
          address={s.address}
          isYou={connectedRole === s.role && connected !== undefined}
        />
      ))}
    </ul>
  );
}

function Seat({
  deployment,
  requestId,
  role,
  address,
  isYou,
}: {
  deployment: Deployment | undefined;
  requestId: Hex | undefined;
  role: ReviewerRole;
  address: Address | undefined;
  isYou: boolean;
}) {
  const { data: submitted } = useHasSubmitted(deployment, requestId, address);
  const sealed = submitted === true;

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[13px] text-[var(--color-ink)]">
          {ROLE_LABELS[role]}
          {isYou && (
            <span className="rounded border border-[var(--color-nox)]/40 bg-[var(--color-nox)]/10 px-1 py-px text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--color-nox)]">
              you
            </span>
          )}
        </p>
        <Mono
          value={address === undefined ? 'reading' : truncate(address, 10, 6)}
          title={address}
        />
      </div>

      {/* A filled dot plus the word. Colour alone never carries the state, but on a dense dark
          surface the dot is what the eye catches first. */}
      <span
        className={`flex shrink-0 items-center gap-1.5 text-[12px] ${sealed ? 'glow' : ''}`}
        style={{ color: sealed ? 'var(--color-approved)' : 'var(--color-ink-muted)' }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: sealed ? 'var(--color-approved)' : 'var(--color-ink-muted)',
            opacity: sealed ? 1 : 0.5,
            boxShadow: sealed ? '0 0 6px var(--color-approved)' : 'none',
          }}
        />
        {requestId === undefined ? 'no request' : sealed ? 'sealed' : 'waiting'}
      </span>
    </li>
  );
}

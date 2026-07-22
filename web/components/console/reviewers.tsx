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
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[13px] text-[var(--color-ink)]">
          {ROLE_LABELS[role]}
          {isYou && (
            <span className="rounded border border-[var(--color-nox)]/40 px-1 py-px text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--color-nox)]">
              you
            </span>
          )}
        </p>
        <Mono
          value={address === undefined ? 'reading' : truncate(address, 10, 6)}
          title={address}
        />
      </div>

      <span
        className="shrink-0 text-[12px]"
        style={{ color: sealed ? 'var(--color-approved)' : 'var(--color-ink-muted)' }}
      >
        {requestId === undefined ? 'no request' : sealed ? 'sealed' : 'waiting'}
      </span>
    </li>
  );
}

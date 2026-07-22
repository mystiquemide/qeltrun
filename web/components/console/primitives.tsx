'use client';

import type { ReactNode } from 'react';

/**
 * Console primitives.
 *
 * The console is a trading terminal, not a document. Captured live from Hyperliquid and GMX:
 * raised panels on a darker canvas, a dense horizontal stat strip carrying the numbers you scan
 * first, tabular monospace figures, and colour reserved for live state. The marketing page's
 * hairline-and-open-region pattern is deliberately not reused here - it flattens exactly the
 * density this surface is for. One radius, 6px, matching both references.
 */
export function Region({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="tpanel">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--color-divider)] px-4 py-2.5">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-dim)]">
          {title}
        </h2>
        {aside}
      </header>
      <div className="px-4 py-3.5">{children}</div>
    </section>
  );
}

/**
 * The strip of headline numbers across the top, the first thing an operator reads.
 *
 * Both reference terminals lead with one of these rather than a vertical field list: Hyperliquid
 * runs mark / oracle / 24h change / volume / open interest / funding, GMX runs price / volume /
 * open interest / liquidity / net rate. Scanning left to right across one line is faster than
 * reading down a column, which is the whole point.
 */
export function StatStrip({ children }: { children: ReactNode }) {
  return (
    <div className="tpanel flex flex-wrap items-stretch divide-x divide-[var(--color-divider)] overflow-hidden">
      {children}
    </div>
  );
}

export function Stat({
  label,
  children,
  tone,
}: {
  label: string;
  children: ReactNode;
  tone?: 'approved' | 'blocked' | 'nox' | 'warning' | undefined;
}) {
  const color = tone === undefined ? 'var(--color-ink)' : `var(--color-${tone})`;
  return (
    <div className="min-w-0 flex-1 basis-[150px] px-4 py-2.5">
      <p className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
        {label}
      </p>
      {/* Only a stat carrying state lights up. If everything glowed, nothing would read as live. */}
      <p
        className={`tnum mt-1 truncate text-[14px] ${tone === undefined ? '' : 'glow'}`}
        style={{ color }}
      >
        {children}
      </p>
    </div>
  );
}

export function Field({
  label,
  children,
  emphasis = false,
}: {
  label: string;
  children: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-[12px] text-[var(--color-ink-muted)]">{label}</span>
      <span className={`min-w-0 text-right ${emphasis ? 'text-[var(--color-ink)]' : ''}`}>
        {children}
      </span>
    </div>
  );
}

/// Addresses, request ids, handles and proofs are read character by character, so they are always
/// mono and always truncated in the middle. The ends are what distinguish them. Tabular figures
/// keep a changing value from shifting the ones next to it.
export function Mono({ value, title }: { value: string; title?: string | undefined }) {
  return (
    <span className="tnum text-[13px] text-[var(--color-ink)]" title={title ?? value}>
      {value}
    </span>
  );
}

export function truncate(value: string, lead = 10, tail = 8): string {
  return value.length <= lead + tail + 1 ? value : `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

export function Button({
  children,
  onClick,
  disabled = false,
  busy = false,
  tone = 'default',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'default' | 'primary';
}) {
  // GMX and Hyperliquid both fill their execution control solid and leave everything else
  // outlined. The filled button is the one that moves money, and it should be unmistakable.
  const base =
    'w-full rounded-md px-3 py-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed';
  const tones = {
    default:
      'border border-[var(--color-panel-border)] bg-[var(--color-panel-raised)] text-[var(--color-ink)] hover:border-[var(--color-ink-muted)] disabled:bg-transparent disabled:text-[var(--color-ink-muted)] disabled:hover:border-[var(--color-panel-border)]',
    primary:
      'bg-[var(--color-nox)] text-[#06070a] hover:brightness-110 disabled:bg-[var(--color-panel-raised)] disabled:text-[var(--color-ink-muted)] disabled:hover:brightness-100',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={`${base} ${tones[tone]}`}
    >
      {busy ? 'Working' : children}
    </button>
  );
}

export function Tag({
  children,
  tone,
}: {
  children: ReactNode;
  tone: 'nox' | 'muted' | 'warning' | 'approved' | 'blocked';
}) {
  // Tinted fill rather than outline only. On a layered dark canvas an outlined chip disappears
  // against a panel border; the reference terminals all tint their status pills.
  const tones = {
    nox: 'border-[var(--color-nox)]/40 bg-[var(--color-nox)]/10 text-[var(--color-nox)]',
    muted: 'border-[var(--color-panel-border)] bg-[var(--color-panel-raised)] text-[var(--color-ink-muted)]',
    warning: 'border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
    approved: 'border-[var(--color-approved)]/40 bg-[var(--color-approved)]/10 text-[var(--color-approved)]',
    blocked: 'border-[var(--color-blocked)]/40 bg-[var(--color-blocked)]/10 text-[var(--color-blocked)]',
  };
  return (
    <span
      className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/// Every state the console reports says what it is and why, so colour is never the only carrier.
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">{children}</p>
  );
}

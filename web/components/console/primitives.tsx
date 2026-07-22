'use client';

import type { ReactNode } from 'react';

/**
 * Console primitives.
 *
 * Regions are separated by hairline rules, not by drawing a box around each one. That is the
 * pattern the landing page settled on and the pattern Linear, Resend and Neon all use in their
 * product surfaces. The previous console drew a bordered panel per section, which reads as cards.
 *
 * One radius, 6px, everywhere. The reference consoles cluster at 2px to 6px; the old console
 * mixed 6px and 8px with no rule about which went where.
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
    <section>
      <header className="flex items-center justify-between gap-3 border-b border-[var(--color-divider)] pb-2.5">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-dim)]">
          {title}
        </h2>
        {aside}
      </header>
      <div className="pt-4">{children}</div>
    </section>
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
/// mono and always truncated in the middle. The ends are what distinguish them.
export function Mono({ value, title }: { value: string; title?: string | undefined }) {
  return (
    <span className="ledger text-[13px] text-[var(--color-ink)]" title={title ?? value}>
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
  const base =
    'w-full rounded-md px-3 py-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed';
  const tones = {
    default:
      'border border-[var(--color-panel-border)] text-[var(--color-ink)] hover:border-[var(--color-ink-muted)] disabled:text-[var(--color-ink-muted)] disabled:hover:border-[var(--color-panel-border)]',
    primary:
      'border border-[var(--color-nox)] text-[var(--color-nox)] hover:bg-[var(--color-nox)]/10 disabled:border-[var(--color-panel-border)] disabled:text-[var(--color-ink-muted)] disabled:hover:bg-transparent',
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
  const tones = {
    nox: 'border-[var(--color-nox)]/40 text-[var(--color-nox)]',
    muted: 'border-[var(--color-panel-border)] text-[var(--color-ink-muted)]',
    warning: 'border-[var(--color-warning)]/40 text-[var(--color-warning)]',
    approved: 'border-[var(--color-approved)]/40 text-[var(--color-approved)]',
    blocked: 'border-[var(--color-blocked)]/40 text-[var(--color-blocked)]',
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

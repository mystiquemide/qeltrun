'use client';

import type { ReactNode } from 'react';

export function Panel({
  title,
  aside,
  children,
  className = '',
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel rounded-md ${className}`}>
      <header className="flex items-center justify-between border-b hairline px-4 py-2.5">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-dim)]">
          {title}
        </h2>
        {aside}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

/// Addresses, ids, handles and proofs are read character by character, so they are always mono
/// and always truncated in the middle — the ends are what distinguish them.
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
      <span className={`text-right ${emphasis ? 'text-[var(--color-ink)]' : ''}`}>{children}</span>
    </div>
  );
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
    'w-full rounded px-3 py-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed';
  const tones = {
    default:
      'border border-[var(--color-panel-border)] text-[var(--color-ink)] hover:border-[var(--color-ink-muted)] disabled:text-[var(--color-ink-muted)] disabled:hover:border-[var(--color-panel-border)]',
    primary:
      'border border-[var(--color-nox)] text-[var(--color-nox)] hover:bg-[var(--color-nox)]/10 disabled:border-[var(--color-panel-border)] disabled:text-[var(--color-ink-muted)] disabled:hover:bg-transparent',
  };

  return (
    <button type="button" onClick={onClick} disabled={disabled || busy} className={`${base} ${tones[tone]}`}>
      {busy ? 'Working…' : children}
    </button>
  );
}

export function Tag({ children, tone }: { children: ReactNode; tone: 'nox' | 'muted' | 'warning' }) {
  const tones = {
    nox: 'border-[var(--color-nox)]/40 text-[var(--color-nox)]',
    muted: 'border-[var(--color-panel-border)] text-[var(--color-ink-muted)]',
    warning: 'border-[var(--color-warning)]/40 text-[var(--color-warning)]',
  };
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

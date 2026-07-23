import type { ReactNode } from 'react';
import Link from 'next/link';

/// The page header: a category kicker, the title, and a one-line purpose.
export function DocHeader({
  kind,
  title,
  intro,
}: {
  kind: string;
  title: string;
  intro: string;
}) {
  return (
    <header className="mb-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">
        {kind}
      </p>
      <h1 className="mt-2 text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--color-ink-900)]">
        {title}
      </h1>
      <p className="mt-3 text-[16px] leading-[1.6] text-[var(--color-ink-600)]">{intro}</p>
    </header>
  );
}

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="mt-10 scroll-mt-24 text-[21px] font-semibold tracking-[-0.01em] text-[var(--color-ink-900)]"
    >
      {children}
    </h2>
  );
}

export function H3({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3
      id={id}
      className="mt-7 scroll-mt-24 text-[16px] font-semibold text-[var(--color-ink-900)]"
    >
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 text-[15px] leading-[1.7] text-[var(--color-ink-600)]">{children}</p>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-[1.6] text-[var(--color-ink-600)]">
      {children}
    </ul>
  );
}

export function OL({ children }: { children: ReactNode }) {
  return (
    <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px] leading-[1.6] text-[var(--color-ink-600)]">
      {children}
    </ol>
  );
}

/// Inline monospace, for a command, path, function name, or address.
export function C({ children }: { children: ReactNode }) {
  return (
    <code className="ledger rounded bg-[var(--color-band)] px-1.5 py-0.5 text-[13px] text-[var(--color-ink-900)]">
      {children}
    </code>
  );
}

/// A code block. Kept plain and monospace; no syntax highlighting to keep the page dependency-free.
export function Code({ children }: { children: string }) {
  return (
    <pre className="ledger mt-4 overflow-x-auto rounded-md border border-[var(--color-rule)] bg-[var(--color-band)] p-4 text-[13px] leading-[1.6] text-[var(--color-ink-900)]">
      <code>{children}</code>
    </pre>
  );
}

/// A callout. `tone` sets the accent stripe: note is neutral, warning is amber-ish, tip is green.
export function Callout({
  tone = 'note',
  title,
  children,
}: {
  tone?: 'note' | 'warning' | 'tip';
  title?: string;
  children: ReactNode;
}) {
  const border = {
    note: 'border-l-[var(--color-ink-400)]',
    warning: 'border-l-[#c9820a]',
    tip: 'border-l-[var(--color-accent)]',
  }[tone];
  return (
    <div className={`mt-5 rounded-r-md border-l-2 bg-[var(--color-band)] px-4 py-3 ${border}`}>
      {title !== undefined && (
        <p className="text-[13px] font-semibold text-[var(--color-ink-900)]">{title}</p>
      )}
      <div className="text-[14px] leading-[1.6] text-[var(--color-ink-600)]">{children}</div>
    </div>
  );
}

/// The related-pages row at the foot of every page.
export function Related({ links }: { links: { label: string; href: string }[] }) {
  return (
    <nav aria-label="Related pages" className="mt-12 border-t border-[var(--color-rule)] pt-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-400)]">
        Related
      </p>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-[14px] text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-solid)]"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

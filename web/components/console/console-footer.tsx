import Link from 'next/link';

const GITHUB = 'https://github.com/mystiquemide/qeltrun';

/**
 * A thin footer for the console surface.
 *
 * The marketing `Footer` is a light card, so it cannot sit under the black console without
 * breaking the surface. This is the dark equivalent: one hairline rule and a row of the same
 * trust links, in the console palette. It carries the license and the legal pages the deep pages
 * were missing.
 */
const LINKS: { label: string; href: string; external?: boolean }[] = [
  { label: 'Proof', href: '/proof' },
  { label: 'Docs', href: '/docs' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'GitHub', href: GITHUB, external: true },
];

export function ConsoleFooter() {
  return (
    <footer className="relative z-10 mt-8 border-t border-[var(--color-panel-border)]">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-5 py-5">
        <p className="tnum text-[12px] text-[var(--color-ink-muted)]">Qeltrun</p>
        <nav aria-label="Console footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {LINKS.map((l) =>
            l.external ? (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] text-[var(--color-ink-dim)] transition-colors hover:text-[var(--color-ink)]"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                className="text-[12px] text-[var(--color-ink-dim)] transition-colors hover:text-[var(--color-ink)]"
              >
                {l.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </footer>
  );
}

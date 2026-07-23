'use client';

import Link from 'next/link';
import { useState } from 'react';

const GITHUB = 'https://github.com/mystiquemide/qeltrun';

/// Governance and receipts used to be anchors on this page. They moved to `/proof` when the
/// technical evidence came off the landing page, so these point at the route now. An anchor to a
/// section that no longer exists scrolls nowhere and looks broken.
const LINKS = [
  { label: 'How it works', href: '/#lifecycle' },
  { label: 'Proof', href: '/proof' },
  { label: 'Docs', href: '/docs' },
  { label: 'GitHub', href: GITHUB, external: true },
] as const;

export function Nav() {
  // Below md the links collapse behind a button. Without it a phone visitor loses every route
  // except the CTA, which the audit caught.
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-rule)] bg-[var(--color-canvas)]/95 backdrop-blur-[2px]">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-6 md:px-12">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[var(--color-ink-900)]"
          aria-label="Qeltrun home"
        >
          <Mark />
          <span className="text-[17px] font-semibold tracking-[-0.02em]">Qeltrun</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              {...('external' in link && link.external
                ? { target: '_blank', rel: 'noreferrer' }
                : {})}
              className="text-[15px] text-[var(--color-ink-600)] transition-colors hover:text-[var(--color-ink-900)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/app"
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--color-accent-solid)]"
          >
            Open the console
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-rule)] text-[var(--color-ink-900)] md:hidden"
          >
            <MenuIcon open={open} />
          </button>
        </div>
      </div>

      {/* The mobile panel. Rendered only when open, and closing it on any link tap means a
          navigation never leaves the menu covering the page it went to. */}
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Primary"
          className="border-t border-[var(--color-rule)] bg-[var(--color-canvas)] px-6 py-4 md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  {...('external' in link && link.external
                    ? { target: '_blank', rel: 'noreferrer' }
                    : {})}
                  className="block rounded-md px-2 py-2.5 text-[15px] text-[var(--color-ink-900)] hover:bg-[var(--color-band)]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      {open ? (
        <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}

/**
 * Three signals resolving into one verdict.
 *
 * Three separate marks on the left, one solid bar on the right. It is the product: three private
 * reviewer signals aggregate confidentially and only the combined result becomes public. Drawn
 * inline so it inherits colour and costs no request.
 *
 * An earlier version drew a literal gate, two uprights and a crossbar, which read as the letter
 * H. Do not go back to that.
 */
export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2" y="2.5" width="4" height="4" rx="0.75" fill="currentColor" />
      <rect x="2" y="8" width="4" height="4" rx="0.75" fill="currentColor" />
      <rect x="2" y="13.5" width="4" height="4" rx="0.75" fill="currentColor" />
      <rect x="13" y="2.5" width="5" height="15" rx="1" fill="var(--color-accent)" />
    </svg>
  );
}

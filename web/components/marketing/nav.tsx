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

export function Nav({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  // Below md the links collapse behind a button. Without it a phone visitor loses every route
  // except the CTA, which the audit caught.
  const [open, setOpen] = useState(false);
  const dark = variant === 'dark';

  // The dark variant is genuinely transparent, not a tinted or blurred bar - it is meant to read
  // as the hero photograph with text floating on it, not as a panel sitting on top of one. A
  // shadow on the text itself buys legibility over the brighter parts of the photo without
  // painting anything behind the bar. It is `absolute`, not `sticky`, on purpose: it belongs to
  // the hero only and should scroll away with it, rather than persisting as unreadable white
  // text over the light sections that follow.
  const textShadow = dark ? { textShadow: '0 1px 6px rgba(0,0,0,0.55)' } : undefined;

  return (
    <header
      className={
        dark
          ? 'absolute inset-x-0 top-0 z-50'
          : 'sticky top-0 z-50 border-b border-[var(--color-rule)] bg-[var(--color-canvas)]/95 backdrop-blur-[2px]'
      }
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-6 md:px-12">
        <Link
          href="/"
          className={`flex items-center gap-2.5 ${dark ? 'text-white' : 'text-[var(--color-ink-900)]'}`}
          style={textShadow}
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
              className={`text-[15px] transition-colors ${
                dark
                  ? 'text-white/90 hover:text-white'
                  : 'text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)]'
              }`}
              style={textShadow}
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
            className={`flex h-9 w-9 items-center justify-center rounded-md border md:hidden ${
              dark ? 'border-white/40 text-white' : 'border-[var(--color-rule)] text-[var(--color-ink-900)]'
            }`}
            style={textShadow}
          >
            <MenuIcon open={open} />
          </button>
        </div>
      </div>

      {/* The mobile panel needs its own backing regardless of variant - an open dropdown is a
          transient overlay by nature, not the persistent bar the transparency rule is about. */}
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Primary"
          className={`border-t px-6 py-4 md:hidden ${
            dark ? 'border-white/10 bg-[var(--color-hero-bg)]/95' : 'border-[var(--color-rule)] bg-[var(--color-canvas)]'
          }`}
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
                  className={`block rounded-md px-2 py-2.5 text-[15px] ${
                    dark
                      ? 'text-white hover:bg-white/10'
                      : 'text-[var(--color-ink-900)] hover:bg-[var(--color-band)]'
                  }`}
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
export function Mark({
  size = 20,
  accent,
}: {
  size?: number;
  accent?: string | undefined;
}) {
  const fill = accent ?? 'var(--color-accent)';
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2" y="2.5" width="4" height="4" rx="0.75" fill="currentColor" />
      <rect x="2" y="8" width="4" height="4" rx="0.75" fill="currentColor" />
      <rect x="2" y="13.5" width="4" height="4" rx="0.75" fill="currentColor" />
      <rect x="13" y="2.5" width="5" height="15" rx="1" fill={fill} />
    </svg>
  );
}

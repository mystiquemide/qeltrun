import Link from 'next/link';

const GITHUB = 'https://github.com/mystiquemide/qeltrun';

/// Governance and receipts used to be anchors on this page. They moved to `/proof` when the
/// technical evidence came off the landing page, so these point at the route now. An anchor to a
/// section that no longer exists scrolls nowhere and looks broken.
const LINKS = [
  { label: 'How it works', href: '/#lifecycle' },
  { label: 'Proof', href: '/proof' },
  { label: 'GitHub', href: GITHUB, external: true },
] as const;

export function Nav() {
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

        <Link
          href="/app"
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--color-accent-solid)]"
        >
          Open the console
        </Link>
      </div>
    </header>
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

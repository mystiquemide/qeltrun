import type { ReactNode } from 'react';
import Link from 'next/link';

import { Footer, FooterCta } from './footer';
import { Nav } from './nav';
import { Rail, RailInner } from './rail';

/**
 * The shell every legal page shares.
 *
 * Privacy and Terms are the same shape: a nav, a titled prose column inside the rail, and the
 * footer. Keeping the frame in one place means the two pages cannot drift apart.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  /// The last-reviewed date, shown so a reader knows how current the page is.
  updated: string;
  children: ReactNode;
}) {
  return (
    <>
      <Nav />
      <main id="main-content">
        <Rail>
          <RailInner className="pt-16 pb-20 md:pt-20">
            <Link
              href="/"
              className="text-[13px] text-[var(--color-ink-600)] transition-colors hover:text-[var(--color-ink-900)]"
            >
              Back to Qeltrun
            </Link>
            <h1 className="h-section mt-6 max-w-[20ch] text-[var(--color-ink-900)]">{title}</h1>
            <p className="mt-3 text-[13px] text-[var(--color-ink-600)]">Last reviewed {updated}.</p>
            <div className="legal-prose mt-10 max-w-[68ch]">{children}</div>
          </RailInner>
        </Rail>
      </main>
      <FooterCta />
      <Footer />
    </>
  );
}

/// A section inside a legal page. One heading, then its paragraphs.
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--color-ink-900)]">
        {heading}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-[1.65] text-[var(--color-ink-600)]">
        {children}
      </div>
    </section>
  );
}

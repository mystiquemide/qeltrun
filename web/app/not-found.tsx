import Link from 'next/link';

import { Footer } from '@/components/marketing/footer';
import { Nav } from '@/components/marketing/nav';
import { Rail, RailInner } from '@/components/marketing/rail';

/**
 * The branded 404.
 *
 * Without this Next falls back to its own unstyled default, which looks like a different site
 * from the one the visitor clicked out of. Same shell `LegalPage` uses, so a wrong turn still
 * reads as Qeltrun rather than a broken deploy.
 */
export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main-content">
        <Rail>
          <RailInner className="pt-16 pb-20 md:pt-20">
            <p className="ledger text-[13px] text-[var(--color-ink-600)]">404</p>
            <h1 className="h-section mt-4 max-w-[20ch] text-[var(--color-ink-900)]">
              This address isn&apos;t cleared.
            </h1>
            <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.6] text-[var(--color-ink-600)]">
              Nothing lives at this path. The console, the proof page and the docs are all still
              where they were.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="rounded-md bg-[var(--color-accent)] px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--color-accent-solid)]"
              >
                Back to Qeltrun
              </Link>
              <Link
                href="/app"
                className="rounded-md border border-[var(--color-rule)] px-5 py-2.5 text-[14px] font-medium text-[var(--color-ink-900)] transition-colors hover:border-[var(--color-ink-400)]"
              >
                Open the console
              </Link>
            </div>
          </RailInner>
        </Rail>
      </main>
      <Footer />
    </>
  );
}

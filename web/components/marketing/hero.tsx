'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';

/// The rings/fog/particles are decorative, not critical content, so they load after the headline
/// and buttons are already interactive rather than sharing the initial bundle with them. `ssr:
/// false` also sidesteps ever needing to server-render a `<canvas>`-adjacent, viewport-measuring
/// component that only makes sense once a real window exists.
const HeroPortal = dynamic(() => import('./hero-portal').then((m) => m.HeroPortal), { ssr: false });

/**
 * The hero is the one place the light surface goes dark, which makes it the transition into the
 * console. It earns the space by doing that job.
 *
 * Deliberately one column. The live gate panel that used to sit on the right belongs in the
 * product scene section, where it gets room to be read; crammed beside the headline it turned
 * the hero into a two-column feature block. `HeroConsole` is kept for that section.
 *
 * Left aligned. A centred headline over a centred sub over centred buttons is
 * the most generated shape on the web, and the scrim is weighted left so the photograph stays
 * legible as structure on the right.
 *
 * Photograph by Clem Onojeghuo on Unsplash, credited in the footer references block.
 */
export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();

  // Same scroll range HeroPortal reads (Hero's own height, roughly 80-100vh): as the section
  // scrolls out from under the viewport, the text moves forward a little and fades, so it reads
  // as passing the portal rather than the page just ending.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });
  const reduced = reducedMotion === true;
  const textOpacity = useTransform(scrollYProgress, [0, 0.45, 0.8], reduced ? [1, 1, 1] : [1, 1, 0]);
  const textScale = useTransform(scrollYProgress, [0, 1], reduced ? [1, 1] : [1, 1.06]);

  return (
    /* Full bleed. The hatched gutters disappear against a light section but turn
       into a white frame around a dark one, which reads as a mistake. The hero is also the one
       section allowed to break the grid; the rail resumes below it. */
    <section ref={sectionRef} className="relative overflow-hidden bg-[var(--color-hero-bg)]">
      {/* Nav is `absolute` over this section (see nav.tsx), not in flow, so the section itself
          already starts at the very top of the page - the photograph needs no extra reach to
          run behind it. */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/hero-structure.jpg)' }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, var(--color-hero-scrim-from) 0%, var(--color-hero-scrim-mid) 46%, var(--color-hero-scrim-to) 100%)',
        }}
        aria-hidden
      />

      {/* Behind the text, above the photo. A sealed verification chamber, restrained in idle,
          that grows and darkens as this section scrolls out - see hero-portal.tsx. */}
      <HeroPortal containerRef={sectionRef} />

      <div className="relative mx-auto max-w-[1240px]">
        {/* Sized so the hero lands around 83vh at 1440x900. At a full 100vh there is no hint that
            anything follows and the section below never peeks above the fold. */}
        {/* The brighter cut of the photo (a later fix) meant the muted hero-ink paragraph lost
            enough contrast to blend into the lighter parts of the image behind it, even though
            it still passed a flat-background contrast check. A text-shadow makes legibility hold
            regardless of what part of the photo sits behind it, the same fix already used for
            the nav. */}
        <motion.div
          style={{ opacity: textOpacity, scale: textScale }}
          className="px-6 py-20 [text-shadow:0_1px_3px_rgba(0,0,0,0.85),0_2px_12px_rgba(0,0,0,0.6)] md:px-12 md:py-28"
        >
          <h1 className="h-display max-w-[13ch] text-white">Before funds move, prove the change.</h1>

          <p className="mt-8 max-w-[56ch] text-[18px] leading-[1.6] text-[var(--color-hero-ink)]">
            Qeltrun is a vendor change fraud firewall for treasuries. Three reviewers each seal a
            private approval inside an iExec Nox enclave, the contract adds them up without seeing
            them, and only the verdict becomes public.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3 [text-shadow:none]">
            <Link
              href="/app"
              className="rounded-md bg-[var(--color-accent)] px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--color-accent-solid)]"
            >
              Open the console
            </Link>
            <Link
              href="/proof"
              className="rounded-md border border-white/25 px-6 py-3.5 text-[15px] font-medium text-white transition-colors hover:border-white/60"
            >
              Read the receipts
            </Link>
          </div>

          <p className="mt-8 text-[13px] text-[var(--color-hero-dim)]">
            Live on Ethereum Sepolia. Every claim on this page links to a transaction.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

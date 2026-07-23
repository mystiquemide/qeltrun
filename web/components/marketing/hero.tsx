import Link from 'next/link';

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
  return (
    /* Full bleed. The hatched gutters disappear against a light section but turn
       into a white frame around a dark one, which reads as a mistake. The hero is also the one
       section allowed to break the grid; the rail resumes below it. */
    <section className="relative -mt-16 overflow-hidden bg-[var(--color-hero-bg)]">
      {/* Reaches 64px above the section's own box, the height of the sticky nav sitting on top
          of it, so the photograph runs behind the transparent nav instead of stopping at a hard
          seam under it. */}
      <div
        className="absolute inset-x-0 -top-16 bottom-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/hero-structure.jpg)' }}
        aria-hidden
      />
      <div
        className="absolute inset-x-0 -top-16 bottom-0"
        style={{
          background:
            'linear-gradient(90deg, var(--color-hero-scrim-from) 0%, var(--color-hero-scrim-mid) 46%, var(--color-hero-scrim-to) 100%)',
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-[1240px]">
        {/* Sized so the hero lands around 83vh at 1440x900. At a full 100vh there is no hint that
            anything follows and the section below never peeks above the fold. */}
        <div className="px-6 py-20 md:px-12 md:py-28">
          <h1 className="h-display max-w-[13ch] text-white">Before funds move, prove the change.</h1>

          <p className="mt-8 max-w-[56ch] text-[18px] leading-[1.6] text-[var(--color-hero-ink)]">
            Qeltrun is a vendor change fraud firewall for treasuries. Three reviewers each seal a
            private approval inside an iExec Nox enclave, the contract adds them up without seeing
            them, and only the verdict becomes public.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/app"
              className="rounded-md bg-[var(--color-hero-accent)] px-6 py-3.5 text-[15px] font-semibold text-black transition-colors hover:bg-[var(--color-hero-accent-hover)]"
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
        </div>
      </div>
    </section>
  );
}


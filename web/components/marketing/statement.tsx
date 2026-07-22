/**
 * A full width statement band, carrying one line and a photograph.
 *
 * Two jobs. It gives the page a change of pace between two dense reading sections, and it states
 * the thing the whole product argues in a single sentence a reader will remember.
 *
 * Full bleed like the hero, since a dark band inside the railed gutters reads as a white frame
 * around a dark box.
 */
export function Statement({
  image,
  children,
  attribution,
}: {
  image: string;
  children: React.ReactNode;
  attribution?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-[var(--color-hero-bg)]">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${image})` }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, var(--color-hero-scrim-from) 0%, var(--color-hero-scrim-mid) 52%, var(--color-hero-scrim-to) 100%)',
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-[1240px] px-6 py-20 md:px-12 md:py-28">
        <p className="max-w-[24ch] text-[clamp(26px,3.4vw,44px)] font-semibold leading-[1.15] tracking-[-0.02em] text-white">
          {children}
        </p>
        {attribution !== undefined && (
          <p className="mt-6 text-[13px] text-[var(--color-hero-dim)]">{attribution}</p>
        )}
      </div>
    </section>
  );
}

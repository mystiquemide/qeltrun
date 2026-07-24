'use client';

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';

/**
 * The portal behind the headline.
 *
 * A sealed verification chamber, not a wormhole: concentric rings at different idle rotation
 * speeds, a soft radial fog, a handful of fine particles drifting in orbit, and a couple of faint
 * light streaks. Idle motion is pure CSS (`@keyframes`, GPU transforms only) so it costs nothing
 * in JS and never needs a frame loop. The only things driven from React are the two effects that
 * genuinely need real input: cursor parallax and scroll progress.
 *
 * On scroll, the whole graphic scales up and a dark vignette rises over it, timed to the Hero
 * section's own height (roughly 80-100vh) rather than a separate pinned sequence - the portal
 * "fills the viewport" because Hero itself already nearly does, and the darkness completing right
 * as Hero scrolls out of view reads as passing through it into whatever comes next. No scroll
 * hijacking, no pinning: this is a plain transform bound to native scroll position, so scrolling
 * itself is never touched.
 */
export function HeroPortal({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const prefersReducedMotion = useReducedMotion();
  const [coarsePointer, setCoarsePointer] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setCoarsePointer(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setCoarsePointer(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Cursor parallax: a plain mousemove listener writing CSS custom properties, not React state,
  // so a moving pointer never triggers a re-render. Desktop only - the spec asks for it disabled
  // on touch, and there is no cursor to track there anyway.
  useEffect(() => {
    if (coarsePointer || prefersReducedMotion === true) return;
    const el = rootRef.current;
    if (el === null) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty('--portal-px', px.toFixed(3));
      el.style.setProperty('--portal-py', py.toFixed(3));
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [coarsePointer, prefersReducedMotion]);

  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end start'] });
  const reduced = prefersReducedMotion === true;

  // Reduced motion: hold everything at its resting value. useTransform still needs to be called
  // (hooks cannot be conditional), so the interpolation ranges just collapse to a constant.
  const scale = useTransform(scrollYProgress, [0, 1], reduced ? [1, 1] : [1, coarsePointer ? 2.1 : 3.2]);
  const vignette = useTransform(scrollYProgress, [0, 0.7, 1], reduced ? [0, 0, 0] : [0, 0.55, 1]);
  const drift = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [0, -40]);

  const ringCount = coarsePointer ? 3 : 5;
  const particleCount = reduced ? 0 : coarsePointer ? 6 : 16;

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      aria-hidden
      style={{ ['--portal-px' as string]: '0', ['--portal-py' as string]: '0' }}
    >
      {/* scale/drift already collapse to constants (1 / 0) when reduced - their useTransform
          ranges do, so there is no need to swap the style prop out separately. */}
      <motion.div
        style={{ scale, y: drift }}
        className="relative flex h-[70vmin] w-[70vmin] max-h-[640px] max-w-[640px] items-center justify-center"
      >
        {/* The backing disk. Rings drawn straight onto the photograph disappeared into it - thin
            low-opacity strokes cannot compete with a busy, high-contrast image behind them. This
            gives the whole portal its own darkened ground first, the way a real sealed chamber
            would read as a recess in the wall rather than lines floating in front of a window. */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(5,7,12,0.85) 0%, rgba(8,11,18,0.72) 46%, rgba(10,14,22,0.32) 72%, rgba(10,14,22,0) 100%)',
          }}
        />

        {/* Fog: a soft off-white core over the disk. This is the only "glow" in the piece, and it
            is desaturated on purpose - a bright core here is what tips a sealed chamber into a
            sci-fi wormhole. */}
        <div
          className="portal-anim absolute inset-[6%] rounded-full opacity-80 [animation:portal-breathe_9s_ease-in-out_infinite]"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(196,206,224,0.22) 0%, rgba(196,206,224,0.08) 34%, rgba(20,28,46,0) 62%)',
            filter: 'blur(6px)',
          }}
        />

        <PortalRings count={ringCount} />

        {particleCount > 0 && <PortalParticles count={particleCount} />}

        {/* Two faint streaks, not four - restraint is the whole brief. */}
        {!reduced && (
          <>
            <div className="absolute inset-[10%] rounded-full opacity-[0.22] [animation:portal-spin-cw_46s_linear_infinite]">
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[var(--color-hero-ink)] to-transparent" />
            </div>
            <div className="absolute inset-[16%] rounded-full opacity-[0.16] [animation:portal-spin-ccw_63s_linear_infinite]">
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[var(--color-accent)] to-transparent" />
            </div>
          </>
        )}

        {/* The sealed centre. Not pure black - a hair off the hero background so it reads as
            depth, a chamber behind the surface, rather than a cut hole in the page. */}
        <div
          className="portal-anim absolute inset-[38%] rounded-full [animation:portal-breathe_9s_ease-in-out_infinite]"
          style={{
            background: 'radial-gradient(circle at 42% 38%, #1b2438 0%, #0a0e18 60%, #05070c 100%)',
            boxShadow: 'inset 0 0 40px 10px rgba(0,0,0,0.6)',
          }}
        />
      </motion.div>

      {/* The vignette that completes the "pass through" feeling as Hero scrolls away. Sits above
          the portal graphic but still behind the text (see hero.tsx's z-index order). */}
      <motion.div
        className="absolute inset-0"
        style={{
          opacity: reduced ? 0 : vignette,
          background: 'radial-gradient(circle at 30% 42%, rgba(5,7,12,0.92) 0%, rgba(5,7,12,0.65) 55%, rgba(5,7,12,0) 78%)',
        }}
      />
    </div>
  );
}

function PortalRings({ count }: { count: number }) {
  // Each ring a hair smaller and a hair slower than the last, alternating spin direction - the
  // asymmetry is what reads as depth rather than one flat spinning wheel. Radii and durations are
  // deliberately uneven numbers so no two rings ever line up again after they drift apart.
  //
  // A plain circular border is rotationally symmetric, so spinning one does nothing visible.
  // `dash` breaks that symmetry with a dash-and-gap pattern instead, which is also what makes the
  // motion read as mechanical - a graduated dial, not a decorative spinner.
  const rings = [
    { inset: '2%', duration: 88, dir: 'cw', opacity: 0.42, dash: '1 14' },
    { inset: '12%', duration: 61, dir: 'ccw', opacity: 0.52, dash: '2 10' },
    { inset: '22%', duration: 74, dir: 'cw', opacity: 0.46, dash: '38 6' },
    { inset: '30%', duration: 45, dir: 'ccw', opacity: 0.58, dash: '1 8' },
    { inset: '34%', duration: 97, dir: 'cw', opacity: 0.68, dash: '3 3' },
  ].slice(0, count);

  return (
    <>
      {rings.map((r, i) => (
        // Outer div carries the parallax offset (a plain, non-animated transform); the SVG inside
        // carries the rotation. Both target `transform`, so they have to live on different
        // elements - an animation fully owns the property it animates on whichever element it is
        // applied to, and would silently discard a static transform set beside it.
        <div
          key={i}
          className="absolute"
          style={{
            inset: r.inset,
            transform: 'translate(calc(var(--portal-px, 0) * 6px), calc(var(--portal-py, 0) * 6px))',
          }}
        >
          <svg
            viewBox="0 0 100 100"
            className="portal-anim h-full w-full"
            style={{ animation: `portal-spin-${r.dir} ${r.duration}s linear infinite` }}
          >
            <circle
              cx="50"
              cy="50"
              r="49"
              fill="none"
              stroke="var(--color-hero-ink)"
              strokeWidth="1"
              strokeDasharray={r.dash}
              opacity={r.opacity}
            />
          </svg>
        </div>
      ))}
    </>
  );
}

function PortalParticles({ count }: { count: number }) {
  // Deterministic pseudo-random placement (a fixed seed pattern, not Math.random) so server and
  // client render the same markup - real randomness here would be a hydration mismatch waiting
  // to happen.
  const particles = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 360 + (i % 3) * 11;
    const radius = 20 + ((i * 37) % 34);
    const duration = 14 + ((i * 7) % 12);
    const size = i % 4 === 0 ? 3.5 : 2.25;
    return { angle, radius, duration, size, delay: (i * 0.6) % duration };
  });

  return (
    <>
      {particles.map((p, i) => (
        <div
          key={i}
          className="portal-anim absolute left-1/2 top-1/2 rounded-full bg-[var(--color-hero-ink)]"
          style={{
            width: p.size,
            height: p.size,
            opacity: 0.5,
            transform: `rotate(${p.angle}deg) translate(${p.radius}%, 0)`,
            animation: `portal-spin-cw ${p.duration}s linear infinite`,
            animationDelay: `-${p.delay}s`,
          }}
        />
      ))}
    </>
  );
}

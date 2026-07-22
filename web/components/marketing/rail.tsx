import type { ReactNode } from 'react';

/**
 * The bounded rail.
 *
 * Content lives inside 1240px with hairline edges; the space either side carries a diagonal
 * hatch. This is the single structural move the whole marketing surface rests on, and it is what
 * gives the page the feel of an engineering drawing.
 *
 * The hatch is an inline SVG data URI, so it costs no request and scales at any width.
 */
export function Rail({
  children,
  band = false,
  className = '',
  id,
}: {
  children: ReactNode;
  /// Tints the section, used to separate adjacent sections without drawing a box around either.
  band?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`hatch ${band ? 'bg-[var(--color-band)]' : ''}`}>
      <div
        className={`rail ${band ? 'bg-[var(--color-band)]' : 'bg-[var(--color-canvas)]'} ${className}`}
      >
        {children}
      </div>
    </section>
  );
}

/// Standard horizontal padding inside the rail. Kept in one place so sections cannot drift.
export function RailInner({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-6 md:px-12 ${className}`}>{children}</div>;
}

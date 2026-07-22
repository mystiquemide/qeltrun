import { ImageResponse } from 'next/og';

/**
 * The browser tab carries the same mark as the landing page nav.
 *
 * Three separate signals on the left resolving into one solid verdict on the right, which is the
 * product. The geometry mirrors `Mark` in `components/marketing/nav.tsx`, scaled from its 20px
 * viewBox to 32px and thickened a little, because shapes that read fine at 20px in a nav close up
 * into mush at favicon size.
 *
 * The previous icon was three equal vertical bars in the old blue-grey palette. It matched neither
 * the mark nor the console, so the tab showed a different product from the one behind the link.
 *
 * Satori cannot read CSS variables, so the console palette is inlined. Keep in step with the
 * tokens in `globals.css`.
 */
export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

const INK = '#ddffdc';
const PHOSPHOR = '#4ade80';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#000000',
          borderRadius: 6,
        }}
      >
        {/* The three sealed signals. */}
        {[3.5, 12.5, 21.5].map((top) => (
          <div
            key={top}
            style={{
              position: 'absolute',
              left: 4,
              top,
              width: 7,
              height: 7,
              borderRadius: 1.5,
              background: INK,
            }}
          />
        ))}

        {/* The single verdict they resolve into. */}
        <div
          style={{
            position: 'absolute',
            left: 19,
            top: 3.5,
            width: 9,
            height: 25,
            borderRadius: 2,
            background: PHOSPHOR,
          }}
        />
      </div>
    ),
    size,
  );
}

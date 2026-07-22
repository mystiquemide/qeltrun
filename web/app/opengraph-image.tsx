import { ImageResponse } from 'next/og';

/// Generated rather than a checked-in PNG, so the card cannot drift from the product copy and
/// there is no binary asset to keep in sync with the palette in `globals.css`.
export const runtime = 'edge';
export const alt = 'Qeltrun: Before funds move, prove the change';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          /* Satori cannot read CSS variables, so the console palette is inlined here. These must
             be kept in step with the console tokens in `globals.css`. */
          background: '#000000',
          color: '#ddffdc',
          padding: '72px 80px',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: '#ff5555' }} />
          <div style={{ fontSize: 22, letterSpacing: 4, color: '#7d9a7e', textTransform: 'uppercase' }}>
            Payout gate
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: -2 }}>Qeltrun</div>
          <div style={{ fontSize: 40, color: '#ddffdc' }}>Before funds move, prove the change.</div>
          <div style={{ fontSize: 26, color: '#7d9a7e', maxWidth: 940, lineHeight: 1.4 }}>
            A vendor payment destination changes only when an iExec Nox TEE-sealed approval proves
            it should. Nothing else opens the gate.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 24 }}>
          <div style={{ color: '#ff5555' }}>BLOCKED</div>
          <div style={{ color: '#4d6650' }}>→</div>
          <div style={{ color: '#4ade80' }}>NOX SEALED</div>
          <div style={{ color: '#4d6650' }}>→</div>
          <div style={{ color: '#4ade80' }}>ALLOWED</div>
        </div>
      </div>
    ),
    size,
  );
}

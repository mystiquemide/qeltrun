import { ImageResponse } from 'next/og';

/// A shut gate: the mark for a firewall whose default answer is no.
export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#080a0d',
          borderRadius: 6,
        }}
      >
        <div style={{ display: 'flex', gap: 3 }}>
          <div style={{ width: 5, height: 18, background: '#3ddc97', borderRadius: 1 }} />
          <div style={{ width: 5, height: 18, background: '#5e6a78', borderRadius: 1 }} />
          <div style={{ width: 5, height: 18, background: '#f25f5c', borderRadius: 1 }} />
        </div>
      </div>
    ),
    size,
  );
}

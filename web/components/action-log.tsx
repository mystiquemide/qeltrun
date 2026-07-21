'use client';

import { useEffect, useRef } from 'react';

export type LogTone = 'info' | 'blocked' | 'allowed' | 'nox' | 'error';

export type LogEntry = {
  id: number;
  at: string;
  text: string;
  tone: LogTone;
  href?: string;
};

const TONE: Record<LogTone, string> = {
  info: 'var(--color-ink-dim)',
  blocked: 'var(--color-blocked)',
  allowed: 'var(--color-approved)',
  nox: 'var(--color-nox)',
  error: 'var(--color-warning)',
};

export function ActionLog({ entries }: { entries: LogEntry[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <p className="ledger text-[12px] text-[var(--color-ink-muted)]">
        Waiting for the first action…
      </p>
    );
  }

  return (
    <div className="ledger max-h-[220px] space-y-1 overflow-y-auto text-[12px] leading-relaxed">
      {entries.map((entry) => (
        <div key={entry.id} className="flex gap-2">
          <span className="shrink-0 text-[var(--color-ink-muted)]">[{entry.at}]</span>
          <span style={{ color: TONE[entry.tone] }} className="min-w-0 break-words">
            {entry.text}
            {entry.href !== undefined && (
              <>
                {' '}
                <a
                  href={entry.href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 opacity-70 hover:opacity-100"
                >
                  view
                </a>
              </>
            )}
          </span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

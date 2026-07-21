'use client';

export type RailStatus = 'done' | 'active' | 'pending' | 'blocked';

export type RailStep = {
  label: string;
  detail: string;
  status: RailStatus;
};

const DOT: Record<RailStatus, string> = {
  done: 'var(--color-approved)',
  active: 'var(--color-nox)',
  blocked: 'var(--color-blocked)',
  pending: 'var(--color-panel-border)',
};

export function StateRail({ steps }: { steps: RailStep[] }) {
  return (
    <ol className="relative">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <li key={step.label} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className="absolute top-3 bottom-0 left-[3.5px] w-px"
                style={{
                  background: step.status === 'done' ? 'var(--color-approved)' : 'var(--color-divider)',
                }}
              />
            )}
            <span
              aria-hidden
              className={`relative mt-1 h-2 w-2 shrink-0 rounded-full ${step.status === 'active' ? 'pulse-live' : ''}`}
              style={{ background: DOT[step.status] }}
            />
            <div className="min-w-0">
              <p
                className="text-[13px] leading-snug"
                style={{
                  color:
                    step.status === 'pending' ? 'var(--color-ink-muted)' : 'var(--color-ink)',
                }}
              >
                {step.label}
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-[var(--color-ink-muted)]">
                {step.detail}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

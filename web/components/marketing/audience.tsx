import { Rail } from './rail';

/**
 * Who this is for, and what the failure looks like when it happens to them.
 *
 * The landing page previously answered engineering questions and none of the questions a person
 * responsible for paying vendors actually arrives with. This section is the first of those.
 *
 * The scenario is deliberately mundane. Vendor change fraud does not look like a hack, it looks
 * like a normal invoice with one field different, which is exactly why it works.
 */
const AUDIENCES = [
  {
    who: 'DAO treasuries',
    pain: 'Contributors and service providers get paid on a schedule, and a signer approving the twentieth payout of the week is not re-reading the address.',
  },
  {
    who: 'Onchain finance teams',
    pain: 'Payment runs are batched and routine. The control that catches a changed destination is usually one person remembering to look.',
  },
  {
    who: 'Protocol operations',
    pain: 'Audits, infrastructure and vendors get paid from a shared Safe, and the people approving are rarely the people who onboarded the vendor.',
  },
];

export function Audience() {
  return (
    <Rail band>
      <div className="px-6 py-16 md:px-12 md:py-24">
        <h2 className="h-section max-w-[24ch] text-[var(--color-ink-900)]">
          The invoice looks completely normal.
        </h2>
        <p className="mt-5 max-w-[64ch] text-[16px] leading-[1.6] text-[var(--color-ink-600)]">
          Same vendor, same amount, same template, same person in the email thread. One line is
          different, the payment address. Nothing about it triggers suspicion, and the money is
          gone the moment somebody approves it. Treasuries lose more this way than to any exploit,
          and every control that failed was a person meaning to check.
        </p>

        <div className="mt-14 grid gap-px border-y border-[var(--color-rule)] md:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.who} className="py-8 md:pr-8 md:pl-8 md:first:pl-0 md:last:pr-0">
              <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--color-ink-900)]">
                {a.who}
              </h3>
              <p className="mt-3 text-[14.5px] leading-[1.6] text-[var(--color-ink-600)]">
                {a.pain}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Rail>
  );
}

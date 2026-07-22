import { Rail } from './rail';

/**
 * Three properties of the contract, stated as facts a reader can go and check.
 *
 * No icons. A row of three generic glyphs beside three headings is the most templated shape in
 * SaaS marketing, and none of these properties has an honest icon anyway. Thin vertical rules do
 * the separating, which is the reference's own device.
 *
 * Every claim here is checkable against `contracts/QeltrunPayoutFirewallV2.sol`. In particular
 * the middle one avoids claiming "no owner, no admin key". v2 has an owner, the treasury Safe,
 * so that claim would be false. The true version is narrower and more interesting: the owner can
 * stop the system and can never approve through it.
 */
const CAPABILITIES = [
  {
    title: 'Refusing is the default',
    body: 'The gate answers one question, may this address be paid. It says no unless the address is already the one this vendor is cleared for. A missed step, a half finished approval or an unknown destination all end the same way.',
  },
  {
    title: 'No one can wave a payment through',
    body: 'Whoever administers the system can halt it, add vendors and replace reviewers. None of that lets them approve a destination. Moving a payout address takes three sealed positions and nothing else.',
  },
  {
    title: 'Reviewers cannot see each other',
    body: 'Each position is encrypted before it leaves the reviewer. The contract counts them without being able to read them, so nobody waits to see how the other two voted, and no one can be leaned on afterwards for how they went.',
  },
];

export function Capabilities() {
  return (
    <Rail>
      <div className="grid divide-y divide-[var(--color-rule)] md:grid-cols-3 md:divide-x md:divide-y-0">
        {CAPABILITIES.map((c) => (
          <div key={c.title} className="px-6 py-10 md:px-8 md:py-12">
            <h2 className="text-[19px] font-semibold leading-snug tracking-[-0.01em] text-[var(--color-ink-900)]">
              {c.title}
            </h2>
            <p className="mt-3 text-[15px] leading-[1.6] text-[var(--color-ink-600)]">{c.body}</p>
          </div>
        ))}
      </div>
    </Rail>
  );
}

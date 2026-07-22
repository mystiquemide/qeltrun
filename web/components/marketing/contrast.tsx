import { Rail } from './rail';

/**
 * The comparison the product exists to make, as two equal halves.
 *
 * Deliberately fair to multisigs. A multisig is good at the job it has, and claiming otherwise
 * would be the kind of overreach this page is trying to avoid. The claim here is narrower: it
 * answers a different question from the one that matters when an invoice is fraudulent.
 *
 * No labels above the headings. The dark half against the blue half already says which is which,
 * and a small uppercase tag over each one would add nothing but a templated tell.
 */
export function Contrast() {
  return (
    <Rail>
      <div className="grid md:grid-cols-2">
        <div className="bg-[var(--color-hero-bg)] px-6 py-14 md:px-10 md:py-20">
          <h2 className="max-w-[16ch] text-[clamp(26px,2.6vw,34px)] font-semibold leading-[1.15] tracking-[-0.02em] text-white">
            A multisig proves who signed.
          </h2>
          <p className="mt-5 max-w-[46ch] text-[15.5px] leading-[1.65] text-[var(--color-hero-ink)]">
            Three of five keys approved the transaction, and the record shows exactly which keys.
            It says nothing about whether anyone opened the invoice, compared the bank details
            against the last one, or noticed the sender domain was registered nine days ago.
          </p>
        </div>

        <div className="bg-[var(--color-accent)] px-6 py-14 md:px-10 md:py-20">
          <h2 className="max-w-[16ch] text-[clamp(26px,2.6vw,34px)] font-semibold leading-[1.15] tracking-[-0.02em] text-white">
            Qeltrun proves what they approved.
          </h2>
          <p className="mt-5 max-w-[46ch] text-[15.5px] leading-[1.65] text-white/85">
            Three named reviewers each seal a private yes or no against one specific destination
            change. The contract adds them up inside the enclave and publishes a single verdict.
            The payout wallet moves only when that verdict says yes.
          </p>
        </div>
      </div>
    </Rail>
  );
}

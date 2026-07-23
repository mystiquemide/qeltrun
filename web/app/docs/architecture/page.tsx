import type { Metadata } from 'next';

import { C, Callout, Code, DocHeader, H2, P, Related, UL } from '@/components/docs/prose';

export const metadata: Metadata = {
  title: 'Architecture: Qeltrun docs',
  description: 'The parts of Qeltrun and how a payout request moves through them.',
  alternates: { canonical: '/docs/architecture' },
};

export default function Page() {
  return (
    <article>
      <DocHeader
        kind="Explanation"
        title="Architecture"
        intro="The parts of Qeltrun, how they fit, and the path a payout request takes from open to settled."
      />

      <H2 id="parts">The parts</H2>
      <UL>
        <li>
          <C>QeltrunPayoutFirewallV2</C>: the gate. It holds vendor records, request state, and the
          rule that a payout wallet moves only after a sealed verdict.
        </li>
        <li>
          <C>NoxCompute</C>: the iExec Nox contract that seals reviewer signals, computes the
          aggregate inside the enclave, and produces the decryption proof.
        </li>
        <li>
          <C>QeltrunSafePayoutModule</C>: the Safe module that checks the firewall before the Safe
          releases a payment.
        </li>
        <li>
          The shared TypeScript in <C>src/</C>: the request-id derivation and the Nox providers,
          imported by both the scripts and the web app.
        </li>
        <li>The Next.js app: the marketing pages, the proof page, and the console.</li>
      </UL>

      <H2 id="flow">Request flow</H2>
      <P>A destination change moves through four states:</P>
      <Code>{`open       openChangeRequest      records intent, moves nothing
collecting submitPrivateSignal x3  three sealed positions
sealed     aggregate verdict       computed inside the enclave
settled    settleApproval          verdict revealed, gate decides`}</Code>
      <P>
        The payout wallet moves only on the transition to settled, and only if the verdict is yes.
        Every other state leaves the gate shut.
      </P>

      <H2 id="fail-closed">Fail closed</H2>
      <P>
        The default answer is no. There is no path to the payout wallet that skips the sealed
        verdict. If the enclave is unreachable, if a proof is missing, or if the firewall is paused,
        the gate stays shut. A failure never opens a payment.
      </P>
      <Callout tone="tip" title="One writer to the payout wallet">
        Only <C>settleApproval</C> with a valid verdict proof can move the payout wallet. No admin
        function and no other path can.
      </Callout>

      <H2 id="ui-parity">UI and contract parity</H2>
      <P>
        The console imports the same request-id derivation and gate logic the contract tests use. It
        does not reimplement them. This keeps the interface from drifting away from the contract it
        is a client for. The request id and the sealed handles are both read from chain events, so
        every reviewer and a wallet-free visitor resolve the same state.
      </P>

      <Related
        links={[
          { label: 'Confidential approval', href: '/docs/confidential-model' },
          { label: 'Firewall contract', href: '/docs/contracts' },
          { label: 'Proof', href: '/proof' },
        ]}
      />
    </article>
  );
}

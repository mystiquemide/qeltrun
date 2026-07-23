import type { Metadata } from 'next';

import { C, Callout, Code, DocHeader, H2, OL, P, Related } from '@/components/docs/prose';

export const metadata: Metadata = {
  title: 'Three-reviewer flow: Qeltrun docs',
  description: 'Open a change request, seal three private positions, and settle the sealed verdict.',
  alternates: { canonical: '/docs/reviewer-flow' },
};

export default function Page() {
  return (
    <article>
      <DocHeader
        kind="How-to"
        title="Run the three-reviewer flow"
        intro="Move a vendor payout destination through the full lifecycle: open, three sealed positions, and settlement."
      />

      <P>
        A vendor has three reviewer seats: an approver, a treasury reviewer, and a risk reviewer.
        Each seals a private yes or no. The contract adds the sealed positions inside the enclave
        and makes only the combined verdict decryptable. The payout address moves only if that
        verdict is yes.
      </P>

      <H2 id="open">1. Open a request</H2>
      <P>Anyone may open a request. It records intent and moves no funds.</P>
      <Code>openChangeRequest(vendorId, proposedWallet, nonce)</Code>
      <P>
        The request id is derived on chain from the vendor, both wallets, the caller, the nonce, and
        the approver epoch. It cannot be chosen by the caller or replayed onto another deployment.
      </P>

      <H2 id="seal">2. Seal three positions</H2>
      <P>
        Each reviewer encrypts a signal to the contract and submits it. Only the three seats can
        submit, and each can submit once.
      </P>
      <Code>submitPrivateSignal(requestId, encryptedSignal, handleProof)</Code>
      <OL>
        <li>The reviewer seals a signal through the gateway. Nobody can read the handle.</li>
        <li>
          The reviewer submits the handle to the contract. The contract binds the handle and counts
          the position.
        </li>
        <li>After the third position, the contract seals the aggregate verdict.</li>
      </OL>
      <Callout tone="tip" title="No reviewer follows the room">
        A reviewer can see that a colleague has sealed, but not which way they sealed. The positions
        stay private until the verdict settles.
      </Callout>

      <H2 id="settle">3. Settle the verdict</H2>
      <P>
        Settlement is permissionless. The caller reads the verdict handle off chain, decrypts it
        through the gateway, and submits the decryption proof:
      </P>
      <Code>settleApproval(requestId, decryptionProof)</Code>
      <P>
        If the verdict is yes, the contract moves the payout address. If it is no, the address does
        not move. Either way the request is settled and cannot settle again.
      </P>

      <H2 id="halt">Halting the firewall</H2>
      <P>
        The owner can pause the firewall with <C>pause()</C>. While paused, opening and settling are
        both refused on chain. A pause cannot approve anything; it can only stop the system.
      </P>

      <Related
        links={[
          { label: 'Confidential approval', href: '/docs/confidential-model' },
          { label: 'Firewall contract', href: '/docs/contracts' },
          { label: 'Quickstart', href: '/docs/quickstart' },
        ]}
      />
    </article>
  );
}

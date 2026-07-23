import type { Metadata } from 'next';

import { C, Callout, Code, DocHeader, H2, P, Related } from '@/components/docs/prose';

export const metadata: Metadata = {
  title: 'Confidential approval: Qeltrun docs',
  description: 'How three private reviewer positions become one public verdict inside an iExec Nox enclave.',
  alternates: { canonical: '/docs/confidential-model' },
};

export default function Page() {
  return (
    <article>
      <DocHeader
        kind="Explanation"
        title="Confidential approval"
        intro="How three private reviewer positions become one public verdict, without any reviewer seeing another's vote and without the contract seeing any of them."
      />

      <H2 id="what-nox-is">What Nox is</H2>
      <P>
        iExec Nox is confidential computing built on a trusted execution environment, a TEE. Code
        runs inside an enclave that keeps its inputs and its working state hidden, even from the
        machine it runs on. Nox is not fully homomorphic encryption and it is not a zero-knowledge
        proof system. The confidentiality comes from the hardware enclave.
      </P>
      <Callout tone="note" title="What Qeltrun trusts">
        Qeltrun's confidentiality rests on the Nox enclave. The approval logic itself is on chain
        and public. The enclave hides the reviewer positions; it does not decide the outcome on its
        own.
      </Callout>

      <H2 id="handles">Sealed handles</H2>
      <P>
        A reviewer does not send a plaintext vote. The reviewer encrypts a small integer, an{' '}
        <C>euint16</C>, to the contract through the gateway. The result is a handle: a reference to
        a value nobody can read, including the contract that holds it.
      </P>
      <P>
        The contract binds each handle to the request and counts the position. It never sees the
        value behind the handle.
      </P>

      <H2 id="aggregate">The aggregate</H2>
      <P>
        After three positions, the contract asks NoxCompute to add the three sealed values and
        decide the verdict, all inside the enclave. The individual positions stay hidden. Only the
        combined verdict is marked decryptable.
      </P>

      <H2 id="round-trip">The reveal round trip</H2>
      <P>
        The settlement step is the interesting one. An untrusted caller carries the enclave's
        decision on chain without being trusted, because the decision arrives with a proof:
      </P>
      <Code>{`encryptInput      # reviewer seals a signal off chain
fromExternal      # contract accepts the sealed handle
allowPublicDecryption  # contract marks the verdict decryptable
publicDecrypt     # caller decrypts the verdict off chain, gets a proof
Nox.publicDecrypt # contract verifies the proof on chain and settles`}</Code>
      <P>
        The value alone is just a claim from the gateway. The decryption proof is what makes the
        reveal trustworthy on chain. This is the primitive the whole settlement rests on.
      </P>

      <H2 id="why">Why this beats a multisig</H2>
      <P>
        A multisig proves who signed. It says nothing about whether anyone checked the destination.
        Qeltrun binds the approval to one specific destination change and keeps each reviewer's
        position private until the verdict settles, so no reviewer can wait and follow the room.
      </P>

      <Related
        links={[
          { label: 'Run the three-reviewer flow', href: '/docs/reviewer-flow' },
          { label: 'Firewall contract', href: '/docs/contracts' },
          { label: 'Architecture', href: '/docs/architecture' },
        ]}
      />
    </article>
  );
}

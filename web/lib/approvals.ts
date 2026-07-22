import { decryptWhenIndexed, type DecryptWhenIndexedOptions } from '@qeltrun/nox-decrypt';

import type { Address, Hex } from './config';
import { isLocalChain } from './config';

export type SealedSignal = {
  handle: Hex;
  handleProof: Hex;
  owner: Address;
  applicationContract: Address;
};

export type RevealedVerdict = {
  handle: Hex;
  value: boolean;
  decryptionProof: Hex;
};

/**
 * Where a reviewer position is sealed and where the verdict is revealed.
 *
 * On Sepolia this is iExec's Nox gateway through `@iexec-nox/handle` with the connected wallet.
 * On the local chain it is the route handler holding the key the local NoxCompute was initialized
 * with. Both emit the same proof bytes and the contract verifies them with the same protocol
 * code, so the console does not branch beyond choosing a transport.
 */
export type SignalTransport = {
  readonly label: string;
  /**
   * Seal one reviewer's position as an `euint16`.
   *
   * `applicationContract` must be the firewall, because NoxCompute compares it against
   * `msg.sender`. The wallet that seals must also be the wallet that sends the transaction, since
   * the contract passes its own `msg.sender` as the proof owner. A relayer submitting on a
   * reviewer's behalf silently does not work.
   */
  sealSignal(input: {
    reviewer: Address;
    applicationContract: Address;
    approve: boolean;
  }): Promise<SealedSignal>;
  /**
   * Decrypt the aggregate verdict.
   *
   * `signalHandles` is unused on Sepolia, where the gateway holds the ciphertext. The local
   * gateway needs them because it computes the verdict from the three plaintexts it minted, the
   * same way the Solidity test harness does.
   */
  revealVerdict(
    verdictHandle: Hex,
    signalHandles: readonly Hex[],
    options?: DecryptWhenIndexedOptions,
  ): Promise<RevealedVerdict>;
};

async function callLocalGateway<T>(body: unknown): Promise<T> {
  const response = await fetch('/api/local-gateway', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `LOCAL_GATEWAY_${response.status}`);
  }
  return payload;
}

const localTransport: SignalTransport = {
  label: 'Local Nox gateway',
  sealSignal: ({ reviewer, applicationContract, approve }) =>
    callLocalGateway<SealedSignal>({
      action: 'sealSignal',
      reviewer,
      applicationContract,
      signal: approve ? 1 : 0,
    }),
  revealVerdict: (verdictHandle, signalHandles) =>
    callLocalGateway<RevealedVerdict>({
      action: 'revealVerdict',
      verdictHandle,
      signalHandles: [...signalHandles],
    }),
};

/// `@iexec-nox/handle` pulls in `ethers` at import time, so it is loaded lazily. Somebody on the
/// local chain should never pay for a dependency the local path does not use.
function noxTransport(walletClient: unknown): SignalTransport {
  let clientPromise: Promise<{
    encryptInput(
      value: number,
      solidityType: 'uint16',
      applicationContract: string,
    ): Promise<{ handle: string; handleProof: string }>;
    publicDecrypt(handle: string): Promise<{ value: unknown; decryptionProof: string }>;
  }> | null = null;

  const client = () => {
    clientPromise ??= import('@iexec-nox/handle').then((mod) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mod.createViemHandleClient(walletClient as any),
    ) as never;
    return clientPromise;
  };

  return {
    label: 'iExec Nox gateway',
    async sealSignal({ applicationContract, reviewer, approve }) {
      const { handle, handleProof } = await (await client()).encryptInput(
        approve ? 1 : 0,
        'uint16',
        applicationContract,
      );
      return {
        handle: handle as Hex,
        handleProof: handleProof as Hex,
        owner: reviewer,
        applicationContract,
      };
    },
    async revealVerdict(verdictHandle, _signalHandles, options) {
      // Two waits to survive here. The gateway resolves ACL from a subgraph, so it refuses a
      // handle that is already publicly decryptable on chain for about a minute after sealing,
      // and confidential arithmetic means the verdict exists before its value does. Both are
      // handled by the shared helper the scripts use.
      const c = await client();
      const { value, decryptionProof } = await decryptWhenIndexed(
        verdictHandle,
        (h) => c.publicDecrypt(h),
        options,
      );
      if (typeof value !== 'boolean') {
        throw new Error(`NOX_UNEXPECTED_PLAINTEXT_TYPE:${typeof value}`);
      }
      return { handle: verdictHandle, value, decryptionProof: decryptionProof as Hex };
    },
  };
}

export function signalTransportFor(
  chainId: number | undefined,
  walletClient: unknown,
): SignalTransport {
  return isLocalChain(chainId) ? localTransport : noxTransport(walletClient);
}

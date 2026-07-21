import type { Address, Hex } from './config';
import { isLocalChain } from './config';

export type SealedApproval = {
  handle: Hex;
  handleProof: Hex;
  owner: Address;
  applicationContract: Address;
};

export type RevealedApproval = {
  handle: Hex;
  value: boolean;
  decryptionProof: Hex;
};

/**
 * Where the approval bit is sealed and revealed.
 *
 * On Sepolia this is iExec's Nox gateway, reached through `@iexec-nox/handle` with the user's
 * connected wallet. On the local chain it is our own route handler holding the key the local
 * NoxCompute was initialized with. Both emit the same proof bytes, and the contract verifies
 * them with the same protocol code, so the UI does not branch beyond choosing a transport.
 */
export type ApprovalTransport = {
  readonly label: string;
  seal(input: {
    approver: Address;
    applicationContract: Address;
    approve: boolean;
  }): Promise<SealedApproval>;
  reveal(handle: Hex): Promise<RevealedApproval>;
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

const localTransport: ApprovalTransport = {
  label: 'Local Nox gateway',
  seal: (input) => callLocalGateway<SealedApproval>({ action: 'seal', ...input }),
  reveal: (handle) => callLocalGateway<RevealedApproval>({ action: 'reveal', handle }),
};

/// `@iexec-nox/handle` pulls in `ethers` at import time, so it is loaded lazily. A judge on the
/// local chain should never pay for a dependency the local path does not use.
function noxTransport(walletClient: unknown): ApprovalTransport {
  let clientPromise: Promise<{
    encryptInput(
      value: boolean,
      solidityType: 'bool',
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
    async seal({ applicationContract, approver, approve }) {
      // `applicationContract` must be the contract that will call `Nox.fromExternal`, because
      // NoxCompute compares it against `msg.sender`. It must also be sealed by the wallet that
      // sends the transaction, since the contract passes its own `msg.sender` as the owner.
      const { handle, handleProof } = await (await client()).encryptInput(
        approve,
        'bool',
        applicationContract,
      );
      return {
        handle: handle as Hex,
        handleProof: handleProof as Hex,
        owner: approver,
        applicationContract,
      };
    },
    async reveal(handle) {
      const { value, decryptionProof } = await (await client()).publicDecrypt(handle);
      if (typeof value !== 'boolean') {
        throw new Error(`NOX_UNEXPECTED_PLAINTEXT_TYPE:${typeof value}`);
      }
      return { handle, value, decryptionProof: decryptionProof as Hex };
    },
  };
}

export function approvalTransportFor(
  chainId: number | undefined,
  walletClient: unknown,
): ApprovalTransport {
  return isLocalChain(chainId) ? localTransport : noxTransport(walletClient);
}

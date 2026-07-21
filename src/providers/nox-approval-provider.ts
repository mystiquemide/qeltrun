import { createViemHandleClient } from '@iexec-nox/handle';

import { isSameAddress } from '../domain/index.js';
import type {
  ApprovalProvider,
  Hex,
  RevealedApproval,
  SealApprovalInput,
  SealedApproval,
} from '../domain/types.js';

type HandleClient = Awaited<ReturnType<typeof createViemHandleClient>>;
type ViemClient = Parameters<typeof createViemHandleClient>[0];

/// The real iExec Nox path.
///
/// Two protocol constraints drive this class and are worth stating plainly, because getting
/// either wrong produces an on-chain revert that is hard to read:
///
///   1. `applicationContract` must be the deployed `QeltrunPayoutFirewall`. NoxCompute checks
///      the app recorded in the proof against `msg.sender`, which is the firewall.
///   2. The wallet that seals must be the wallet that sends the `sealApproval` transaction.
///      NoxCompute checks the owner recorded in the proof against the firewall's `msg.sender`.
///
/// Both are enforced here so the failure surfaces in TypeScript with a readable message
/// rather than as `InvalidProof(..., "App mismatch")` from a Sepolia trace.
export class NoxApprovalProvider implements ApprovalProvider {
  readonly chainId: number;

  private readonly client: HandleClient;
  private readonly wallet: string;

  private constructor(client: HandleClient, chainId: number, wallet: string) {
    this.client = client;
    this.chainId = chainId;
    this.wallet = wallet;
  }

  /// Build a provider from a viem wallet client. Nox resolves its gateway, subgraph and
  /// NoxCompute address from the client's chain id, so Sepolia needs no extra configuration.
  static async fromViemWalletClient(walletClient: ViemClient): Promise<NoxApprovalProvider> {
    const client = await createViemHandleClient(walletClient);
    const chainId = (walletClient as { chain?: { id?: number } }).chain?.id;
    const account = (walletClient as { account?: { address?: string } }).account?.address;

    if (chainId === undefined) {
      throw new Error('NOX_PROVIDER_MISSING_CHAIN');
    }
    if (account === undefined) {
      throw new Error('NOX_PROVIDER_MISSING_ACCOUNT');
    }

    return new NoxApprovalProvider(client, chainId, account);
  }

  async sealApproval(input: SealApprovalInput): Promise<SealedApproval> {
    if (!isSameAddress(input.approver, this.wallet)) {
      throw new Error(`NOX_SEAL_WALLET_MISMATCH:${input.approver}:signer:${this.wallet}`);
    }

    const { handle, handleProof } = await this.client.encryptInput(
      input.approve,
      'bool',
      input.applicationContract,
    );

    return {
      handle: handle as Hex,
      handleProof: handleProof as Hex,
      owner: input.approver,
      applicationContract: input.applicationContract,
    };
  }

  async revealApproval(handle: Hex): Promise<RevealedApproval> {
    // Only succeeds once the firewall has called `Nox.allowPublicDecryption` on this handle,
    // which it does inside `sealApproval`.
    const { value, decryptionProof } = await this.client.publicDecrypt(handle);

    if (typeof value !== 'boolean') {
      throw new Error(`NOX_UNEXPECTED_PLAINTEXT_TYPE:${typeof value}`);
    }

    return { handle, value, decryptionProof: decryptionProof as Hex };
  }
}

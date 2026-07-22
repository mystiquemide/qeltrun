import { createViemHandleClient } from '@iexec-nox/handle';

import { decryptWhenIndexed, type DecryptWhenIndexedOptions } from './decrypt-when-indexed.js';
import type { Address, Hex } from '../domain/types.js';

type ViemClient = Parameters<typeof createViemHandleClient>[0];

export class NoxSignalProvider {
  private constructor(
    private readonly client: Awaited<ReturnType<typeof createViemHandleClient>>,
    readonly wallet: Address,
  ) {}

  static async fromViemWalletClient(walletClient: ViemClient): Promise<NoxSignalProvider> {
    const account = (walletClient as { account?: { address?: string } }).account?.address;
    if (account === undefined) throw new Error('NOX_PROVIDER_MISSING_ACCOUNT');
    return new NoxSignalProvider(
      await createViemHandleClient(walletClient),
      account as Address,
    );
  }

  async encryptSignal(value: bigint, applicationContract: Address): Promise<{
    handle: Hex;
    handleProof: Hex;
  }> {
    if (value < 0n || value > 65535n) throw new Error(`INVALID_UINT16_SIGNAL:${value}`);
    const encrypted = await this.client.encryptInput(value, 'uint16', applicationContract);
    return { handle: encrypted.handle as Hex, handleProof: encrypted.handleProof as Hex };
  }

  /// The verdict handle has two waits to survive, ACL indexing and confidential arithmetic.
  /// Both are handled by the shared helper, see `decrypt-when-indexed.ts`.
  async revealVerdict(
    handle: Hex,
    options?: DecryptWhenIndexedOptions,
  ): Promise<{ value: boolean; decryptionProof: Hex }> {
    const result = await decryptWhenIndexed(handle, (h) => this.client.publicDecrypt(h), options);

    if (typeof result.value !== 'boolean') {
      throw new Error(`NOX_UNEXPECTED_PLAINTEXT_TYPE:${typeof result.value}`);
    }

    return { value: result.value, decryptionProof: result.decryptionProof as Hex };
  }
}

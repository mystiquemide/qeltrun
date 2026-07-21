import { createViemHandleClient } from '@iexec-nox/handle';

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

  async revealVerdict(handle: Hex): Promise<{ value: boolean; decryptionProof: Hex }> {
    for (let attempt = 1; ; attempt++) {
      try {
        const result = await this.client.publicDecrypt(handle);
        if (typeof result.value !== 'boolean') {
          throw new Error(`NOX_UNEXPECTED_PLAINTEXT_TYPE:${typeof result.value}`);
        }
        return { value: result.value, decryptionProof: result.decryptionProof as Hex };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const retryable =
          message.includes('not publicly decryptable') || message.includes('not yet been computed');
        if (!retryable || attempt >= 24) throw error;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }
}

import type { Hex } from '../domain/types.js';

/**
 * The wait every public decryption has to survive, in one place.
 *
 * The gateway resolves ACL state from a subgraph rather than from the chain, so for a short
 * window after a sealing transaction confirms it still refuses a handle that is already
 * publicly decryptable on chain. Confidential arithmetic adds a second window: an aggregate
 * handle exists on chain before the enclave has finished computing its value.
 *
 * Observed on Sepolia, both clear within about a minute.
 *
 * This lived in three copies that disagreed: 8 attempts catching one error in the approval
 * provider, 24 catching both in the signal provider, and none at all in the browser, which is
 * why the dashboard failed where the scripts succeeded. Neither reading the code nor running
 * the local stack surfaces it, because the local gateway answers from memory with no indexer
 * in between. One copy, or they drift again.
 */

/// The gateway reports both waits as prose, so this matches on message text and is therefore
/// fragile: a reworded message turns a recoverable wait into a hard failure. Keeping it to one
/// list at least makes it one thing to fix.
const RETRYABLE_MESSAGES = [
  /// ACL not yet indexed from the sealing transaction.
  'not publicly decryptable',
  /// Handle exists, confidential arithmetic has not produced its value yet.
  'not yet been computed',
] as const;

export function isRetryableDecryptError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_MESSAGES.some((fragment) => message.includes(fragment));
}

export type DecryptWhenIndexedOptions = {
  attempts?: number;
  delayMs?: number;
  /// Called before each retry so a UI can say what it is waiting for rather than looking hung.
  onRetry?: (attempt: number, attempts: number) => void;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Runs `decrypt` until the gateway stops reporting a wait, or gives up loudly.
 *
 * Only the two waits above are retried. A genuine permission failure still throws on the first
 * attempt, so a handle that was never marked publicly decryptable fails fast instead of hanging
 * for two minutes.
 */
export async function decryptWhenIndexed<T>(
  handle: Hex,
  decrypt: (handle: Hex) => Promise<T>,
  { attempts = 24, delayMs = 5000, onRetry }: DecryptWhenIndexedOptions = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await decrypt(handle);
    } catch (error) {
      if (!isRetryableDecryptError(error)) throw error;

      if (attempt >= attempts) {
        const waited = Math.round((attempts * delayMs) / 1000);
        throw new Error(
          `NOX_HANDLE_NOT_INDEXED:${handle}: the gateway still reports this handle as ` +
            `unavailable after ${attempts} attempts over ${waited}s. Confirm the sealing ` +
            'transaction succeeded and that the contract called Nox.allowPublicDecryption.',
        );
      }

      onRetry?.(attempt, attempts);
      await sleep(delayMs);
    }
  }
}

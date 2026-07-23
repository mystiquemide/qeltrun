/**
 * One place to turn a thrown error into something worth reading.
 *
 * The console shows the real error text on purpose - this audience wants to see a revert reason,
 * not a laundered "something went wrong". But a raw wallet/RPC error line is still a dead end on
 * its own: it says what broke, never what to do about it. Every non-rejection error gets one
 * concrete next step appended, so nobody's left staring at `execution reverted: ...` with
 * nothing to try.
 */
export function friendlyError(error: unknown): { text: string; rejected: boolean } {
  const message = error instanceof Error ? error.message : String(error);
  const firstLine = message.split('\n')[0] ?? 'Action failed';

  if (/User rejected|user denied|4001/i.test(message)) {
    return { text: 'Cancelled in wallet.', rejected: true };
  }

  if (/insufficient funds/i.test(message)) {
    return { text: `${firstLine} This wallet needs more Sepolia ETH for gas.`, rejected: false };
  }

  return { text: `${firstLine} Try again, or check your wallet's network and balance.`, rejected: false };
}

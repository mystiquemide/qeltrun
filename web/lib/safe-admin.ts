'use client';

import type { WalletClient } from 'viem';
import { encodeFunctionData, keccak256, toBytes } from 'viem';
import { useReadContract } from 'wagmi';

import type { Address, Hex } from './config';

/// Just enough of the Safe ABI to read ownership. Registering the demo vendor, or any vendor,
/// only needs `getOwners` client-side - everything else about executing the transaction goes
/// through `@safe-global/protocol-kit`, which knows the rest of the Safe's interface already.
const SAFE_OWNERS_ABI = [
  {
    type: 'function',
    name: 'getOwners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
] as const;

/// Whether the connected wallet can act as this Safe - the same check `registerVendor` enforces
/// on chain, read client-side so the admin panel can stay hidden for everyone else rather than
/// rendering a form that can only ever revert for them.
export function useIsSafeOwner(safeAddress: Address | undefined, address: Address | undefined) {
  const { data: owners, isLoading } = useReadContract({
    address: safeAddress,
    abi: SAFE_OWNERS_ABI,
    functionName: 'getOwners',
    query: { enabled: safeAddress !== undefined },
  });

  const isOwner =
    address !== undefined &&
    (owners as readonly Address[] | undefined)?.some((o) => o.toLowerCase() === address.toLowerCase()) === true;

  return { isOwner, isLoading: safeAddress !== undefined && isLoading };
}

const FIREWALL_REGISTER_ABI = [
  {
    type: 'function',
    name: 'registerVendor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'vendorId', type: 'bytes32' },
      { name: 'payoutWallet', type: 'address' },
      { name: 'approver', type: 'address' },
      { name: 'treasuryReviewer', type: 'address' },
      { name: 'riskReviewer', type: 'address' },
    ],
    outputs: [],
  },
] as const;

export type RegisterVendorInput = {
  safeAddress: Address;
  firewallAddress: Address;
  vendorLabel: string;
  payoutWallet: Address;
  approver: Address;
  treasuryReviewer: Address;
  riskReviewer: Address;
  walletClient: WalletClient;
};

type SafeExecuted = {
  hash: string;
  transactionResponse: { wait(): Promise<{ status: string }> };
};
type SafeProtocol = {
  createTransaction(input: {
    transactions: Array<{ to: string; value: string; data: string }>;
    onlyCalls?: boolean;
  }): Promise<unknown>;
  executeTransaction(transaction: unknown): Promise<SafeExecuted>;
};
type SafeInitializer = {
  init(config: { provider: unknown; signer: string; safeAddress: string }): Promise<SafeProtocol>;
};

/// Registers a vendor as a Safe transaction, the browser-wallet equivalent of
/// `scripts/setup-demo-vendor-sepolia.ts`'s registration step. For the documented 1-of-1 Safe
/// this executes immediately once the connected owner signs; a Safe with more owners would need
/// the propose-then-collect-signatures flow instead, which this does not implement.
export async function registerVendorViaSafe(input: RegisterVendorInput): Promise<Hex> {
  const { safeAddress, firewallAddress, vendorLabel, payoutWallet, approver, treasuryReviewer, riskReviewer, walletClient } =
    input;
  if (walletClient.account === undefined) throw new Error('NO_ACCOUNT');

  // Lazy: the Safe SDK is only worth downloading for the one wallet that ever opens this panel.
  const module = await import('@safe-global/protocol-kit');
  const Safe = module.default as unknown as SafeInitializer;

  const protocolKit = await Safe.init({
    provider: walletClient.transport,
    signer: walletClient.account.address,
    safeAddress,
  });

  const vendorId = keccak256(toBytes(vendorLabel));
  const data = encodeFunctionData({
    abi: FIREWALL_REGISTER_ABI,
    functionName: 'registerVendor',
    args: [vendorId, payoutWallet, approver, treasuryReviewer, riskReviewer],
  });

  const safeTransaction = await protocolKit.createTransaction({
    transactions: [{ to: firewallAddress, value: '0', data }],
    onlyCalls: true,
  });

  const executed = await protocolKit.executeTransaction(safeTransaction);
  const receipt = await executed.transactionResponse.wait();
  if (receipt.status !== 'success') throw new Error(`REGISTRATION_FAILED:${executed.hash}`);
  return executed.hash as Hex;
}

export function deriveVendorId(label: string): Hex {
  return keccak256(toBytes(label));
}

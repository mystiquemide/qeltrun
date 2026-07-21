import { encodeAbiParameters, keccak256 } from 'viem';

import type { Address, RequestId, VendorId } from './types.js';

export type RequestIdV2Input = {
  vendorId: VendorId;
  currentWallet: Address;
  proposedWallet: Address;
  requestedBy: Address;
  nonce: bigint;
  approverEpoch: bigint;
  chainId: number;
  firewallAddress: Address;
};

/// Off-chain mirror of `QeltrunPayoutFirewallV2.deriveRequestId`.
export function deriveRequestIdV2(input: RequestIdV2Input): RequestId {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'address' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint64' },
        { type: 'uint256' },
        { type: 'address' },
      ],
      [
        input.vendorId,
        input.currentWallet,
        input.proposedWallet,
        input.requestedBy,
        input.nonce,
        input.approverEpoch,
        BigInt(input.chainId),
        input.firewallAddress,
      ],
    ),
  );
}

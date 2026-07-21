import { encodeAbiParameters, keccak256, toBytes } from 'viem';

import { REQUEST_STATUS } from './types.js';
import type {
  Address,
  PayoutDecision,
  RequestId,
  RequestIdInput,
  RequestStatus,
  VendorId,
  VendorRecord,
} from './types.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/// Turn a human vendor label into the bytes32 id the contract stores.
export function vendorId(label: string): VendorId {
  return keccak256(toBytes(label));
}

/// Off-chain mirror of `QeltrunPayoutFirewall.deriveRequestId`.
///
/// This must stay byte-identical to the Solidity implementation, otherwise the UI would seal
/// approvals against a request the contract has never heard of. `test/request-id.test.ts`
/// pins both sides to the same vector.
export function deriveRequestId(input: RequestIdInput): RequestId {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'address' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'address' },
      ],
      [
        input.vendorId,
        input.currentWallet,
        input.proposedWallet,
        input.requestedBy,
        input.nonce,
        BigInt(input.chainId),
        input.firewallAddress,
      ],
    ),
  );
}

/// Off-chain mirror of `QeltrunPayoutFirewall.isPayoutAllowed`.
///
/// The contract remains the authority; this exists so a client can show the verdict before
/// spending gas, and so the two implementations can be tested against each other.
export function decidePayout(vendor: VendorRecord, destination: Address): PayoutDecision {
  if (!vendor.registered) {
    return { status: 'blocked', reason: 'VENDOR_NOT_REGISTERED', vendorId: vendor.vendorId, destination };
  }
  if (isSameAddress(destination, ZERO_ADDRESS)) {
    return { status: 'blocked', reason: 'ZERO_DESTINATION', vendorId: vendor.vendorId, destination };
  }
  if (isSameAddress(destination, vendor.payoutWallet)) {
    return { status: 'allowed', reason: 'DESTINATION_UNCHANGED', vendorId: vendor.vendorId, destination };
  }
  return { status: 'blocked', reason: 'APPROVAL_REQUIRED', vendorId: vendor.vendorId, destination };
}

export function isSameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/// Decode the `RequestStatus` enum index returned by the contract.
export function requestStatusFrom(index: number): RequestStatus {
  const status = REQUEST_STATUS[index];
  if (status === undefined) {
    throw new Error(`UNKNOWN_REQUEST_STATUS:${index}`);
  }
  return status;
}

export type * from './types.js';
export { REQUEST_STATUS } from './types.js';
export { deriveRequestIdV2 } from './v2.js';
export type { RequestIdV2Input } from './v2.js';

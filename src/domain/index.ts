import { createHash } from 'node:crypto';

import type {
  ApprovalProvider,
  CreateVendorChangeRequestInput,
  CreateVendorChangeRequestResult,
  PayoutDecision,
  PayoutDecisionInput,
  RegisterVendorInput,
  RequestId,
  VendorChangeRequest,
  VendorRecord,
} from './types.js';

function sha256Hex(value: string): string {
  return `0x${createHash('sha256').update(value).digest('hex')}`;
}

export function deriveRequestId(request: VendorChangeRequest): RequestId {
  return sha256Hex(
    JSON.stringify({
      vendorId: request.vendorId,
      currentPayoutWallet: request.currentPayoutWallet.toLowerCase(),
      proposedPayoutWallet: request.proposedPayoutWallet.toLowerCase(),
      requestedBy: request.requestedBy.toLowerCase(),
      nonce: request.nonce,
      chainId: request.chainId,
    }),
  );
}

export function registerVendor(input: RegisterVendorInput): VendorRecord {
  return {
    vendorId: input.vendorId,
    vendorWallet: input.vendorWallet,
    activePayoutWallet: input.activePayoutWallet,
    registeredBy: input.registeredBy,
    status: 'active',
  };
}

export async function createVendorChangeRequest(
  input: CreateVendorChangeRequestInput,
): Promise<CreateVendorChangeRequestResult> {
  const request: VendorChangeRequest = {
    vendorId: input.vendor.vendorId,
    currentPayoutWallet: input.vendor.activePayoutWallet,
    proposedPayoutWallet: input.proposedPayoutWallet,
    requestedBy: input.requestedBy,
    reason: input.reason,
    nonce: input.nonce,
    chainId: input.provider.chainId,
  };

  const sealedRequest = await input.provider.sealChangeRequest({ request });

  return {
    request,
    sealedRequest,
    vendor: {
      ...input.vendor,
      pendingPayoutWallet: input.proposedPayoutWallet,
      pendingRequestId: sealedRequest.requestId,
      status: 'change_pending',
    },
  };
}

export async function decidePayout(input: PayoutDecisionInput): Promise<PayoutDecision> {
  const { vendor, requestedPayoutWallet, provider } = input;

  if (requestedPayoutWallet.toLowerCase() === vendor.activePayoutWallet.toLowerCase()) {
    return {
      status: 'allowed',
      reason: 'DESTINATION_UNCHANGED',
      vendorId: vendor.vendorId,
      requestedPayoutWallet,
    };
  }

  if (vendor.pendingPayoutWallet?.toLowerCase() !== requestedPayoutWallet.toLowerCase()) {
    return vendor.pendingRequestId
      ? {
          status: 'blocked',
          reason: 'PAYOUT_WALLET_MISMATCH',
          vendorId: vendor.vendorId,
          requestedPayoutWallet,
          requestId: vendor.pendingRequestId,
        }
      : {
          status: 'blocked',
          reason: 'PAYOUT_WALLET_MISMATCH',
          vendorId: vendor.vendorId,
          requestedPayoutWallet,
        };
  }

  if (!vendor.pendingRequestId) {
    return {
      status: 'blocked',
      reason: 'APPROVAL_MISSING',
      vendorId: vendor.vendorId,
      requestedPayoutWallet,
    };
  }

  const known = await provider.isKnownRequest(vendor.pendingRequestId);
  if (!known) {
    return {
      status: 'blocked',
      reason: 'APPROVAL_UNKNOWN',
      vendorId: vendor.vendorId,
      requestedPayoutWallet,
      requestId: vendor.pendingRequestId,
    };
  }

  const approval = await provider.getApproval(vendor.pendingRequestId);
  if (!approval) {
    return {
      status: 'blocked',
      reason: 'APPROVAL_MISSING',
      vendorId: vendor.vendorId,
      requestedPayoutWallet,
      requestId: vendor.pendingRequestId,
    };
  }

  return {
    status: 'allowed',
    reason: 'APPROVAL_PRESENT',
    vendorId: vendor.vendorId,
    requestedPayoutWallet,
    requestId: vendor.pendingRequestId,
    approvalRef: approval.approvalRef,
  };
}

export type * from './types.js';

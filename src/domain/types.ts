export type Address = `0x${string}`;
export type VendorId = string;
export type RequestId = string;

export type VendorStatus = 'active' | 'change_pending' | 'approved';

export type VendorRecord = {
  vendorId: VendorId;
  vendorWallet: Address;
  activePayoutWallet: Address;
  registeredBy: Address;
  status: VendorStatus;
  pendingPayoutWallet?: Address;
  pendingRequestId?: RequestId;
  approvalRef?: string;
};

export type VendorChangeRequest = {
  vendorId: VendorId;
  currentPayoutWallet: Address;
  proposedPayoutWallet: Address;
  requestedBy: Address;
  reason: string;
  nonce: string;
  chainId: number;
};

export type SealedApprovalRequest = {
  requestId: RequestId;
  sealedHandle: string;
  handleProof: string;
  applicationContract?: Address;
  createdAt: string;
};

export type ApprovalReceipt = {
  requestId: RequestId;
  approvedBy: Address;
  approvalRef: string;
  approvedAt: string;
};

export type PayoutDecision =
  | {
      status: 'allowed';
      reason: 'DESTINATION_UNCHANGED' | 'APPROVAL_PRESENT';
      vendorId: VendorId;
      requestedPayoutWallet: Address;
      requestId?: RequestId;
      approvalRef?: string;
    }
  | {
      status: 'blocked';
      reason: 'APPROVAL_MISSING' | 'APPROVAL_UNKNOWN' | 'PAYOUT_WALLET_MISMATCH';
      vendorId: VendorId;
      requestedPayoutWallet: Address;
      requestId?: RequestId;
    };

export type RegisterVendorInput = {
  vendorId: VendorId;
  vendorWallet: Address;
  activePayoutWallet: Address;
  registeredBy: Address;
};

export type CreateVendorChangeRequestInput = {
  vendor: VendorRecord;
  proposedPayoutWallet: Address;
  requestedBy: Address;
  reason: string;
  nonce: string;
  provider: ApprovalProvider;
};

export type CreateVendorChangeRequestResult = {
  vendor: VendorRecord;
  request: VendorChangeRequest;
  sealedRequest: SealedApprovalRequest;
};

export type PayoutDecisionInput = {
  vendor: VendorRecord;
  requestedPayoutWallet: Address;
  provider: ApprovalProvider;
};

export type SealChangeRequestInput = {
  request: VendorChangeRequest;
};

export type ApproveSealedRequestInput = {
  requestId: RequestId;
  approver: Address;
};

export interface ApprovalProvider {
  readonly chainId: number;
  sealChangeRequest(input: SealChangeRequestInput): Promise<SealedApprovalRequest>;
  approveSealedRequest(input: ApproveSealedRequestInput): Promise<ApprovalReceipt>;
  getApproval(requestId: RequestId): Promise<ApprovalReceipt | undefined>;
  isKnownRequest(requestId: RequestId): Promise<boolean>;
}

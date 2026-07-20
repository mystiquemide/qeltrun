import { createHash } from 'node:crypto';

import { deriveRequestId } from '../domain/index.js';
import type {
  ApprovalProvider,
  ApprovalReceipt,
  ApproveSealedRequestInput,
  RequestId,
  SealChangeRequestInput,
  SealedApprovalRequest,
  VendorChangeRequest,
  Address,
} from '../domain/types.js';

export type DevelopmentApprovalProviderConfig = {
  chainId: number;
  authorizedApprovers: readonly Address[];
};

function sha256Hex(value: string): string {
  return `0x${createHash('sha256').update(value).digest('hex')}`;
}

export class DevelopmentApprovalProvider implements ApprovalProvider {
  readonly chainId: number;

  private readonly authorizedApprovers: Set<string>;
  private readonly sealedRequests = new Map<RequestId, SealedApprovalRequest>();
  private readonly approvals = new Map<RequestId, ApprovalReceipt>();

  constructor(config: DevelopmentApprovalProviderConfig) {
    this.chainId = config.chainId;
    this.authorizedApprovers = new Set(config.authorizedApprovers.map((address) => address.toLowerCase()));
  }

  async sealChangeRequest(input: SealChangeRequestInput): Promise<SealedApprovalRequest> {
    this.assertChain(input.request);

    const requestId = deriveRequestId(input.request);
    const createdAt = new Date(0).toISOString();
    const sealedHandle = sha256Hex(`development-handle:${requestId}`);
    const handleProof = sha256Hex(`development-proof:${requestId}:${input.request.requestedBy.toLowerCase()}`);

    const sealedRequest = {
      requestId,
      sealedHandle,
      handleProof,
      createdAt,
    } satisfies SealedApprovalRequest;

    this.sealedRequests.set(requestId, sealedRequest);
    return sealedRequest;
  }

  async approveSealedRequest(input: ApproveSealedRequestInput): Promise<ApprovalReceipt> {
    if (!this.authorizedApprovers.has(input.approver.toLowerCase())) {
      throw new Error('UNAUTHORIZED_APPROVER');
    }

    if (!this.sealedRequests.has(input.requestId)) {
      throw new Error('UNKNOWN_APPROVAL_REQUEST');
    }

    const receipt = {
      requestId: input.requestId,
      approvedBy: input.approver,
      approvalRef: `development-approval:${input.requestId}:${input.approver.toLowerCase()}`,
      approvedAt: new Date(0).toISOString(),
    } satisfies ApprovalReceipt;

    this.approvals.set(input.requestId, receipt);
    return receipt;
  }

  async getApproval(requestId: RequestId): Promise<ApprovalReceipt | undefined> {
    return this.approvals.get(requestId);
  }

  async isKnownRequest(requestId: RequestId): Promise<boolean> {
    return this.sealedRequests.has(requestId);
  }

  private assertChain(request: VendorChangeRequest): void {
    if (request.chainId !== this.chainId) {
      throw new Error(`CHAIN_MISMATCH:${request.chainId}:expected:${this.chainId}`);
    }
  }
}

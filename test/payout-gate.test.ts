import { describe, expect, it } from 'vitest';

import { DevelopmentApprovalProvider } from '../src/providers/development-approval-provider.js';
import {
  createVendorChangeRequest,
  decidePayout,
  registerVendor,
  type Address,
} from '../src/domain/index.js';

const treasury = '0x1000000000000000000000000000000000000001' as Address;
const approver = '0x2000000000000000000000000000000000000002' as Address;
const attacker = '0x3000000000000000000000000000000000000003' as Address;
const vendorWallet = '0x4000000000000000000000000000000000000004' as Address;
const originalPayoutWallet = '0x5000000000000000000000000000000000000005' as Address;
const changedPayoutWallet = '0x6000000000000000000000000000000000000006' as Address;
const differentChangedWallet = '0x7000000000000000000000000000000000000007' as Address;

function makeProvider() {
  return new DevelopmentApprovalProvider({
    chainId: 11155111,
    authorizedApprovers: [approver],
  });
}

describe('Qeltrun payout gate', () => {
  it('allows payout when the requested payout wallet is still the vendor active payout wallet', async () => {
    const vendor = registerVendor({
      vendorId: 'vendor-acme',
      vendorWallet,
      activePayoutWallet: originalPayoutWallet,
      registeredBy: treasury,
    });

    const decision = await decidePayout({
      vendor,
      requestedPayoutWallet: originalPayoutWallet,
      provider: makeProvider(),
    });

    expect(decision).toMatchObject({
      status: 'allowed',
      reason: 'DESTINATION_UNCHANGED',
      vendorId: 'vendor-acme',
    });
  });

  it('blocks payout when destination changed and no approval exists', async () => {
    const provider = makeProvider();
    const vendor = registerVendor({
      vendorId: 'vendor-acme',
      vendorWallet,
      activePayoutWallet: originalPayoutWallet,
      registeredBy: treasury,
    });

    const request = await createVendorChangeRequest({
      vendor,
      proposedPayoutWallet: changedPayoutWallet,
      requestedBy: treasury,
      reason: 'invoice email requested address rotation',
      nonce: 'change-001',
      provider,
    });

    const decision = await decidePayout({
      vendor: request.vendor,
      requestedPayoutWallet: changedPayoutWallet,
      provider,
    });

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'APPROVAL_MISSING',
      requestId: request.sealedRequest.requestId,
    });
  });

  it('allows payout after authorized approval is recorded for the exact sealed request', async () => {
    const provider = makeProvider();
    const vendor = registerVendor({
      vendorId: 'vendor-acme',
      vendorWallet,
      activePayoutWallet: originalPayoutWallet,
      registeredBy: treasury,
    });

    const request = await createVendorChangeRequest({
      vendor,
      proposedPayoutWallet: changedPayoutWallet,
      requestedBy: treasury,
      reason: 'invoice email requested address rotation',
      nonce: 'change-001',
      provider,
    });

    const receipt = await provider.approveSealedRequest({
      requestId: request.sealedRequest.requestId,
      approver,
    });

    const decision = await decidePayout({
      vendor: request.vendor,
      requestedPayoutWallet: changedPayoutWallet,
      provider,
    });

    expect(receipt.approvalRef).toContain(request.sealedRequest.requestId);
    expect(decision).toMatchObject({
      status: 'allowed',
      reason: 'APPROVAL_PRESENT',
      approvalRef: receipt.approvalRef,
      requestId: request.sealedRequest.requestId,
    });
  });

  it('fails closed when the approval request is unknown', async () => {
    const provider = makeProvider();
    const vendor = registerVendor({
      vendorId: 'vendor-acme',
      vendorWallet,
      activePayoutWallet: originalPayoutWallet,
      registeredBy: treasury,
    });

    const tamperedVendor = {
      ...vendor,
      pendingPayoutWallet: changedPayoutWallet,
      pendingRequestId: 'unknown-request',
      status: 'change_pending' as const,
    };

    const decision = await decidePayout({
      vendor: tamperedVendor,
      requestedPayoutWallet: changedPayoutWallet,
      provider,
    });

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'APPROVAL_UNKNOWN',
      requestId: 'unknown-request',
    });
  });

  it('rejects unauthorized approvers', async () => {
    const provider = makeProvider();
    const vendor = registerVendor({
      vendorId: 'vendor-acme',
      vendorWallet,
      activePayoutWallet: originalPayoutWallet,
      registeredBy: treasury,
    });

    const request = await createVendorChangeRequest({
      vendor,
      proposedPayoutWallet: changedPayoutWallet,
      requestedBy: treasury,
      reason: 'invoice email requested address rotation',
      nonce: 'change-001',
      provider,
    });

    await expect(
      provider.approveSealedRequest({ requestId: request.sealedRequest.requestId, approver: attacker }),
    ).rejects.toThrow('UNAUTHORIZED_APPROVER');
  });

  it('binds request ids to the proposed payout wallet to prevent replay across wallet changes', async () => {
    const provider = makeProvider();
    const vendor = registerVendor({
      vendorId: 'vendor-acme',
      vendorWallet,
      activePayoutWallet: originalPayoutWallet,
      registeredBy: treasury,
    });

    const first = await createVendorChangeRequest({
      vendor,
      proposedPayoutWallet: changedPayoutWallet,
      requestedBy: treasury,
      reason: 'first destination change',
      nonce: 'same-nonce-for-test',
      provider,
    });

    const second = await createVendorChangeRequest({
      vendor,
      proposedPayoutWallet: differentChangedWallet,
      requestedBy: treasury,
      reason: 'second destination change',
      nonce: 'same-nonce-for-test',
      provider,
    });

    expect(first.sealedRequest.requestId).not.toEqual(second.sealedRequest.requestId);
  });
});

import type { BaseContract, ContractRunner, ContractTransactionResponse } from 'ethers';

import type { Address, Hex } from '../domain/types.js';

/// ethers resolves contract methods dynamically, which leaves callers with `BaseContract` and
/// no type safety on the very calls that matter. This interface restates the firewall ABI so
/// a typo in a method name or argument is a compile error rather than a runtime revert.
export interface FirewallContract extends BaseContract {
  registerVendor(
    vendorId: Hex,
    payoutWallet: Address,
    approver: Address,
  ): Promise<ContractTransactionResponse>;

  openChangeRequest: {
    (vendorId: Hex, proposedWallet: Address, nonce: bigint): Promise<ContractTransactionResponse>;
    /// `openChangeRequest` returns the derived request id, which only a static call can read.
    staticCall(vendorId: Hex, proposedWallet: Address, nonce: bigint): Promise<Hex>;
  };

  sealApproval(
    requestId: Hex,
    encryptedApproval: Hex,
    handleProof: Hex,
  ): Promise<ContractTransactionResponse>;

  settleApproval(requestId: Hex, decryptionProof: Hex): Promise<ContractTransactionResponse>;

  isPayoutAllowed(vendorId: Hex, destination: Address): Promise<[boolean, string]>;

  getVendor(vendorId: Hex): Promise<{
    payoutWallet: string;
    approver: string;
    registered: boolean;
  }>;

  getRequest(requestId: Hex): Promise<{
    vendorId: string;
    currentWallet: string;
    proposedWallet: string;
    requestedBy: string;
    nonce: bigint;
    status: bigint;
    approved: boolean;
    sealedApproval: string;
  }>;

  sealedApprovalHandle(requestId: Hex): Promise<Hex>;
  handleUsedBy(handle: Hex): Promise<Hex>;

  deriveRequestId(
    vendorId: Hex,
    currentWallet: Address,
    proposedWallet: Address,
    requestedBy: Address,
    nonce: bigint,
  ): Promise<Hex>;

  noxComputeAddress(): Promise<string>;
}

/// Narrow an ethers contract to the firewall ABI.
export function asFirewall(contract: BaseContract): FirewallContract {
  return contract as unknown as FirewallContract;
}

/// Bind the firewall to a different signer, keeping the typed surface.
export function firewallAs(contract: FirewallContract, runner: ContractRunner): FirewallContract {
  return asFirewall(contract.connect(runner));
}

export type Hex = `0x${string}`;
export type Address = Hex;

/// bytes32 identifier for a vendor, mirroring the contract's `vendorId`.
export type VendorId = Hex;
/// bytes32 identifier derived by `QeltrunPayoutFirewall.deriveRequestId`.
export type RequestId = Hex;

/// Mirrors `QeltrunPayoutFirewall.RequestStatus`. Index order is part of the ABI.
export const REQUEST_STATUS = ['none', 'pending', 'sealed', 'settled'] as const;
export type RequestStatus = (typeof REQUEST_STATUS)[number];

/// Mirrors `QeltrunPayoutFirewall.Vendor`.
export type VendorRecord = {
  vendorId: VendorId;
  payoutWallet: Address;
  approver: Address;
  registered: boolean;
};

/// Mirrors `QeltrunPayoutFirewall.ChangeRequest`, plus the id it is stored under.
export type ChangeRequest = {
  requestId: RequestId;
  vendorId: VendorId;
  currentWallet: Address;
  proposedWallet: Address;
  requestedBy: Address;
  nonce: bigint;
  status: RequestStatus;
  approved: boolean;
  sealedApprovalHandle: Hex;
};

/// Inputs to the request-id derivation. Must match the contract argument order exactly.
export type RequestIdInput = {
  vendorId: VendorId;
  currentWallet: Address;
  proposedWallet: Address;
  requestedBy: Address;
  nonce: bigint;
  chainId: number;
  /// The deployed `QeltrunPayoutFirewall`. Request ids do not cross deployments.
  firewallAddress: Address;
};

export type BlockedReason = 'VENDOR_NOT_REGISTERED' | 'ZERO_DESTINATION' | 'APPROVAL_REQUIRED';

/// Mirrors the tuple returned by `QeltrunPayoutFirewall.isPayoutAllowed`.
export type PayoutDecision =
  | {
      status: 'allowed';
      reason: 'DESTINATION_UNCHANGED';
      vendorId: VendorId;
      destination: Address;
    }
  | {
      status: 'blocked';
      reason: BlockedReason;
      vendorId: VendorId;
      destination: Address;
    };

/// What `HandleClient.encryptInput` hands back, ready to pass to `sealApproval`.
export type SealedApproval = {
  /// bytes32 Nox handle.
  handle: Hex;
  /// 137-byte Nox input proof: owner(20) ‖ app(20) ‖ createdAt(32) ‖ signature(65).
  handleProof: Hex;
  /// The wallet the handle was minted for. Must be the transaction sender.
  owner: Address;
  /// The contract the handle was minted for. Must be the firewall being called.
  applicationContract: Address;
};

/// What `HandleClient.publicDecrypt` hands back, ready to pass to `settleApproval`.
export type RevealedApproval = {
  handle: Hex;
  value: boolean;
  /// Compact Nox proof: signature(65) ‖ decryptedResult.
  decryptionProof: Hex;
};

export type SealApprovalInput = {
  /// The approver's wallet. It must both seal and submit; Nox binds the handle to it.
  approver: Address;
  /// The deployed firewall the handle will be spent against.
  applicationContract: Address;
  /// The decision being sealed. `false` produces a verifiable rejection.
  approve: boolean;
};

/// The only boundary that touches iExec Nox.
///
/// Everything else in Qeltrun is either plain domain logic or a contract call, which keeps
/// the Nox dependency swappable and testable. The provider deliberately holds no approval
/// state: the contract is the sole source of truth for whether a payout is allowed.
export interface ApprovalProvider {
  readonly chainId: number;
  /// Encrypt an approval bit inside the Nox TEE and return it with its input proof.
  sealApproval(input: SealApprovalInput): Promise<SealedApproval>;
  /// Ask the Nox gateway for a signed decryption of a handle the contract marked public.
  revealApproval(handle: Hex): Promise<RevealedApproval>;
}

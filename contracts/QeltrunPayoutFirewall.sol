// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

// Global import so the encrypted value types (`ebool`, `externalEbool`) declared by
// `encrypted-types` come into scope alongside the `Nox` library itself.
import "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

/// @title QeltrunPayoutFirewall
/// @notice Fail-closed payout gate for vendor bank/wallet changes.
///
/// @dev The security model has exactly one way to move a vendor's payout destination:
///
///  1. Anyone may *open* a change request. Opening changes nothing; the gate stays shut.
///  2. The vendor's registered approver seals an encrypted approval bit off-chain with the
///     Nox TEE gateway and submits it as `(externalEbool, handleProof)`. `Nox.fromExternal`
///     rejects the handle unless the 137-byte proof proves all of:
///       - the handle was minted for *this* contract (`app == msg.sender` inside NoxCompute),
///       - the handle was minted for the *calling wallet* (`owner == msg.sender` here),
///       - the handle carries the right chain id and TEE type,
///       - the proof has not expired.
///     The contract never learns the bit at this point. It only holds a handle.
///  3. Settlement supplies a gateway-signed decryption proof. `Nox.publicDecrypt` verifies
///     that signature and returns the plaintext bit. Only a verified `true` moves the wallet.
///
/// Calldata alone can never open the gate: an attacker with full control of every argument
/// still cannot produce a handle proof bound to this contract *and* the approver's wallet,
/// nor a decryption proof signed by the Nox gateway.
contract QeltrunPayoutFirewall {
    // ============ Types ============

    enum RequestStatus {
        None,
        Pending,
        Sealed,
        Settled
    }

    struct Vendor {
        address payoutWallet;
        address approver;
        bool registered;
    }

    struct ChangeRequest {
        bytes32 vendorId;
        address currentWallet;
        address proposedWallet;
        address requestedBy;
        uint256 nonce;
        RequestStatus status;
        bool approved;
        ebool sealedApproval;
    }

    // ============ Storage ============

    mapping(bytes32 vendorId => Vendor) private _vendors;
    mapping(bytes32 requestId => ChangeRequest) private _requests;

    /// @dev A Nox input proof binds a handle to an owner and an app, but not to a request id.
    ///      Without this ledger an approver could re-submit one sealed approval against a
    ///      second request and move the wallet somewhere they never approved. `encryptInput`
    ///      mints a fresh handle per call, so honest flows never collide here.
    mapping(bytes32 handle => bytes32 requestId) private _handleUsedBy;

    // ============ Events ============

    event VendorRegistered(bytes32 indexed vendorId, address indexed payoutWallet, address indexed approver);
    event ChangeRequestOpened(
        bytes32 indexed requestId,
        bytes32 indexed vendorId,
        address indexed proposedWallet,
        address requestedBy,
        uint256 nonce
    );
    event ApprovalSealed(bytes32 indexed requestId, address indexed approver, bytes32 handle);
    event ApprovalSettled(bytes32 indexed requestId, bool approved);
    event PayoutWalletChanged(bytes32 indexed vendorId, address indexed previousWallet, address indexed newWallet);

    // ============ Errors ============

    error ZeroAddress();
    error ZeroVendorId();
    error VendorAlreadyRegistered(bytes32 vendorId);
    error VendorNotRegistered(bytes32 vendorId);
    error UnauthorizedApprover(bytes32 vendorId, address caller);
    error DestinationUnchanged(bytes32 vendorId, address proposedWallet);
    error RequestAlreadyExists(bytes32 requestId);
    error RequestNotPending(bytes32 requestId, RequestStatus status);
    error RequestNotSealed(bytes32 requestId, RequestStatus status);
    error RequestNotFound(bytes32 requestId);
    error StaleRequest(bytes32 requestId, address expectedWallet, address actualWallet);
    error UninitializedHandle();
    error HandleAlreadyUsed(bytes32 handle, bytes32 requestId);

    // ============ Registration ============

    /// @notice Register a vendor with its active payout wallet and the wallet allowed to approve changes.
    /// @param vendorId Opaque off-chain vendor identifier (e.g. keccak256 of the vendor's ERP id).
    /// @param payoutWallet The destination funds may currently be sent to.
    /// @param approver The only wallet whose sealed approval this contract will accept for this vendor.
    function registerVendor(bytes32 vendorId, address payoutWallet, address approver) external {
        if (vendorId == bytes32(0)) revert ZeroVendorId();
        if (payoutWallet == address(0) || approver == address(0)) revert ZeroAddress();
        if (_vendors[vendorId].registered) revert VendorAlreadyRegistered(vendorId);

        _vendors[vendorId] = Vendor({payoutWallet: payoutWallet, approver: approver, registered: true});

        emit VendorRegistered(vendorId, payoutWallet, approver);
    }

    // ============ Change request lifecycle ============

    /// @notice Open a payout-destination change request. This does not relax the gate.
    /// @dev The request id is derived on-chain, so a caller cannot choose it. It binds the
    ///      vendor, both wallets, the requester, a nonce, the chain and this deployment —
    ///      which makes a request non-replayable across vendors, chains or contracts.
    function openChangeRequest(bytes32 vendorId, address proposedWallet, uint256 nonce)
        external
        returns (bytes32 requestId)
    {
        Vendor storage vendor = _vendors[vendorId];
        if (!vendor.registered) revert VendorNotRegistered(vendorId);
        if (proposedWallet == address(0)) revert ZeroAddress();
        if (proposedWallet == vendor.payoutWallet) revert DestinationUnchanged(vendorId, proposedWallet);

        requestId = deriveRequestId(vendorId, vendor.payoutWallet, proposedWallet, msg.sender, nonce);
        if (_requests[requestId].status != RequestStatus.None) revert RequestAlreadyExists(requestId);

        _requests[requestId] = ChangeRequest({
            vendorId: vendorId,
            currentWallet: vendor.payoutWallet,
            proposedWallet: proposedWallet,
            requestedBy: msg.sender,
            nonce: nonce,
            status: RequestStatus.Pending,
            approved: false,
            sealedApproval: ebool.wrap(bytes32(0))
        });

        emit ChangeRequestOpened(requestId, vendorId, proposedWallet, msg.sender, nonce);
    }

    /// @notice Attach a TEE-sealed approval bit to a pending request.
    /// @dev `Nox.fromExternal` reverts unless the input proof binds the handle to this contract
    ///      *and* to `msg.sender`, so the approver must both seal and submit. The contract stores
    ///      only the handle; the bit stays inside the TEE until settlement.
    /// @param requestId Request produced by `openChangeRequest`.
    /// @param encryptedApproval Handle returned by `HandleClient.encryptInput(value, 'bool', address(this))`.
    /// @param handleProof The accompanying 137-byte Nox input proof.
    function sealApproval(bytes32 requestId, externalEbool encryptedApproval, bytes calldata handleProof) external {
        ChangeRequest storage request = _requests[requestId];
        if (request.status == RequestStatus.None) revert RequestNotFound(requestId);
        if (request.status != RequestStatus.Pending) revert RequestNotPending(requestId, request.status);

        Vendor storage vendor = _vendors[request.vendorId];
        if (msg.sender != vendor.approver) revert UnauthorizedApprover(request.vendorId, msg.sender);

        ebool approval = Nox.fromExternal(encryptedApproval, handleProof);
        if (!Nox.isInitialized(approval)) revert UninitializedHandle();

        bytes32 rawHandle = ebool.unwrap(approval);
        bytes32 boundTo = _handleUsedBy[rawHandle];
        if (boundTo != bytes32(0)) revert HandleAlreadyUsed(rawHandle, boundTo);
        _handleUsedBy[rawHandle] = requestId;

        // Persist access for this contract so the handle survives past this transaction,
        // keep the approver able to decrypt it, and mark it publicly decryptable so the
        // settlement step can be carried out by anyone holding the gateway's proof.
        Nox.allowThis(approval);
        Nox.allow(approval, msg.sender);
        Nox.allowPublicDecryption(approval);

        request.sealedApproval = approval;
        request.status = RequestStatus.Sealed;

        emit ApprovalSealed(requestId, msg.sender, ebool.unwrap(approval));
    }

    /// @notice Settle a sealed request by revealing the approval bit through a gateway-signed proof.
    /// @dev Permissionless on purpose: authority lives in the gateway signature that
    ///      `Nox.publicDecrypt` verifies, not in the caller. A decrypted `false` settles the
    ///      request as rejected and leaves the payout wallet untouched.
    /// @param requestId Request previously sealed via `sealApproval`.
    /// @param decryptionProof Compact Nox proof: 65-byte signature followed by the decrypted result.
    function settleApproval(bytes32 requestId, bytes calldata decryptionProof) external returns (bool approved) {
        ChangeRequest storage request = _requests[requestId];
        if (request.status == RequestStatus.None) revert RequestNotFound(requestId);
        if (request.status != RequestStatus.Sealed) revert RequestNotSealed(requestId, request.status);

        Vendor storage vendor = _vendors[request.vendorId];
        // A request approves one specific transition. If the wallet moved in the meantime the
        // sealed approval no longer describes reality, so refuse rather than apply it.
        if (vendor.payoutWallet != request.currentWallet) {
            revert StaleRequest(requestId, request.currentWallet, vendor.payoutWallet);
        }

        approved = Nox.publicDecrypt(request.sealedApproval, decryptionProof);

        request.approved = approved;
        request.status = RequestStatus.Settled;

        if (approved) {
            address previousWallet = vendor.payoutWallet;
            vendor.payoutWallet = request.proposedWallet;
            emit PayoutWalletChanged(request.vendorId, previousWallet, request.proposedWallet);
        }

        emit ApprovalSettled(requestId, approved);
    }

    // ============ The gate ============

    /// @notice The payout gate. Fail-closed: a destination is allowed only if it is the vendor's
    ///         current payout wallet, and the only path to becoming that wallet is a settled,
    ///         TEE-proven approval.
    function isPayoutAllowed(bytes32 vendorId, address destination)
        external
        view
        returns (bool allowed, string memory reason)
    {
        Vendor storage vendor = _vendors[vendorId];
        if (!vendor.registered) return (false, "VENDOR_NOT_REGISTERED");
        if (destination == address(0)) return (false, "ZERO_DESTINATION");
        if (destination == vendor.payoutWallet) return (true, "DESTINATION_UNCHANGED");
        return (false, "APPROVAL_REQUIRED");
    }

    // ============ Views ============

    /// @notice Derive the canonical request id for a change. Mirrors the off-chain derivation.
    function deriveRequestId(
        bytes32 vendorId,
        address currentWallet,
        address proposedWallet,
        address requestedBy,
        uint256 nonce
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(vendorId, currentWallet, proposedWallet, requestedBy, nonce, block.chainid, address(this))
        );
    }

    function getVendor(bytes32 vendorId) external view returns (Vendor memory) {
        return _vendors[vendorId];
    }

    function getRequest(bytes32 requestId) external view returns (ChangeRequest memory) {
        return _requests[requestId];
    }

    /// @notice Raw Nox handle attached to a request, for UI display and off-chain decryption.
    function sealedApprovalHandle(bytes32 requestId) external view returns (bytes32) {
        return ebool.unwrap(_requests[requestId].sealedApproval);
    }

    /// @notice Request a given Nox handle has already been consumed by, or zero if unused.
    function handleUsedBy(bytes32 handle) external view returns (bytes32) {
        return _handleUsedBy[handle];
    }

    /// @notice NoxCompute deployment this contract talks to on the current chain.
    function noxComputeAddress() external view returns (address) {
        return Nox.noxComputeContract();
    }
}

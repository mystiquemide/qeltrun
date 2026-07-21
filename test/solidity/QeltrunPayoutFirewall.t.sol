// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {NoxLocalEnv} from "./NoxLocalEnv.sol";
import {QeltrunPayoutFirewall} from "../../contracts/QeltrunPayoutFirewall.sol";
import {externalEbool} from "encrypted-types/EncryptedTypes.sol";

/// @notice Happy-path and lifecycle coverage for the payout gate.
contract QeltrunPayoutFirewallTest is NoxLocalEnv {
    QeltrunPayoutFirewall internal firewall;

    bytes32 internal constant VENDOR = keccak256("vendor:northwind-logistics");

    address internal payoutWallet;
    address internal proposedWallet;
    address internal approver;
    address internal requester;

    function setUp() public {
        _bootstrapNox();
        firewall = new QeltrunPayoutFirewall();

        payoutWallet = makeAddr("payout-wallet");
        proposedWallet = makeAddr("proposed-wallet");
        approver = makeAddr("approver");
        requester = makeAddr("requester");

        firewall.registerVendor(VENDOR, payoutWallet, approver);
    }

    // ============ Helpers ============

    function _open() internal returns (bytes32 requestId) {
        vm.prank(requester);
        return firewall.openChangeRequest(VENDOR, proposedWallet, 1);
    }

    function _seal(bytes32 requestId, string memory salt) internal returns (bytes32 handle) {
        handle = _boolHandle(salt);
        bytes memory proof = _inputProof(handle, approver, address(firewall));
        vm.prank(approver);
        firewall.sealApproval(requestId, externalEbool.wrap(handle), proof);
    }

    // ============ Registration & gate ============

    function test_registered_vendor_allows_only_its_current_wallet() public view {
        (bool allowed, string memory reason) = firewall.isPayoutAllowed(VENDOR, payoutWallet);
        assertTrue(allowed);
        assertEq(reason, "DESTINATION_UNCHANGED");

        (allowed, reason) = firewall.isPayoutAllowed(VENDOR, proposedWallet);
        assertFalse(allowed);
        assertEq(reason, "APPROVAL_REQUIRED");
    }

    function test_unknown_vendor_is_blocked() public view {
        (bool allowed, string memory reason) = firewall.isPayoutAllowed(keccak256("ghost"), payoutWallet);
        assertFalse(allowed);
        assertEq(reason, "VENDOR_NOT_REGISTERED");
    }

    function test_zero_destination_is_blocked() public view {
        (bool allowed, string memory reason) = firewall.isPayoutAllowed(VENDOR, address(0));
        assertFalse(allowed);
        assertEq(reason, "ZERO_DESTINATION");
    }

    function test_duplicate_registration_reverts() public {
        vm.expectRevert(abi.encodeWithSelector(QeltrunPayoutFirewall.VendorAlreadyRegistered.selector, VENDOR));
        firewall.registerVendor(VENDOR, proposedWallet, approver);
    }

    // ============ Full lifecycle ============

    function test_full_approval_lifecycle_moves_the_payout_wallet() public {
        bytes32 requestId = _open();

        // Opening alone must not move the gate.
        (bool allowed,) = firewall.isPayoutAllowed(VENDOR, proposedWallet);
        assertFalse(allowed, "open must not unlock");

        bytes32 handle = _seal(requestId, "approve");
        assertEq(firewall.sealedApprovalHandle(requestId), handle);

        // Sealing alone must not move the gate either: the bit is still inside the TEE.
        (allowed,) = firewall.isPayoutAllowed(VENDOR, proposedWallet);
        assertFalse(allowed, "seal must not unlock");

        bool approved = firewall.settleApproval(requestId, _decryptionProof(handle, true));
        assertTrue(approved);

        (allowed,) = firewall.isPayoutAllowed(VENDOR, proposedWallet);
        assertTrue(allowed, "settled approval must unlock the new destination");

        // The old destination is now the one that needs approval.
        string memory reason;
        (allowed, reason) = firewall.isPayoutAllowed(VENDOR, payoutWallet);
        assertFalse(allowed);
        assertEq(reason, "APPROVAL_REQUIRED");

        assertEq(firewall.getVendor(VENDOR).payoutWallet, proposedWallet);
    }

    function test_decrypted_false_settles_as_rejected_and_leaves_wallet_untouched() public {
        bytes32 requestId = _open();
        bytes32 handle = _seal(requestId, "reject");

        bool approved = firewall.settleApproval(requestId, _decryptionProof(handle, false));
        assertFalse(approved);

        assertEq(firewall.getVendor(VENDOR).payoutWallet, payoutWallet);
        (bool allowed,) = firewall.isPayoutAllowed(VENDOR, proposedWallet);
        assertFalse(allowed);
        assertEq(uint8(firewall.getRequest(requestId).status), uint8(QeltrunPayoutFirewall.RequestStatus.Settled));
    }

    function test_request_id_matches_on_chain_derivation() public {
        bytes32 expected = firewall.deriveRequestId(VENDOR, payoutWallet, proposedWallet, requester, 1);
        assertEq(_open(), expected);
    }

    function test_settlement_is_permissionless_but_proof_bound() public {
        bytes32 requestId = _open();
        bytes32 handle = _seal(requestId, "relayer");

        // A relayer with no special standing can settle, because authority lives in the
        // gateway signature rather than in the caller.
        vm.prank(makeAddr("random-relayer"));
        assertTrue(firewall.settleApproval(requestId, _decryptionProof(handle, true)));
    }
}

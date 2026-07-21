// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {NoxLocalEnv} from "./NoxLocalEnv.sol";
import {QeltrunPayoutFirewall} from "../../contracts/QeltrunPayoutFirewall.sol";
import {INoxCompute} from "@iexec-nox/nox-protocol-contracts/contracts/interfaces/INoxCompute.sol";
import {externalEbool} from "encrypted-types/EncryptedTypes.sol";

/// @notice The attack matrix. Every test here is an attempt to move a vendor's payout
///         destination without a genuine, current, correctly-bound approval.
///
/// @dev These run against the real NoxCompute (see {NoxLocalEnv}), so the reverts below are
///      produced by the actual protocol proof checks, not by a mock that was told to fail.
contract QeltrunPayoutFirewallAttackTest is NoxLocalEnv {
    QeltrunPayoutFirewall internal firewall;

    bytes32 internal constant VENDOR = keccak256("vendor:northwind-logistics");

    address internal payoutWallet;
    address internal attackerWallet;
    address internal approver;
    address internal attacker;
    uint256 internal attackerKey;

    function setUp() public {
        _bootstrapNox();
        firewall = new QeltrunPayoutFirewall();

        payoutWallet = makeAddr("payout-wallet");
        attackerWallet = makeAddr("attacker-wallet");
        approver = makeAddr("approver");
        (attacker, attackerKey) = makeAddrAndKey("attacker");

        firewall.registerVendor(VENDOR, payoutWallet, approver);
    }

    function _openToAttackerWallet() internal returns (bytes32) {
        vm.prank(attacker);
        return firewall.openChangeRequest(VENDOR, attackerWallet, 1);
    }

    function _assertWalletUnmoved() internal view {
        assertEq(firewall.getVendor(VENDOR).payoutWallet, payoutWallet, "payout wallet moved");
        (bool allowed,) = firewall.isPayoutAllowed(VENDOR, attackerWallet);
        assertFalse(allowed, "gate opened for attacker wallet");
    }

    // ============ 1. Authorization ============

    /// Attacker holds a perfectly valid Nox handle minted for themselves and this contract.
    /// The proof passes, but they are not the vendor's approver.
    function test_attack_non_approver_cannot_seal() public {
        bytes32 requestId = _openToAttackerWallet();
        bytes32 handle = _boolHandle("attacker-owned");
        bytes memory proof = _inputProof(handle, attacker, address(firewall));

        vm.expectRevert(
            abi.encodeWithSelector(QeltrunPayoutFirewall.UnauthorizedApprover.selector, VENDOR, attacker)
        );
        vm.prank(attacker);
        firewall.sealApproval(requestId, externalEbool.wrap(handle), proof);

        _assertWalletUnmoved();
    }

    // ============ 2. Proof binding ============

    /// The approver's own wallet, but the handle was minted for a *different* application
    /// contract. NoxCompute compares the app in the proof against `msg.sender`.
    function test_attack_proof_minted_for_another_contract_is_rejected() public {
        bytes32 requestId = _openToAttackerWallet();
        address rogueApp = makeAddr("rogue-app");
        bytes32 handle = _boolHandle("wrong-app");
        bytes memory proof = _inputProof(handle, approver, rogueApp);

        vm.expectRevert(abi.encodeWithSelector(INoxCompute.InvalidProof.selector, proof, "App mismatch"));
        vm.prank(approver);
        firewall.sealApproval(requestId, externalEbool.wrap(handle), proof);

        _assertWalletUnmoved();
    }

    /// A handle minted for someone else cannot be submitted by the approver: the contract
    /// asks NoxCompute to check ownership against `msg.sender`.
    function test_attack_proof_minted_for_another_owner_is_rejected() public {
        bytes32 requestId = _openToAttackerWallet();
        bytes32 handle = _boolHandle("wrong-owner");
        bytes memory proof = _inputProof(handle, attacker, address(firewall));

        vm.expectRevert(abi.encodeWithSelector(INoxCompute.InvalidProof.selector, proof, "Owner mismatch"));
        vm.prank(approver);
        firewall.sealApproval(requestId, externalEbool.wrap(handle), proof);

        _assertWalletUnmoved();
    }

    /// Signature forged with the attacker's key instead of the Nox gateway's.
    function test_attack_forged_gateway_signature_is_rejected() public {
        bytes32 requestId = _openToAttackerWallet();
        bytes32 handle = _boolHandle("forged-sig");
        bytes memory proof = _inputProof(handle, approver, address(firewall), attackerKey);

        vm.expectRevert(abi.encodeWithSelector(INoxCompute.InvalidProof.selector, proof, "Invalid signature"));
        vm.prank(approver);
        firewall.sealApproval(requestId, externalEbool.wrap(handle), proof);

        _assertWalletUnmoved();
    }

    /// Proofs expire. An approval sealed off-chain and sat on for a day is worthless.
    function test_attack_expired_proof_is_rejected() public {
        bytes32 requestId = _openToAttackerWallet();
        bytes32 handle = _boolHandle("expired");
        bytes memory proof = _inputProof(handle, approver, address(firewall));

        vm.warp(block.timestamp + 2 hours);

        vm.expectRevert(abi.encodeWithSelector(INoxCompute.InvalidProof.selector, proof, "Proof expired"));
        vm.prank(approver);
        firewall.sealApproval(requestId, externalEbool.wrap(handle), proof);

        _assertWalletUnmoved();
    }

    /// Handle carrying a foreign chain id in bytes 1-4.
    function test_attack_handle_from_another_chain_is_rejected() public {
        bytes32 requestId = _openToAttackerWallet();

        // Mint a handle while the VM reports a different chain, then restore.
        uint256 localChain = block.chainid;
        vm.chainId(1);
        bytes32 foreignHandle = _boolHandle("foreign-chain");
        vm.chainId(localChain);

        bytes memory proof = _inputProof(foreignHandle, approver, address(firewall));

        vm.expectRevert(abi.encodeWithSelector(INoxCompute.InvalidProof.selector, proof, "Handle chain id mismatch"));
        vm.prank(approver);
        firewall.sealApproval(requestId, externalEbool.wrap(foreignHandle), proof);

        _assertWalletUnmoved();
    }

    // ============ 3. Replay ============

    /// A Nox input proof binds handle/owner/app but says nothing about which request it
    /// approves. The contract closes that gap with a one-shot handle ledger.
    function test_attack_sealed_handle_cannot_be_replayed_onto_a_second_request() public {
        address benignWallet = makeAddr("benign-wallet");

        vm.prank(attacker);
        bytes32 benignRequest = firewall.openChangeRequest(VENDOR, benignWallet, 1);

        bytes32 handle = _boolHandle("replay");
        bytes memory proof = _inputProof(handle, approver, address(firewall));
        vm.prank(approver);
        firewall.sealApproval(benignRequest, externalEbool.wrap(handle), proof);

        // Same approval, pointed at the attacker's wallet instead.
        vm.prank(attacker);
        bytes32 attackRequest = firewall.openChangeRequest(VENDOR, attackerWallet, 2);

        vm.expectRevert(
            abi.encodeWithSelector(QeltrunPayoutFirewall.HandleAlreadyUsed.selector, handle, benignRequest)
        );
        vm.prank(approver);
        firewall.sealApproval(attackRequest, externalEbool.wrap(handle), proof);

        assertEq(firewall.handleUsedBy(handle), benignRequest);
        _assertWalletUnmoved();
    }

    /// The same change cannot be opened twice, so a settled request id can never be revived.
    function test_attack_duplicate_request_cannot_be_reopened() public {
        bytes32 requestId = _openToAttackerWallet();

        vm.expectRevert(
            abi.encodeWithSelector(QeltrunPayoutFirewall.RequestAlreadyExists.selector, requestId)
        );
        vm.prank(attacker);
        firewall.openChangeRequest(VENDOR, attackerWallet, 1);
    }

    /// Request ids are derived from `address(this)`, so a request opened against a second
    /// deployment of the same contract does not exist on the first.
    function test_attack_request_id_does_not_cross_deployments() public {
        bytes32 requestId = _openToAttackerWallet();

        QeltrunPayoutFirewall other = new QeltrunPayoutFirewall();
        other.registerVendor(VENDOR, payoutWallet, approver);
        vm.prank(attacker);
        bytes32 otherRequestId = other.openChangeRequest(VENDOR, attackerWallet, 1);

        assertTrue(requestId != otherRequestId, "request id must be deployment-bound");
    }

    // ============ 4. Settlement ============

    /// A decryption proof is signed over a specific handle. One issued for a different
    /// handle does not verify against the request's sealed approval.
    function test_attack_decryption_proof_for_another_handle_is_rejected() public {
        bytes32 requestId = _openToAttackerWallet();
        bytes32 handle = _boolHandle("real");
        bytes memory proof = _inputProof(handle, approver, address(firewall));
        vm.prank(approver);
        firewall.sealApproval(requestId, externalEbool.wrap(handle), proof);

        bytes memory wrongProof = _decryptionProof(_boolHandle("other"), true);

        vm.expectRevert(abi.encodeWithSelector(INoxCompute.InvalidProof.selector, wrongProof, "Invalid signature"));
        firewall.settleApproval(requestId, wrongProof);

        _assertWalletUnmoved();
    }

    /// Decryption proof signed by the attacker rather than the gateway.
    function test_attack_forged_decryption_proof_is_rejected() public {
        bytes32 requestId = _openToAttackerWallet();
        bytes32 handle = _boolHandle("forge-decrypt");
        bytes memory proof = _inputProof(handle, approver, address(firewall));
        vm.prank(approver);
        firewall.sealApproval(requestId, externalEbool.wrap(handle), proof);

        bytes memory forged = _decryptionProof(handle, true, attackerKey);

        vm.expectRevert(abi.encodeWithSelector(INoxCompute.InvalidProof.selector, forged, "Invalid signature"));
        firewall.settleApproval(requestId, forged);

        _assertWalletUnmoved();
    }

    /// Settlement without a sealed approval is refused outright.
    function test_attack_cannot_settle_an_unsealed_request() public {
        bytes32 requestId = _openToAttackerWallet();
        bytes memory proof = _decryptionProof(_boolHandle("nothing"), true);

        vm.expectRevert(
            abi.encodeWithSelector(
                QeltrunPayoutFirewall.RequestNotSealed.selector,
                requestId,
                QeltrunPayoutFirewall.RequestStatus.Pending
            )
        );
        firewall.settleApproval(requestId, proof);

        _assertWalletUnmoved();
    }

    /// A settled request cannot be settled again.
    function test_attack_cannot_settle_twice() public {
        bytes32 requestId = _openToAttackerWallet();
        bytes32 handle = _boolHandle("double-settle");
        bytes memory inputProof = _inputProof(handle, approver, address(firewall));
        vm.prank(approver);
        firewall.sealApproval(requestId, externalEbool.wrap(handle), inputProof);

        bytes memory decryptionProof = _decryptionProof(handle, false);
        firewall.settleApproval(requestId, decryptionProof);

        vm.expectRevert(
            abi.encodeWithSelector(
                QeltrunPayoutFirewall.RequestNotSealed.selector,
                requestId,
                QeltrunPayoutFirewall.RequestStatus.Settled
            )
        );
        firewall.settleApproval(requestId, decryptionProof);

        _assertWalletUnmoved();
    }

    /// A rejected request cannot be re-sealed with a fresh "yes".
    function test_attack_cannot_reseal_a_settled_request() public {
        bytes32 requestId = _openToAttackerWallet();
        bytes32 handle = _boolHandle("reseal-first");
        vm.prank(approver);
        firewall.sealApproval(
            requestId, externalEbool.wrap(handle), _inputProof(handle, approver, address(firewall))
        );
        firewall.settleApproval(requestId, _decryptionProof(handle, false));

        bytes32 secondHandle = _boolHandle("reseal-second");
        bytes memory secondProof = _inputProof(secondHandle, approver, address(firewall));

        vm.expectRevert(
            abi.encodeWithSelector(
                QeltrunPayoutFirewall.RequestNotPending.selector,
                requestId,
                QeltrunPayoutFirewall.RequestStatus.Settled
            )
        );
        vm.prank(approver);
        firewall.sealApproval(requestId, externalEbool.wrap(secondHandle), secondProof);

        _assertWalletUnmoved();
    }

    // ============ 5. Time-of-check / time-of-use ============

    /// Two requests are opened while the wallet is X. One settles and moves the wallet to Y.
    /// The other still describes the X -> Z transition, which no longer exists, so it must
    /// not be applicable. Without this check a stale approval could silently override a
    /// newer, legitimate one.
    function test_attack_stale_request_cannot_override_a_newer_settlement() public {
        address legitWallet = makeAddr("legit-new-wallet");

        vm.prank(attacker);
        bytes32 staleRequest = firewall.openChangeRequest(VENDOR, attackerWallet, 1);
        vm.prank(attacker);
        bytes32 freshRequest = firewall.openChangeRequest(VENDOR, legitWallet, 2);

        bytes32 staleHandle = _boolHandle("stale");
        vm.prank(approver);
        firewall.sealApproval(
            staleRequest, externalEbool.wrap(staleHandle), _inputProof(staleHandle, approver, address(firewall))
        );

        bytes32 freshHandle = _boolHandle("fresh");
        vm.prank(approver);
        firewall.sealApproval(
            freshRequest, externalEbool.wrap(freshHandle), _inputProof(freshHandle, approver, address(firewall))
        );

        firewall.settleApproval(freshRequest, _decryptionProof(freshHandle, true));
        assertEq(firewall.getVendor(VENDOR).payoutWallet, legitWallet);

        bytes memory staleDecryption = _decryptionProof(staleHandle, true);
        vm.expectRevert(
            abi.encodeWithSelector(
                QeltrunPayoutFirewall.StaleRequest.selector, staleRequest, payoutWallet, legitWallet
            )
        );
        firewall.settleApproval(staleRequest, staleDecryption);

        assertEq(firewall.getVendor(VENDOR).payoutWallet, legitWallet, "stale approval overrode a newer one");
        (bool allowed,) = firewall.isPayoutAllowed(VENDOR, attackerWallet);
        assertFalse(allowed);
    }

    // ============ 6. Input validation ============

    function test_attack_cannot_open_request_for_unregistered_vendor() public {
        bytes32 ghost = keccak256("vendor:does-not-exist");
        vm.expectRevert(abi.encodeWithSelector(QeltrunPayoutFirewall.VendorNotRegistered.selector, ghost));
        vm.prank(attacker);
        firewall.openChangeRequest(ghost, attackerWallet, 1);
    }

    function test_attack_cannot_seal_an_unknown_request() public {
        bytes32 ghostRequest = keccak256("request:does-not-exist");
        bytes32 handle = _boolHandle("ghost");
        bytes memory proof = _inputProof(handle, approver, address(firewall));

        vm.expectRevert(abi.encodeWithSelector(QeltrunPayoutFirewall.RequestNotFound.selector, ghostRequest));
        vm.prank(approver);
        firewall.sealApproval(ghostRequest, externalEbool.wrap(handle), proof);
    }

    function test_attack_cannot_route_a_change_to_the_zero_address() public {
        vm.expectRevert(QeltrunPayoutFirewall.ZeroAddress.selector);
        vm.prank(attacker);
        firewall.openChangeRequest(VENDOR, address(0), 1);
    }

    function test_attack_cannot_hijack_a_vendor_by_re_registering_it() public {
        vm.expectRevert(abi.encodeWithSelector(QeltrunPayoutFirewall.VendorAlreadyRegistered.selector, VENDOR));
        vm.prank(attacker);
        firewall.registerVendor(VENDOR, attackerWallet, attacker);

        _assertWalletUnmoved();
        assertEq(firewall.getVendor(VENDOR).approver, approver);
    }
}

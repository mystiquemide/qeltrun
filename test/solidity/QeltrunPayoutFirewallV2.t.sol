// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {NoxLocalEnv} from "./NoxLocalEnv.sol";
import {QeltrunPayoutFirewallV2} from "../../contracts/QeltrunPayoutFirewallV2.sol";
import {INoxCompute} from "@iexec-nox/nox-protocol-contracts/contracts/interfaces/INoxCompute.sol";
import {externalEuint16} from "encrypted-types/EncryptedTypes.sol";

contract QeltrunPayoutFirewallV2Test is NoxLocalEnv {
    QeltrunPayoutFirewallV2 internal firewall;

    bytes32 internal constant VENDOR = keccak256("vendor:northwind-logistics");
    address internal payoutWallet;
    address internal proposedWallet;
    address internal approver;
    address internal treasuryReviewer;
    address internal riskReviewer;
    address internal requester;
    address internal attacker;
    uint256 internal attackerKey;

    function setUp() public {
        _bootstrapNox();
        firewall = new QeltrunPayoutFirewallV2(address(this));
        payoutWallet = makeAddr("payout-wallet");
        proposedWallet = makeAddr("proposed-wallet");
        approver = makeAddr("approver");
        treasuryReviewer = makeAddr("treasury-reviewer");
        riskReviewer = makeAddr("risk-reviewer");
        requester = makeAddr("requester");
        (attacker, attackerKey) = makeAddrAndKey("attacker");
        firewall.registerVendor(VENDOR, payoutWallet, approver, treasuryReviewer, riskReviewer);
    }

    function _open(address destination, uint256 nonce) internal returns (bytes32) {
        vm.prank(requester);
        return firewall.openChangeRequest(VENDOR, destination, nonce);
    }

    function _signal(bytes32 requestId, address reviewer, string memory salt) internal returns (bytes32 handle) {
        handle = _uint16Handle(salt);
        vm.prank(reviewer);
        firewall.submitPrivateSignal(
            requestId,
            externalEuint16.wrap(handle),
            _inputProof(handle, reviewer, address(firewall))
        );
    }

    function _seal(bytes32 requestId) internal returns (bytes32 verdict) {
        string memory requestSalt = vm.toString(requestId);
        _signal(requestId, approver, string.concat("approver/", requestSalt));
        _signal(requestId, treasuryReviewer, string.concat("treasury/", requestSalt));
        _signal(requestId, riskReviewer, string.concat("risk/", requestSalt));
        verdict = firewall.verdictHandle(requestId);
    }

    function test_three_private_signals_seal_only_the_final_verdict() public {
        bytes32 requestId = _open(proposedWallet, 1);
        bytes32 rawApprover = _signal(requestId, approver, "private-approver");
        bytes32 rawTreasury = _signal(requestId, treasuryReviewer, "private-treasury");
        bytes32 rawRisk = _signal(requestId, riskReviewer, "private-risk");
        bytes32 aggregate = firewall.aggregateScoreHandle(requestId);
        bytes32 verdict = firewall.verdictHandle(requestId);

        assertFalse(nox.isPubliclyDecryptable(rawApprover));
        assertFalse(nox.isPubliclyDecryptable(rawTreasury));
        assertFalse(nox.isPubliclyDecryptable(rawRisk));
        assertFalse(nox.isPubliclyDecryptable(aggregate));
        assertTrue(nox.isPubliclyDecryptable(verdict));
        assertEq(
            uint8(firewall.getRequest(requestId).status),
            uint8(QeltrunPayoutFirewallV2.RequestStatus.Sealed)
        );
    }

    function test_approved_verdict_moves_wallet_and_rejected_verdict_does_not() public {
        bytes32 approvedRequest = _open(proposedWallet, 1);
        bytes32 approvedVerdict = _seal(approvedRequest);
        assertTrue(firewall.settleApproval(approvedRequest, _decryptionProof(approvedVerdict, true)));
        assertEq(firewall.getPayoutWallet(VENDOR), proposedWallet);

        address rejectedWallet = makeAddr("rejected-wallet");
        bytes32 rejectedRequest = _open(rejectedWallet, 2);
        bytes32 rejectedVerdict = _seal(rejectedRequest);
        assertFalse(firewall.settleApproval(rejectedRequest, _decryptionProof(rejectedVerdict, false)));
        assertEq(firewall.getPayoutWallet(VENDOR), proposedWallet);
    }

    function test_request_id_is_bound_to_epoch_chain_and_deployment() public {
        bytes32 requestId = _open(proposedWallet, 9);
        bytes32 expected = firewall.deriveRequestId(VENDOR, payoutWallet, proposedWallet, requester, 9, 1);
        assertEq(requestId, expected);

        QeltrunPayoutFirewallV2 other = new QeltrunPayoutFirewallV2(address(this));
        assertTrue(
            requestId != other.deriveRequestId(VENDOR, payoutWallet, proposedWallet, requester, 9, 1)
        );
    }

    function test_unauthorized_and_duplicate_reviewers_are_rejected() public {
        bytes32 requestId = _open(proposedWallet, 1);
        bytes32 attackerHandle = _uint16Handle("attacker");
        vm.expectRevert(
            abi.encodeWithSelector(QeltrunPayoutFirewallV2.UnauthorizedReviewer.selector, VENDOR, attacker)
        );
        vm.prank(attacker);
        firewall.submitPrivateSignal(
            requestId,
            externalEuint16.wrap(attackerHandle),
            _inputProof(attackerHandle, attacker, address(firewall))
        );

        _signal(requestId, approver, "duplicate");
        bytes32 secondHandle = _uint16Handle("duplicate-second");
        vm.expectRevert(
            abi.encodeWithSelector(
                QeltrunPayoutFirewallV2.SignalAlreadySubmitted.selector, requestId, approver
            )
        );
        vm.prank(approver);
        firewall.submitPrivateSignal(
            requestId,
            externalEuint16.wrap(secondHandle),
            _inputProof(secondHandle, approver, address(firewall))
        );
    }

    function test_nox_proof_owner_app_and_gateway_are_enforced() public {
        bytes32 requestId = _open(proposedWallet, 1);
        bytes32 handle = _uint16Handle("proof-binding");

        bytes memory wrongOwner = _inputProof(handle, attacker, address(firewall));
        vm.expectRevert(abi.encodeWithSelector(INoxCompute.InvalidProof.selector, wrongOwner, "Owner mismatch"));
        vm.prank(approver);
        firewall.submitPrivateSignal(requestId, externalEuint16.wrap(handle), wrongOwner);

        bytes memory wrongApp = _inputProof(handle, approver, attacker);
        vm.expectRevert(abi.encodeWithSelector(INoxCompute.InvalidProof.selector, wrongApp, "App mismatch"));
        vm.prank(approver);
        firewall.submitPrivateSignal(requestId, externalEuint16.wrap(handle), wrongApp);

        bytes memory forged = _inputProof(handle, approver, address(firewall), attackerKey);
        vm.expectRevert(abi.encodeWithSelector(INoxCompute.InvalidProof.selector, forged, "Invalid signature"));
        vm.prank(approver);
        firewall.submitPrivateSignal(requestId, externalEuint16.wrap(handle), forged);
    }

    function test_handle_replay_is_rejected_across_requests() public {
        bytes32 first = _open(proposedWallet, 1);
        bytes32 handle = _signal(first, approver, "replay");
        address otherWallet = makeAddr("other-wallet");
        bytes32 second = _open(otherWallet, 2);

        vm.expectRevert(
            abi.encodeWithSelector(QeltrunPayoutFirewallV2.HandleAlreadyUsed.selector, handle, first)
        );
        vm.prank(treasuryReviewer);
        firewall.submitPrivateSignal(
            second,
            externalEuint16.wrap(handle),
            _inputProof(handle, treasuryReviewer, address(firewall))
        );
    }

    function test_reviewer_change_invalidates_collecting_and_sealed_requests() public {
        bytes32 collecting = _open(proposedWallet, 1);
        _signal(collecting, approver, "stale-collecting");
        address nextTreasury = makeAddr("next-treasury");
        firewall.setOperationalReviewers(VENDOR, nextTreasury, riskReviewer);

        bytes32 handle = _uint16Handle("stale-submit");
        vm.expectRevert(
            abi.encodeWithSelector(QeltrunPayoutFirewallV2.StaleApproverEpoch.selector, collecting, 1, 2)
        );
        vm.prank(riskReviewer);
        firewall.submitPrivateSignal(
            collecting,
            externalEuint16.wrap(handle),
            _inputProof(handle, riskReviewer, address(firewall))
        );

        bytes32 sealedRequest = _open(proposedWallet, 2);
        _signal(sealedRequest, approver, "fresh-approver");
        _signal(sealedRequest, nextTreasury, "fresh-treasury");
        _signal(sealedRequest, riskReviewer, "fresh-risk");
        bytes32 verdict = firewall.verdictHandle(sealedRequest);
        firewall.setOperationalReviewers(VENDOR, treasuryReviewer, riskReviewer);
        vm.expectRevert(
            abi.encodeWithSelector(
                QeltrunPayoutFirewallV2.StaleApproverEpoch.selector, sealedRequest, 2, 3
            )
        );
        firewall.settleApproval(sealedRequest, _decryptionProof(verdict, true));
    }

    function test_concurrent_approved_request_cannot_overwrite_changed_wallet() public {
        bytes32 first = _open(proposedWallet, 1);
        address secondWallet = makeAddr("second-wallet");
        bytes32 second = _open(secondWallet, 2);
        bytes32 firstVerdict = _seal(first);

        _signal(second, approver, "second-approver");
        _signal(second, treasuryReviewer, "second-treasury");
        _signal(second, riskReviewer, "second-risk");
        bytes32 secondVerdict = firewall.verdictHandle(second);

        firewall.settleApproval(first, _decryptionProof(firstVerdict, true));
        vm.expectRevert(
            abi.encodeWithSelector(
                QeltrunPayoutFirewallV2.StaleRequest.selector, second, payoutWallet, proposedWallet
            )
        );
        firewall.settleApproval(second, _decryptionProof(secondVerdict, true));
    }

    function test_pause_closes_gate_and_blocks_mutating_lifecycle() public {
        firewall.pause();
        (bool allowed, string memory reason) = firewall.isPayoutAllowed(VENDOR, payoutWallet);
        assertFalse(allowed);
        assertEq(reason, "FIREWALL_PAUSED");

        vm.expectRevert();
        _open(proposedWallet, 1);
        firewall.unpause();
        (allowed,) = firewall.isPayoutAllowed(VENDOR, payoutWallet);
        assertTrue(allowed);
    }

    function testFuzz_request_ids_change_with_nonce_and_epoch(uint256 firstNonce, uint256 secondNonce)
        public
        view
    {
        vm.assume(firstNonce != secondNonce);
        bytes32 first = firewall.deriveRequestId(
            VENDOR, payoutWallet, proposedWallet, requester, firstNonce, 1
        );
        bytes32 second = firewall.deriveRequestId(
            VENDOR, payoutWallet, proposedWallet, requester, secondNonce, 1
        );
        bytes32 nextEpoch = firewall.deriveRequestId(
            VENDOR, payoutWallet, proposedWallet, requester, firstNonce, 2
        );
        assertTrue(first != second);
        assertTrue(first != nextEpoch);
    }

    function testFuzz_gate_never_allows_an_unapproved_destination(address destination) public view {
        vm.assume(destination != payoutWallet);
        (bool allowed,) = firewall.isPayoutAllowed(VENDOR, destination);
        assertFalse(allowed);
    }
}

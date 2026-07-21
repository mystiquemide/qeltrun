// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {NoxLocalEnv} from "./NoxLocalEnv.sol";
import {QeltrunPayoutFirewallV2} from "../../contracts/QeltrunPayoutFirewallV2.sol";

contract QeltrunPayoutFirewallV2GovernanceTest is NoxLocalEnv {
    QeltrunPayoutFirewallV2 internal firewall;
    bytes32 internal constant VENDOR = keccak256("vendor:northwind-logistics");
    address internal payoutWallet;
    address internal approver;
    address internal treasuryReviewer;
    address internal riskReviewer;
    address internal candidate;

    function setUp() public {
        _bootstrapNox();
        firewall = new QeltrunPayoutFirewallV2(address(this));
        payoutWallet = makeAddr("payout-wallet");
        approver = makeAddr("approver");
        treasuryReviewer = makeAddr("treasury-reviewer");
        riskReviewer = makeAddr("risk-reviewer");
        candidate = makeAddr("candidate");
        firewall.registerVendor(VENDOR, payoutWallet, approver, treasuryReviewer, riskReviewer);
    }

    function test_normal_rotation_requires_current_approval_and_candidate_acceptance() public {
        firewall.proposeApproverRotation(VENDOR, candidate);
        vm.prank(candidate);
        firewall.acceptApproverRotation(VENDOR);
        assertEq(firewall.getVendor(VENDOR).approver, approver);

        vm.prank(approver);
        firewall.approveApproverRotation(VENDOR, candidate);
        assertEq(firewall.getVendor(VENDOR).approver, candidate);
        assertEq(firewall.getVendor(VENDOR).approverEpoch, 2);
    }

    function test_current_approver_can_cancel_rotation_even_while_paused() public {
        firewall.proposeApproverRotation(VENDOR, candidate);
        firewall.pause();
        vm.prank(approver);
        firewall.cancelApproverRotation(VENDOR);
        assertEq(firewall.getApproverRotation(VENDOR).newApprover, address(0));
    }

    function test_rotation_and_recovery_reject_existing_reviewers() public {
        vm.expectRevert(QeltrunPayoutFirewallV2.InvalidReviewerSet.selector);
        firewall.proposeApproverRotation(VENDOR, treasuryReviewer);
        vm.expectRevert(QeltrunPayoutFirewallV2.InvalidReviewerSet.selector);
        firewall.scheduleApproverRecovery(VENDOR, riskReviewer);
    }

    function test_recovery_requires_candidate_acceptance_and_seven_day_delay() public {
        firewall.scheduleApproverRecovery(VENDOR, candidate);
        vm.warp(block.timestamp + firewall.RECOVERY_DELAY());
        vm.expectRevert(
            abi.encodeWithSelector(QeltrunPayoutFirewallV2.RecoveryCandidateNotAccepted.selector, VENDOR)
        );
        firewall.executeApproverRecovery(VENDOR);

        vm.prank(candidate);
        firewall.acceptApproverRecovery(VENDOR);
        firewall.executeApproverRecovery(VENDOR);
        assertEq(firewall.getVendor(VENDOR).approver, candidate);
        assertEq(firewall.getVendor(VENDOR).approverEpoch, 2);
    }

    function test_recovery_cannot_execute_early_and_current_approver_can_veto() public {
        firewall.scheduleApproverRecovery(VENDOR, candidate);
        vm.prank(candidate);
        firewall.acceptApproverRecovery(VENDOR);
        vm.expectRevert();
        firewall.executeApproverRecovery(VENDOR);

        firewall.pause();
        vm.prank(approver);
        firewall.vetoApproverRecovery(VENDOR);
        assertEq(firewall.getApproverRecovery(VENDOR).newApprover, address(0));
    }

    function test_ownership_transfer_requires_new_treasury_acceptance() public {
        address treasurySafe = makeAddr("treasury-safe");
        firewall.transferOwnership(treasurySafe);
        assertEq(firewall.owner(), address(this));
        assertEq(firewall.pendingOwner(), treasurySafe);
        vm.prank(treasurySafe);
        firewall.acceptOwnership();
        assertEq(firewall.owner(), treasurySafe);
    }
}

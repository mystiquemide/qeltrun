// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Test} from "forge-std/Test.sol";
import {QeltrunPayoutFirewall} from "../../contracts/QeltrunPayoutFirewall.sol";

/// @notice Cross-language conformance for the request-id derivation.
///
/// @dev The frontend seals approvals against an id it computes in TypeScript, while the
///      contract recomputes that id from the transaction. If the two encodings drift, every
///      seal would target a request that does not exist. This test and
///      `test/request-id.test.ts` are pinned to the same vector, so a change to either
///      implementation turns exactly one of them red.
contract RequestIdParityTest is Test {
    bytes32 internal constant VENDOR_ID = 0xfe8551dfbb91003d295270354cce2b6b94133f2dff360898e11a61edaa7df2fd;
    bytes32 internal constant EXPECTED_REQUEST_ID =
        0xed56ad482d904adff7f5248092a8b59c030beb539fbc1d915ddffc8a3747ea21;

    address internal constant CURRENT_WALLET = 0x1111111111111111111111111111111111111111;
    address internal constant PROPOSED_WALLET = 0x2222222222222222222222222222222222222222;
    address internal constant REQUESTED_BY = 0x3333333333333333333333333333333333333333;
    address internal constant FIREWALL = 0x4444444444444444444444444444444444444444;
    uint256 internal constant NONCE = 7;
    uint256 internal constant CHAIN_ID = 11155111;

    function test_vendor_id_matches_keccak_of_the_label() public pure {
        assertEq(keccak256(bytes("vendor:northwind-logistics")), VENDOR_ID);
    }

    function test_request_id_matches_the_typescript_vector() public {
        vm.chainId(CHAIN_ID);

        // `deriveRequestId` mixes in `address(this)`, so place the contract at the address
        // the TypeScript vector was computed against.
        QeltrunPayoutFirewall template = new QeltrunPayoutFirewall();
        vm.etch(FIREWALL, address(template).code);
        QeltrunPayoutFirewall firewall = QeltrunPayoutFirewall(FIREWALL);

        assertEq(
            firewall.deriveRequestId(VENDOR_ID, CURRENT_WALLET, PROPOSED_WALLET, REQUESTED_BY, NONCE),
            EXPECTED_REQUEST_ID
        );
    }
}

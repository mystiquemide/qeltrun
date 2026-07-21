// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {NoxLocalEnv} from "./NoxLocalEnv.sol";
import {QeltrunPayoutFirewall} from "../../contracts/QeltrunPayoutFirewall.sol";
import {externalEbool} from "encrypted-types/EncryptedTypes.sol";

/// @notice Fuzz and invariant coverage for the properties the attack matrix asserts by example.
///
/// @dev The hand-written attack matrix enumerates threats we thought of. These tests instead
///      state the properties that must hold for *any* input, so a case nobody imagined still
///      fails the build. The handler drives the contract through arbitrary interleavings of the
///      lifecycle, including callers and orderings that make no sense, and the invariants are
///      checked after every step.
contract QeltrunPayoutFirewallInvariantTest is NoxLocalEnv {
    FirewallHandler internal handler;
    QeltrunPayoutFirewall internal firewall;

    bytes32 internal constant VENDOR = keccak256("vendor:invariant");
    address internal constant ORIGINAL_WALLET = address(0xA11CE);

    function setUp() public {
        _bootstrapNox();
        firewall = new QeltrunPayoutFirewall();
        handler = new FirewallHandler(firewall, this, VENDOR, ORIGINAL_WALLET);

        targetContract(address(handler));
    }

    // ============ Invariants ============

    /// The gate allows exactly one address: the vendor's current payout wallet. Nothing the
    /// handler does may produce a second allowed destination.
    function invariant_gate_allows_only_the_current_payout_wallet() public view {
        address current = firewall.getVendor(VENDOR).payoutWallet;

        for (uint256 i = 0; i < handler.destinationCount(); i++) {
            address destination = handler.destinationAt(i);
            (bool allowed,) = firewall.isPayoutAllowed(VENDOR, destination);
            if (destination == current) {
                assertTrue(allowed, "current wallet must be allowed");
            } else {
                assertFalse(allowed, "only the current wallet may be allowed");
            }
        }
    }

    /// The payout wallet only ever equals a destination that some request settled as approved.
    /// If it holds any other value, something moved it without an approval.
    function invariant_payout_wallet_only_moves_via_an_approved_settlement() public view {
        address current = firewall.getVendor(VENDOR).payoutWallet;
        if (current == ORIGINAL_WALLET) return;

        assertTrue(handler.wasApprovedDestination(current), "wallet moved without an approval");
    }

    /// A handle is consumable by at most one request, which is what stops a sealed approval
    /// being replayed onto a different destination.
    function invariant_each_handle_binds_to_at_most_one_request() public view {
        for (uint256 i = 0; i < handler.handleCount(); i++) {
            bytes32 handle = handler.handleAt(i);
            bytes32 boundTo = firewall.handleUsedBy(handle);
            if (boundTo != bytes32(0)) {
                assertEq(handler.requestForHandle(handle), boundTo, "handle rebound to another request");
            }
        }
    }

    /// Settled is terminal. A request that has settled can never report another status.
    function invariant_settled_requests_stay_settled() public view {
        for (uint256 i = 0; i < handler.settledCount(); i++) {
            bytes32 requestId = handler.settledAt(i);
            assertEq(
                uint8(firewall.getRequest(requestId).status),
                uint8(QeltrunPayoutFirewall.RequestStatus.Settled),
                "settled request left the Settled state"
            );
        }
    }

    /// The vendor's approver is fixed at registration. Nothing in the lifecycle may change it.
    function invariant_approver_is_immutable() public view {
        assertEq(firewall.getVendor(VENDOR).approver, handler.approver(), "approver changed");
    }

    /// @notice Guards the invariant suite against being vacuous.
    ///
    /// @dev Three of the invariants above only say anything once a request has actually been
    ///      sealed and settled. An earlier version of this handler could never seal — it was not
    ///      the registered approver — so those invariants passed while observing nothing. This
    ///      drives the handler through one honest lifecycle and asserts it arrives.
    function test_handler_can_reach_a_settled_approval() public {
        address destination = address(0xBEEF);

        handler.openRequest(destination, 1);
        assertEq(handler.destinationCount(), 1, "handler could not open a request");

        handler.seal(0, true, false);
        assertEq(handler.handleCount(), 1, "handler could not seal an approval");

        handler.settle(0);
        assertEq(handler.settledCount(), 1, "handler could not settle an approval");

        assertEq(firewall.getVendor(VENDOR).payoutWallet, destination, "settlement did not move the wallet");
        assertTrue(handler.wasApprovedDestination(destination));
    }

    /// A proof minted for anyone other than the caller must be refused even though the caller
    /// is the registered approver.
    function test_handler_seal_with_a_foreign_owner_is_refused() public {
        handler.openRequest(address(0xCAFE), 2);
        handler.seal(0, true, true);

        assertEq(handler.handleCount(), 0, "a proof minted for another owner was accepted");
        assertEq(firewall.getVendor(VENDOR).payoutWallet, ORIGINAL_WALLET);
    }

    // ============ Bounded fuzz ============

    /// For any destination that is not the current wallet, the gate is shut and says so.
    function testFuzz_unapproved_destination_is_always_blocked(address destination) public view {
        address current = firewall.getVendor(VENDOR).payoutWallet;
        vm.assume(destination != current);
        vm.assume(destination != address(0));

        (bool allowed, string memory reason) = firewall.isPayoutAllowed(VENDOR, destination);
        assertFalse(allowed);
        assertEq(reason, "APPROVAL_REQUIRED");
    }

    /// An unregistered vendor is blocked whatever the destination — including the zero address,
    /// where a naive equality check against an unset payout wallet would wrongly allow.
    function testFuzz_unregistered_vendor_is_always_blocked(bytes32 vendorId, address destination)
        public
        view
    {
        vm.assume(vendorId != VENDOR);

        (bool allowed, string memory reason) = firewall.isPayoutAllowed(vendorId, destination);
        assertFalse(allowed);
        assertEq(reason, "VENDOR_NOT_REGISTERED");
    }

    /// Request ids separate any two distinct changes. Collisions would let one approval settle
    /// a request it was never issued for.
    function testFuzz_request_ids_are_distinct_for_distinct_changes(
        address proposedA,
        address proposedB,
        uint256 nonceA,
        uint256 nonceB
    ) public view {
        vm.assume(proposedA != proposedB || nonceA != nonceB);

        bytes32 idA = firewall.deriveRequestId(VENDOR, ORIGINAL_WALLET, proposedA, address(this), nonceA);
        bytes32 idB = firewall.deriveRequestId(VENDOR, ORIGINAL_WALLET, proposedB, address(this), nonceB);

        assertTrue(idA != idB, "distinct changes must have distinct request ids");
    }

    /// Only the registered approver can seal, for any caller the fuzzer picks.
    function testFuzz_only_the_approver_can_seal(address caller, uint256 salt) public {
        vm.assume(caller != handler.approver());
        vm.assume(caller != address(0));

        address destination = address(uint160(uint256(keccak256(abi.encode(salt)))));
        vm.assume(destination != address(0));
        vm.assume(destination != firewall.getVendor(VENDOR).payoutWallet);

        vm.prank(caller);
        bytes32 requestId = firewall.openChangeRequest(VENDOR, destination, salt);

        bytes32 handle = _boolHandle(string(abi.encodePacked("fuzz", salt)));
        bytes memory proof = _inputProof(handle, caller, address(firewall));

        vm.expectRevert(
            abi.encodeWithSelector(QeltrunPayoutFirewall.UnauthorizedApprover.selector, VENDOR, caller)
        );
        vm.prank(caller);
        firewall.sealApproval(requestId, externalEbool.wrap(handle), proof);

        assertEq(firewall.getVendor(VENDOR).payoutWallet, ORIGINAL_WALLET);
    }
}

/// @notice Drives the firewall through arbitrary lifecycle interleavings for the invariant runs.
///
/// @dev Every action swallows reverts on purpose. The fuzzer will constantly attempt illegal
///      transitions — settling an unsealed request, sealing twice, opening duplicates — and a
///      revert is the contract behaving correctly. What matters is that no *sequence* of calls,
///      legal or not, can break the invariants above.
contract FirewallHandler {
    QeltrunPayoutFirewall public immutable firewall;
    NoxLocalEnv private immutable env;
    bytes32 public immutable vendorId;
    address public immutable approver;

    address[] private _destinations;
    bytes32[] private _requests;
    bytes32[] private _handles;
    bytes32[] private _settled;

    mapping(bytes32 handle => bytes32 requestId) public requestForHandle;
    mapping(address destination => bool) public wasApprovedDestination;
    mapping(bytes32 requestId => bytes32 handle) private _handleForRequest;
    mapping(bytes32 requestId => address) private _destinationForRequest;

    uint256 private _salt;

    constructor(QeltrunPayoutFirewall firewall_, NoxLocalEnv env_, bytes32 vendorId_, address wallet) {
        firewall = firewall_;
        env = env_;
        vendorId = vendorId_;
        // The handler *is* the approver. It is the contract that calls `sealApproval`, so any
        // other approver would make every seal revert on authorization and leave the sealed and
        // settled invariants checking nothing but the initial state.
        approver = address(this);

        firewall.registerVendor(vendorId_, wallet, approver);
    }

    function destinationCount() external view returns (uint256) {
        return _destinations.length;
    }

    function destinationAt(uint256 index) external view returns (address) {
        return _destinations[index];
    }

    function handleCount() external view returns (uint256) {
        return _handles.length;
    }

    function handleAt(uint256 index) external view returns (bytes32) {
        return _handles[index];
    }

    function settledCount() external view returns (uint256) {
        return _settled.length;
    }

    function settledAt(uint256 index) external view returns (bytes32) {
        return _settled[index];
    }

    function openRequest(address destination, uint256 nonce) external {
        if (destination == address(0)) return;

        try firewall.openChangeRequest(vendorId, destination, nonce) returns (bytes32 requestId) {
            _destinations.push(destination);
            _requests.push(requestId);
            _destinationForRequest[requestId] = destination;
        } catch {}
    }

    /// @param wrongOwner when true, mint the proof for someone other than the caller. Those
    ///        attempts must fail on `owner == msg.sender`; the honest ones must succeed, or the
    ///        invariants below would never observe a sealed or settled request.
    function seal(uint256 requestIndex, bool approve, bool wrongOwner) external {
        if (_requests.length == 0) return;
        bytes32 requestId = _requests[requestIndex % _requests.length];

        address owner = wrongOwner ? address(uint160(uint256(keccak256(abi.encode(_salt))))) : address(this);
        bytes32 handle = env.mintBoolHandle(++_salt);
        bytes memory proof = env.buildInputProof(handle, owner, address(firewall));

        try firewall.sealApproval(requestId, externalEbool.wrap(handle), proof) {
            _handles.push(handle);
            requestForHandle[handle] = requestId;
            _handleForRequest[requestId] = handle;
            env.rememberPlaintext(handle, approve);
        } catch {}
    }

    /// Replays an already-consumed handle against another request. Must never succeed.
    function replayHandle(uint256 handleIndex, uint256 requestIndex) external {
        if (_handles.length == 0 || _requests.length == 0) return;
        bytes32 handle = _handles[handleIndex % _handles.length];
        bytes32 requestId = _requests[requestIndex % _requests.length];

        bytes memory proof = env.buildInputProof(handle, address(this), address(firewall));
        try firewall.sealApproval(requestId, externalEbool.wrap(handle), proof) {
            // Reaching here would mean one handle bound to two requests; the invariant catches it.
            requestForHandle[handle] = requestId;
        } catch {}
    }

    function settle(uint256 requestIndex) external {
        if (_requests.length == 0) return;
        bytes32 requestId = _requests[requestIndex % _requests.length];

        bytes32 handle = _handleForRequest[requestId];
        if (handle == bytes32(0)) return;

        bytes memory proof = env.buildDecryptionProof(handle, env.plaintextFor(handle));

        try firewall.settleApproval(requestId, proof) returns (bool approved) {
            _settled.push(requestId);
            if (approved) {
                wasApprovedDestination[_destinationForRequest[requestId]] = true;
            }
        } catch {}
    }

    /// Anyone may try to register the vendor again, or register over it with a new approver.
    function reregister(address payoutWallet, address newApprover) external {
        try firewall.registerVendor(vendorId, payoutWallet, newApprover) {} catch {}
    }
}

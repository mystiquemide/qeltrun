// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Nox} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {ebool, euint16, externalEuint16} from "encrypted-types/EncryptedTypes.sol";

/// @title QeltrunPayoutFirewallV2
/// @notice Multisignal, Nox-backed payout policy engine for treasury vendor changes.
/// @dev Three independent reviewers submit private 0/1 signals. Nox sanitizes and sums the
///      values confidentially. Only the aggregate all-approved verdict becomes public.
contract QeltrunPayoutFirewallV2 is Ownable2Step, Pausable, ReentrancyGuard {
    uint64 public constant RECOVERY_DELAY = 7 days;
    uint8 public constant REQUIRED_SIGNALS = 3;

    enum RequestStatus {
        None,
        Collecting,
        Sealed,
        Settled
    }

    struct Vendor {
        address payoutWallet;
        address approver;
        address treasuryReviewer;
        address riskReviewer;
        uint64 approverEpoch;
        bool registered;
    }

    struct ChangeRequest {
        bytes32 vendorId;
        euint16 aggregateScore;
        ebool verdict;
        address currentWallet;
        address proposedWallet;
        address requestedBy;
        uint256 nonce;
        uint64 approverEpoch;
        RequestStatus status;
        uint8 signalCount;
        bool approved;
    }

    struct ApproverRotation {
        address newApprover;
        bool currentApproved;
        bool candidateAccepted;
    }

    struct ApproverRecovery {
        address newApprover;
        uint64 executeAfter;
        bool candidateAccepted;
    }

    mapping(bytes32 vendorId => Vendor) private _vendors;
    mapping(bytes32 requestId => ChangeRequest) private _requests;
    mapping(bytes32 requestId => mapping(address reviewer => bool submitted)) private _signalSubmitted;
    mapping(bytes32 handle => bytes32 requestId) private _handleUsedBy;
    mapping(bytes32 vendorId => ApproverRotation) private _rotations;
    mapping(bytes32 vendorId => ApproverRecovery) private _recoveries;

    event VendorRegistered(
        bytes32 indexed vendorId,
        address indexed payoutWallet,
        address indexed approver,
        address treasuryReviewer,
        address riskReviewer
    );
    event OperationalReviewersChanged(
        bytes32 indexed vendorId,
        address indexed treasuryReviewer,
        address indexed riskReviewer,
        uint64 approverEpoch
    );
    event ChangeRequestOpened(
        bytes32 indexed requestId,
        bytes32 indexed vendorId,
        address indexed proposedWallet,
        address requestedBy,
        uint256 nonce,
        uint64 approverEpoch
    );
    event PrivateSignalSubmitted(bytes32 indexed requestId, address indexed reviewer, bytes32 indexed handle);
    event AggregateVerdictSealed(bytes32 indexed requestId, bytes32 indexed verdictHandle);
    event ApprovalSettled(bytes32 indexed requestId, bool indexed approved);
    event PayoutWalletChanged(bytes32 indexed vendorId, address indexed previousWallet, address indexed newWallet);
    event ApproverRotationProposed(bytes32 indexed vendorId, address indexed currentApprover, address indexed newApprover);
    event ApproverRotationApproved(bytes32 indexed vendorId, address indexed currentApprover);
    event ApproverRotationAccepted(bytes32 indexed vendorId, address indexed newApprover);
    event ApproverRotationCancelled(bytes32 indexed vendorId, address indexed cancelledBy);
    event ApproverChanged(bytes32 indexed vendorId, address indexed previousApprover, address indexed newApprover, uint64 approverEpoch);
    event ApproverRecoveryScheduled(bytes32 indexed vendorId, address indexed newApprover, uint64 executeAfter);
    event ApproverRecoveryAccepted(bytes32 indexed vendorId, address indexed newApprover);
    event ApproverRecoveryCancelled(bytes32 indexed vendorId, address indexed cancelledBy);

    error ZeroAddress();
    error ZeroVendorId();
    error VendorAlreadyRegistered(bytes32 vendorId);
    error VendorNotRegistered(bytes32 vendorId);
    error InvalidReviewerSet();
    error DestinationUnchanged(bytes32 vendorId, address proposedWallet);
    error RequestAlreadyExists(bytes32 requestId);
    error RequestNotFound(bytes32 requestId);
    error RequestNotCollecting(bytes32 requestId, RequestStatus status);
    error RequestNotSealed(bytes32 requestId, RequestStatus status);
    error UnauthorizedReviewer(bytes32 vendorId, address caller);
    error SignalAlreadySubmitted(bytes32 requestId, address reviewer);
    error UninitializedHandle();
    error HandleAlreadyUsed(bytes32 handle, bytes32 requestId);
    error StaleRequest(bytes32 requestId, address expectedWallet, address actualWallet);
    error StaleApproverEpoch(bytes32 requestId, uint64 expectedEpoch, uint64 actualEpoch);
    error RotationAlreadyPending(bytes32 vendorId);
    error RotationNotPending(bytes32 vendorId);
    error RotationCandidateMismatch(bytes32 vendorId, address expected, address actual);
    error UnauthorizedRotationCancellation(bytes32 vendorId, address caller);
    error RecoveryAlreadyPending(bytes32 vendorId);
    error RecoveryNotPending(bytes32 vendorId);
    error RecoveryNotReady(bytes32 vendorId, uint64 executeAfter);
    error RecoveryCandidateNotAccepted(bytes32 vendorId);

    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
    }

    function registerVendor(
        bytes32 vendorId,
        address payoutWallet,
        address approver,
        address treasuryReviewer,
        address riskReviewer
    ) external onlyOwner whenNotPaused {
        if (vendorId == bytes32(0)) revert ZeroVendorId();
        if (_vendors[vendorId].registered) revert VendorAlreadyRegistered(vendorId);
        _validateReviewers(payoutWallet, approver, treasuryReviewer, riskReviewer);

        _vendors[vendorId] = Vendor({
            payoutWallet: payoutWallet,
            approver: approver,
            treasuryReviewer: treasuryReviewer,
            riskReviewer: riskReviewer,
            approverEpoch: 1,
            registered: true
        });

        emit VendorRegistered(vendorId, payoutWallet, approver, treasuryReviewer, riskReviewer);
    }

    function setOperationalReviewers(bytes32 vendorId, address treasuryReviewer, address riskReviewer)
        external
        onlyOwner
        whenNotPaused
    {
        Vendor storage vendor = _registeredVendor(vendorId);
        _validateReviewers(vendor.payoutWallet, vendor.approver, treasuryReviewer, riskReviewer);
        vendor.treasuryReviewer = treasuryReviewer;
        vendor.riskReviewer = riskReviewer;
        vendor.approverEpoch++;
        emit OperationalReviewersChanged(vendorId, treasuryReviewer, riskReviewer, vendor.approverEpoch);
    }

    function openChangeRequest(bytes32 vendorId, address proposedWallet, uint256 nonce)
        external
        whenNotPaused
        returns (bytes32 requestId)
    {
        Vendor storage vendor = _registeredVendor(vendorId);
        if (proposedWallet == address(0)) revert ZeroAddress();
        if (proposedWallet == vendor.payoutWallet) revert DestinationUnchanged(vendorId, proposedWallet);

        requestId = deriveRequestId(
            vendorId,
            vendor.payoutWallet,
            proposedWallet,
            msg.sender,
            nonce,
            vendor.approverEpoch
        );
        if (_requests[requestId].status != RequestStatus.None) revert RequestAlreadyExists(requestId);

        _requests[requestId] = ChangeRequest({
            vendorId: vendorId,
            aggregateScore: euint16.wrap(bytes32(0)),
            verdict: ebool.wrap(bytes32(0)),
            currentWallet: vendor.payoutWallet,
            proposedWallet: proposedWallet,
            requestedBy: msg.sender,
            nonce: nonce,
            approverEpoch: vendor.approverEpoch,
            status: RequestStatus.Collecting,
            signalCount: 0,
            approved: false
        });

        emit ChangeRequestOpened(
            requestId,
            vendorId,
            proposedWallet,
            msg.sender,
            nonce,
            vendor.approverEpoch
        );
    }

    function submitPrivateSignal(bytes32 requestId, externalEuint16 encryptedSignal, bytes calldata handleProof)
        external
        whenNotPaused
        nonReentrant
    {
        ChangeRequest storage request = _requests[requestId];
        if (request.status == RequestStatus.None) revert RequestNotFound(requestId);
        if (request.status != RequestStatus.Collecting) revert RequestNotCollecting(requestId, request.status);

        Vendor storage vendor = _vendors[request.vendorId];
        if (!_isReviewer(vendor, msg.sender)) revert UnauthorizedReviewer(request.vendorId, msg.sender);
        if (_signalSubmitted[requestId][msg.sender]) revert SignalAlreadySubmitted(requestId, msg.sender);
        if (vendor.approverEpoch != request.approverEpoch) {
            revert StaleApproverEpoch(requestId, request.approverEpoch, vendor.approverEpoch);
        }

        _signalSubmitted[requestId][msg.sender] = true;
        euint16 signal = Nox.fromExternal(encryptedSignal, handleProof);
        if (!Nox.isInitialized(signal)) revert UninitializedHandle();

        bytes32 rawHandle = euint16.unwrap(signal);
        bytes32 boundTo = _handleUsedBy[rawHandle];
        if (boundTo != bytes32(0)) revert HandleAlreadyUsed(rawHandle, boundTo);
        _handleUsedBy[rawHandle] = requestId;

        // Values above one are confidentially converted to zero, so a reviewer cannot submit
        // an encrypted 3 and satisfy the all-three threshold alone.
        ebool inRange = Nox.le(signal, Nox.toEuint16(1));
        euint16 sanitized = Nox.select(inRange, signal, Nox.toEuint16(0));
        euint16 aggregate = request.signalCount == 0
            ? sanitized
            : Nox.add(request.aggregateScore, sanitized);

        request.aggregateScore = aggregate;
        request.signalCount++;
        Nox.allowThis(aggregate);

        emit PrivateSignalSubmitted(requestId, msg.sender, rawHandle);

        if (request.signalCount == REQUIRED_SIGNALS) {
            ebool verdict = Nox.eq(aggregate, Nox.toEuint16(REQUIRED_SIGNALS));
            request.verdict = verdict;
            request.status = RequestStatus.Sealed;
            Nox.allowThis(verdict);
            Nox.allowPublicDecryption(verdict);
            emit AggregateVerdictSealed(requestId, ebool.unwrap(verdict));
        }
    }

    function settleApproval(bytes32 requestId, bytes calldata decryptionProof)
        external
        whenNotPaused
        nonReentrant
        returns (bool approved)
    {
        ChangeRequest storage request = _requests[requestId];
        if (request.status == RequestStatus.None) revert RequestNotFound(requestId);
        if (request.status != RequestStatus.Sealed) revert RequestNotSealed(requestId, request.status);

        Vendor storage vendor = _vendors[request.vendorId];
        if (vendor.payoutWallet != request.currentWallet) {
            revert StaleRequest(requestId, request.currentWallet, vendor.payoutWallet);
        }
        if (vendor.approverEpoch != request.approverEpoch) {
            revert StaleApproverEpoch(requestId, request.approverEpoch, vendor.approverEpoch);
        }

        approved = Nox.publicDecrypt(request.verdict, decryptionProof);
        request.approved = approved;
        request.status = RequestStatus.Settled;

        if (approved) {
            address previousWallet = vendor.payoutWallet;
            vendor.payoutWallet = request.proposedWallet;
            emit PayoutWalletChanged(request.vendorId, previousWallet, request.proposedWallet);
        }
        emit ApprovalSettled(requestId, approved);
    }

    function proposeApproverRotation(bytes32 vendorId, address newApprover)
        external
        onlyOwner
        whenNotPaused
    {
        Vendor storage vendor = _registeredVendor(vendorId);
        if (newApprover == address(0)) revert ZeroAddress();
        _validateApproverCandidate(vendor, newApprover);
        if (_rotations[vendorId].newApprover != address(0)) revert RotationAlreadyPending(vendorId);
        if (_recoveries[vendorId].newApprover != address(0)) revert RecoveryAlreadyPending(vendorId);
        _rotations[vendorId] = ApproverRotation(newApprover, false, false);
        emit ApproverRotationProposed(vendorId, vendor.approver, newApprover);
    }

    function approveApproverRotation(bytes32 vendorId, address expectedNewApprover) external whenNotPaused {
        Vendor storage vendor = _registeredVendor(vendorId);
        if (msg.sender != vendor.approver) revert UnauthorizedReviewer(vendorId, msg.sender);
        ApproverRotation storage rotation = _rotation(vendorId, expectedNewApprover);
        rotation.currentApproved = true;
        emit ApproverRotationApproved(vendorId, msg.sender);
        _finalizeRotationIfReady(vendorId, vendor, rotation);
    }

    function acceptApproverRotation(bytes32 vendorId) external whenNotPaused {
        Vendor storage vendor = _registeredVendor(vendorId);
        ApproverRotation storage rotation = _rotation(vendorId, msg.sender);
        rotation.candidateAccepted = true;
        emit ApproverRotationAccepted(vendorId, msg.sender);
        _finalizeRotationIfReady(vendorId, vendor, rotation);
    }

    function cancelApproverRotation(bytes32 vendorId) external {
        Vendor storage vendor = _registeredVendor(vendorId);
        if (msg.sender != owner() && msg.sender != vendor.approver) {
            revert UnauthorizedRotationCancellation(vendorId, msg.sender);
        }
        if (_rotations[vendorId].newApprover == address(0)) revert RotationNotPending(vendorId);
        delete _rotations[vendorId];
        emit ApproverRotationCancelled(vendorId, msg.sender);
    }

    function scheduleApproverRecovery(bytes32 vendorId, address newApprover)
        external
        onlyOwner
        whenNotPaused
    {
        Vendor storage vendor = _registeredVendor(vendorId);
        if (newApprover == address(0)) revert ZeroAddress();
        _validateApproverCandidate(vendor, newApprover);
        if (_rotations[vendorId].newApprover != address(0)) revert RotationAlreadyPending(vendorId);
        if (_recoveries[vendorId].newApprover != address(0)) revert RecoveryAlreadyPending(vendorId);

        uint64 executeAfter = uint64(block.timestamp + RECOVERY_DELAY);
        _recoveries[vendorId] = ApproverRecovery(newApprover, executeAfter, false);
        emit ApproverRecoveryScheduled(vendorId, newApprover, executeAfter);
    }

    function acceptApproverRecovery(bytes32 vendorId) external whenNotPaused {
        ApproverRecovery storage recovery = _recovery(vendorId, msg.sender);
        recovery.candidateAccepted = true;
        emit ApproverRecoveryAccepted(vendorId, msg.sender);
    }

    function vetoApproverRecovery(bytes32 vendorId) external {
        Vendor storage vendor = _registeredVendor(vendorId);
        if (msg.sender != vendor.approver) revert UnauthorizedReviewer(vendorId, msg.sender);
        if (_recoveries[vendorId].newApprover == address(0)) revert RecoveryNotPending(vendorId);
        delete _recoveries[vendorId];
        emit ApproverRecoveryCancelled(vendorId, msg.sender);
    }

    function cancelApproverRecovery(bytes32 vendorId) external onlyOwner {
        _registeredVendor(vendorId);
        if (_recoveries[vendorId].newApprover == address(0)) revert RecoveryNotPending(vendorId);
        delete _recoveries[vendorId];
        emit ApproverRecoveryCancelled(vendorId, msg.sender);
    }

    function executeApproverRecovery(bytes32 vendorId) external onlyOwner whenNotPaused {
        Vendor storage vendor = _registeredVendor(vendorId);
        ApproverRecovery storage recovery = _recoveries[vendorId];
        if (recovery.newApprover == address(0)) revert RecoveryNotPending(vendorId);
        if (!recovery.candidateAccepted) revert RecoveryCandidateNotAccepted(vendorId);
        if (block.timestamp < recovery.executeAfter) revert RecoveryNotReady(vendorId, recovery.executeAfter);
        address nextApprover = recovery.newApprover;
        delete _recoveries[vendorId];
        _changeApprover(vendorId, vendor, nextApprover);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function isPayoutAllowed(bytes32 vendorId, address destination)
        external
        view
        returns (bool allowed, string memory reason)
    {
        if (paused()) return (false, "FIREWALL_PAUSED");
        Vendor storage vendor = _vendors[vendorId];
        if (!vendor.registered) return (false, "VENDOR_NOT_REGISTERED");
        if (destination == address(0)) return (false, "ZERO_DESTINATION");
        if (destination == vendor.payoutWallet) return (true, "DESTINATION_UNCHANGED");
        return (false, "APPROVAL_REQUIRED");
    }

    function deriveRequestId(
        bytes32 vendorId,
        address currentWallet,
        address proposedWallet,
        address requestedBy,
        uint256 nonce,
        uint64 approverEpoch
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                vendorId,
                currentWallet,
                proposedWallet,
                requestedBy,
                nonce,
                approverEpoch,
                block.chainid,
                address(this)
            )
        );
    }

    function getVendor(bytes32 vendorId) external view returns (Vendor memory) {
        return _vendors[vendorId];
    }

    function getPayoutWallet(bytes32 vendorId) external view returns (address) {
        return _vendors[vendorId].payoutWallet;
    }

    function getRequest(bytes32 requestId) external view returns (ChangeRequest memory) {
        return _requests[requestId];
    }

    function getApproverRotation(bytes32 vendorId) external view returns (ApproverRotation memory) {
        return _rotations[vendorId];
    }

    function getApproverRecovery(bytes32 vendorId) external view returns (ApproverRecovery memory) {
        return _recoveries[vendorId];
    }

    function hasSubmittedSignal(bytes32 requestId, address reviewer) external view returns (bool) {
        return _signalSubmitted[requestId][reviewer];
    }

    function aggregateScoreHandle(bytes32 requestId) external view returns (bytes32) {
        return euint16.unwrap(_requests[requestId].aggregateScore);
    }

    function verdictHandle(bytes32 requestId) external view returns (bytes32) {
        return ebool.unwrap(_requests[requestId].verdict);
    }

    function handleUsedBy(bytes32 handle) external view returns (bytes32) {
        return _handleUsedBy[handle];
    }

    function noxComputeAddress() external view returns (address) {
        return Nox.noxComputeContract();
    }

    function _registeredVendor(bytes32 vendorId) private view returns (Vendor storage vendor) {
        vendor = _vendors[vendorId];
        if (!vendor.registered) revert VendorNotRegistered(vendorId);
    }

    function _validateReviewers(
        address payoutWallet,
        address approver,
        address treasuryReviewer,
        address riskReviewer
    ) private pure {
        if (
            payoutWallet == address(0) || approver == address(0) || treasuryReviewer == address(0)
                || riskReviewer == address(0)
        ) revert ZeroAddress();
        if (
            approver == treasuryReviewer || approver == riskReviewer
                || treasuryReviewer == riskReviewer
        ) revert InvalidReviewerSet();
    }

    function _isReviewer(Vendor storage vendor, address account) private view returns (bool) {
        return account == vendor.approver || account == vendor.treasuryReviewer || account == vendor.riskReviewer;
    }

    function _rotation(bytes32 vendorId, address expectedCandidate)
        private
        view
        returns (ApproverRotation storage rotation)
    {
        rotation = _rotations[vendorId];
        if (rotation.newApprover == address(0)) revert RotationNotPending(vendorId);
        if (rotation.newApprover != expectedCandidate) {
            revert RotationCandidateMismatch(vendorId, rotation.newApprover, expectedCandidate);
        }
    }

    function _recovery(bytes32 vendorId, address expectedCandidate)
        private
        view
        returns (ApproverRecovery storage recovery)
    {
        recovery = _recoveries[vendorId];
        if (recovery.newApprover == address(0)) revert RecoveryNotPending(vendorId);
        if (recovery.newApprover != expectedCandidate) {
            revert RotationCandidateMismatch(vendorId, recovery.newApprover, expectedCandidate);
        }
    }

    function _finalizeRotationIfReady(
        bytes32 vendorId,
        Vendor storage vendor,
        ApproverRotation storage rotation
    ) private {
        if (!rotation.currentApproved || !rotation.candidateAccepted) return;
        address nextApprover = rotation.newApprover;
        delete _rotations[vendorId];
        _changeApprover(vendorId, vendor, nextApprover);
    }

    function _changeApprover(bytes32 vendorId, Vendor storage vendor, address nextApprover) private {
        _validateApproverCandidate(vendor, nextApprover);
        address previousApprover = vendor.approver;
        vendor.approver = nextApprover;
        vendor.approverEpoch++;
        emit ApproverChanged(vendorId, previousApprover, nextApprover, vendor.approverEpoch);
    }

    function _validateApproverCandidate(Vendor storage vendor, address candidate) private view {
        if (
            candidate == vendor.approver || candidate == vendor.treasuryReviewer
                || candidate == vendor.riskReviewer
        ) revert InvalidReviewerSet();
    }
}

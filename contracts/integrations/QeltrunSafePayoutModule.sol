// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IQeltrunPayoutPolicy {
    function getPayoutWallet(bytes32 vendorId) external view returns (address);
    function isPayoutAllowed(bytes32 vendorId, address destination) external view returns (bool, string memory);
}

interface ISafeModuleExecutor {
    function execTransactionFromModule(address to, uint256 value, bytes memory data, uint8 operation)
        external
        returns (bool success);

    function execTransactionFromModuleReturnData(address to, uint256 value, bytes memory data, uint8 operation)
        external
        returns (bool success, bytes memory returnData);
}

/// @title QeltrunSafePayoutModule
/// @notice Safe module adapter that enforces Qeltrun policy before native or ERC-20 payouts.
/// @dev The Safe itself must call this module through an owner-approved Safe transaction, and
///      must enable the module before execution. Funds remain in the Safe at all times.
contract QeltrunSafePayoutModule is ReentrancyGuard {
    uint8 private constant CALL = 0;

    address public immutable safe;
    IQeltrunPayoutPolicy public immutable policy;

    event VendorPayoutExecuted(
        bytes32 indexed vendorId,
        address indexed asset,
        address indexed destination,
        uint256 amount
    );

    error ZeroAddress();
    error OnlySafe(address caller);
    error ZeroAmount();
    error PayoutBlocked(bytes32 vendorId, address destination, string reason);
    error SafeExecutionFailed();
    error TokenTransferFailed();

    constructor(address safe_, address policy_) {
        if (safe_ == address(0) || policy_ == address(0)) revert ZeroAddress();
        safe = safe_;
        policy = IQeltrunPayoutPolicy(policy_);
    }

    modifier onlySafe() {
        if (msg.sender != safe) revert OnlySafe(msg.sender);
        _;
    }

    function executeNativePayout(bytes32 vendorId, uint256 amount) external onlySafe nonReentrant {
        if (amount == 0) revert ZeroAmount();
        address destination = _allowedDestination(vendorId);
        bool success = ISafeModuleExecutor(safe).execTransactionFromModule(
            destination,
            amount,
            bytes(""),
            CALL
        );
        if (!success) revert SafeExecutionFailed();
        emit VendorPayoutExecuted(vendorId, address(0), destination, amount);
    }

    function executeTokenPayout(bytes32 vendorId, address token, uint256 amount)
        external
        onlySafe
        nonReentrant
    {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        address destination = _allowedDestination(vendorId);
        bytes memory callData = abi.encodeCall(IERC20.transfer, (destination, amount));
        (bool success, bytes memory returnData) = ISafeModuleExecutor(safe)
            .execTransactionFromModuleReturnData(token, 0, callData, CALL);
        if (!success) revert SafeExecutionFailed();
        if (returnData.length != 0 && !abi.decode(returnData, (bool))) revert TokenTransferFailed();
        emit VendorPayoutExecuted(vendorId, token, destination, amount);
    }

    function _allowedDestination(bytes32 vendorId) private view returns (address destination) {
        destination = policy.getPayoutWallet(vendorId);
        (bool allowed, string memory reason) = policy.isPayoutAllowed(vendorId, destination);
        if (!allowed) revert PayoutBlocked(vendorId, destination, reason);
    }
}

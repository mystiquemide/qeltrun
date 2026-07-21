// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {NoxLocalEnv} from "./NoxLocalEnv.sol";
import {QeltrunPayoutFirewallV2} from "../../contracts/QeltrunPayoutFirewallV2.sol";
import {QeltrunSafePayoutModule} from "../../contracts/integrations/QeltrunSafePayoutModule.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockSafe {
    mapping(address module => bool enabled) public modules;

    receive() external payable {}

    function setModule(address module, bool enabled) external {
        modules[module] = enabled;
    }

    function executeNative(QeltrunSafePayoutModule module, bytes32 vendorId, uint256 amount) external {
        module.executeNativePayout(vendorId, amount);
    }

    function executeToken(
        QeltrunSafePayoutModule module,
        bytes32 vendorId,
        address token,
        uint256 amount
    ) external {
        module.executeTokenPayout(vendorId, token, amount);
    }

    function execTransactionFromModuleReturnData(address to, uint256 value, bytes memory data, uint8 operation)
        external
        returns (bool success, bytes memory returnData)
    {
        require(modules[msg.sender], "MODULE_DISABLED");
        require(operation == 0, "DELEGATECALL_DISABLED");
        (success, returnData) = to.call{value: value}(data);
    }

    function execTransactionFromModule(address to, uint256 value, bytes memory data, uint8 operation)
        external
        returns (bool success)
    {
        require(modules[msg.sender], "MODULE_DISABLED");
        require(operation == 0, "DELEGATECALL_DISABLED");
        (success,) = to.call{value: value}(data);
    }
}

contract MockToken is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}

contract FalseReturnToken {
    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }
}

contract QeltrunSafePayoutModuleTest is NoxLocalEnv {
    QeltrunPayoutFirewallV2 internal firewall;
    QeltrunSafePayoutModule internal module;
    MockSafe internal safe;
    MockToken internal token;

    bytes32 internal constant VENDOR = keccak256("vendor:northwind-logistics");
    address internal payoutWallet;

    function setUp() public {
        _bootstrapNox();
        payoutWallet = makeAddr("payout-wallet");
        firewall = new QeltrunPayoutFirewallV2(address(this));
        firewall.registerVendor(
            VENDOR,
            payoutWallet,
            makeAddr("approver"),
            makeAddr("treasury-reviewer"),
            makeAddr("risk-reviewer")
        );
        safe = new MockSafe();
        module = new QeltrunSafePayoutModule(address(safe), address(firewall));
        safe.setModule(address(module), true);
        token = new MockToken();
    }

    function test_safe_executes_native_payout_only_to_current_policy_wallet() public {
        vm.deal(address(safe), 2 ether);
        safe.executeNative(module, VENDOR, 0.75 ether);
        assertEq(payoutWallet.balance, 0.75 ether);
        assertEq(address(safe).balance, 1.25 ether);
    }

    function test_safe_executes_erc20_payout() public {
        token.mint(address(safe), 1_000 ether);
        safe.executeToken(module, VENDOR, address(token), 125 ether);
        assertEq(token.balanceOf(payoutWallet), 125 ether);
        assertEq(token.balanceOf(address(safe)), 875 ether);
    }

    function test_external_caller_cannot_invoke_module() public {
        vm.expectRevert(
            abi.encodeWithSelector(QeltrunSafePayoutModule.OnlySafe.selector, address(this))
        );
        module.executeNativePayout(VENDOR, 1 ether);
    }

    function test_disabled_module_cannot_move_safe_funds() public {
        vm.deal(address(safe), 1 ether);
        safe.setModule(address(module), false);
        vm.expectRevert(bytes("MODULE_DISABLED"));
        safe.executeNative(module, VENDOR, 1 ether);
        assertEq(payoutWallet.balance, 0);
    }

    function test_paused_policy_blocks_native_and_token_payouts() public {
        vm.deal(address(safe), 1 ether);
        token.mint(address(safe), 10 ether);
        firewall.pause();

        vm.expectRevert(
            abi.encodeWithSelector(
                QeltrunSafePayoutModule.PayoutBlocked.selector,
                VENDOR,
                payoutWallet,
                "FIREWALL_PAUSED"
            )
        );
        safe.executeNative(module, VENDOR, 1 ether);
        vm.expectRevert(
            abi.encodeWithSelector(
                QeltrunSafePayoutModule.PayoutBlocked.selector,
                VENDOR,
                payoutWallet,
                "FIREWALL_PAUSED"
            )
        );
        safe.executeToken(module, VENDOR, address(token), 1 ether);
    }

    function test_failed_safe_call_and_false_token_return_are_rejected() public {
        vm.expectRevert(QeltrunSafePayoutModule.SafeExecutionFailed.selector);
        safe.executeNative(module, VENDOR, 1 ether);

        FalseReturnToken falseToken = new FalseReturnToken();
        vm.expectRevert(QeltrunSafePayoutModule.TokenTransferFailed.selector);
        safe.executeToken(module, VENDOR, address(falseToken), 1);
    }

    function test_zero_values_are_rejected() public {
        vm.expectRevert(QeltrunSafePayoutModule.ZeroAmount.selector);
        safe.executeNative(module, VENDOR, 0);
        vm.expectRevert(QeltrunSafePayoutModule.ZeroAddress.selector);
        safe.executeToken(module, VENDOR, address(0), 1);
    }
}

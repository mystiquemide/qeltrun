// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Qeltrun Demo Token
/// @notice Sepolia-only token used to certify the Safe ERC-20 payout path.
contract QeltrunDemoToken is ERC20 {
    error ZeroTreasury();

    constructor(address treasury) ERC20("Qeltrun Demo Token", "QDT") {
        if (treasury == address(0)) revert ZeroTreasury();
        _mint(treasury, 1_000_000 ether);
    }
}

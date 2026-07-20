// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Nox} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

/// @title QeltrunPayoutFirewall
/// @notice Minimal Nox-aware application surface for the vendor-change payout firewall.
contract QeltrunPayoutFirewall {
    function noxComputeAddress() external view returns (address) {
        return Nox.noxComputeContract();
    }
}

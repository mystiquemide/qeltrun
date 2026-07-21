// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {NoxCompute} from "@iexec-nox/nox-protocol-contracts/contracts/NoxCompute.sol";

/// @notice Local-development artifact only. Never deploy this to a public network.
///
/// @dev On a live chain `Nox.noxComputeContract()` resolves to the NoxCompute the iExec team
///      operates. There is no such deployment on a fresh Hardhat node, so the demo script
///      needs the protocol's own bytecode to place at the address Nox expects. Subclassing
///      here is the only way to get Hardhat to emit an artifact for a contract that lives in
///      `node_modules`; the behaviour is the unmodified upstream implementation.
contract LocalNoxCompute is NoxCompute {}

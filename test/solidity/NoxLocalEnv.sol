// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Test} from "forge-std/Test.sol";
import {NoxCompute} from "@iexec-nox/nox-protocol-contracts/contracts/NoxCompute.sol";

/// @notice Runs the *real* NoxCompute protocol contract inside the local EDR chain.
///
/// @dev We do not mock Nox. `Nox.noxComputeContract()` hard-codes a single address for chain
///      31337, so we deploy the genuine implementation and `vm.etch` its runtime code there.
///      Etching copies code but not storage, which conveniently sidesteps the constructor's
///      `_disableInitializers()` and lets us initialize the etched instance with a gateway
///      key the test controls.
///
///      Everything downstream is then real: the 137-byte input-proof layout, the EIP-712
///      digests, the ECDSA gateway recovery, the ACL, and the decryption-proof check. Tests
///      that pass here exercise the same code path a Sepolia transaction would.
abstract contract NoxLocalEnv is Test {
    /// Address `Nox.noxComputeContract()` resolves to on chain id 31337.
    address internal constant NOX_COMPUTE_LOCAL = 0x75C6AF4430cc474b1bb9b8540b7E46D6f8e1C685;

    bytes32 internal constant HANDLE_PROOF_TYPEHASH =
        keccak256("HandleProof(bytes32 handle,address owner,address app,uint256 createdAt)");
    bytes32 internal constant DECRYPTION_PROOF_TYPEHASH =
        keccak256("DecryptionProof(bytes32 handle,bytes decryptedResult)");
    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    /// TEE type tag for `ebool`, byte 5 of a handle. `TEEType.Bool` is enum index 0.
    uint8 internal constant TEE_TYPE_BOOL = 0;
    /// Bit 0 of the attrs byte (byte 6). Set means confidential; unset means public handle.
    bytes1 internal constant ATTR_IS_UNIQUE_HANDLE = 0x01;

    NoxCompute internal nox;
    address internal noxGateway;
    uint256 internal noxGatewayKey;

    function _bootstrapNox() internal {
        // Pin the chain id so `Nox.noxComputeContract()` resolves to the local address.
        vm.chainId(31337);
        // Proof expiry is one hour; start the clock somewhere it cannot underflow.
        vm.warp(1_800_000_000);

        (noxGateway, noxGatewayKey) = makeAddrAndKey("nox-gateway");

        NoxCompute implementation = new NoxCompute();
        vm.etch(NOX_COMPUTE_LOCAL, address(implementation).code);
        nox = NoxCompute(NOX_COMPUTE_LOCAL);
        nox.initialize(address(this), address(this), hex"02deadbeef", noxGateway);
    }

    // ============ Handle construction ============

    /// @dev Handle layout: [0]=version [1-4]=chainId [5]=teeType [6]=attrs [7-31]=pre-handle.
    function _boolHandle(string memory salt) internal view returns (bytes32) {
        bytes32 handle = bytes32(bytes4(uint32(block.chainid))) >> (1 * 8);
        handle |= bytes32(bytes1(TEE_TYPE_BOOL)) >> (5 * 8);
        handle |= bytes32(ATTR_IS_UNIQUE_HANDLE) >> (6 * 8);
        // Lowest 25 bytes are the pre-handle; mask keeps us clear of bytes 0-6.
        handle |= keccak256(abi.encodePacked("qeltrun/handle/", salt)) & bytes32((uint256(1) << 200) - 1);
        return handle;
    }

    // ============ Proof forging (as the gateway would) ============

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256("NoxCompute"),
                keccak256("1"),
                block.chainid,
                NOX_COMPUTE_LOCAL
            )
        );
    }

    function _sign(uint256 key, bytes32 structHash) internal view returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    /// @notice Build the 137-byte input proof the Nox gateway would return for `encryptInput`.
    function _inputProof(bytes32 handle, address owner, address app, uint256 signingKey)
        internal
        view
        returns (bytes memory)
    {
        uint256 createdAt = block.timestamp;
        bytes memory signature =
            _sign(signingKey, keccak256(abi.encode(HANDLE_PROOF_TYPEHASH, handle, owner, app, createdAt)));
        return abi.encodePacked(owner, app, createdAt, signature);
    }

    function _inputProof(bytes32 handle, address owner, address app) internal view returns (bytes memory) {
        return _inputProof(handle, owner, app, noxGatewayKey);
    }

    /// @notice Build the compact decryption proof: 65-byte signature followed by the plaintext.
    function _decryptionProof(bytes32 handle, bool value, uint256 signingKey)
        internal
        view
        returns (bytes memory)
    {
        bytes memory result = abi.encodePacked(value ? bytes1(0x01) : bytes1(0x00));
        bytes memory signature =
            _sign(signingKey, keccak256(abi.encode(DECRYPTION_PROOF_TYPEHASH, handle, keccak256(result))));
        return abi.encodePacked(signature, result);
    }

    function _decryptionProof(bytes32 handle, bool value) internal view returns (bytes memory) {
        return _decryptionProof(handle, value, noxGatewayKey);
    }

    // ============ External surface for invariant handlers ============
    //
    // The invariant handler is a separate contract, so it cannot reach the `internal` helpers
    // above. These wrappers expose the same gateway behaviour and additionally remember which
    // plaintext each handle carries, which a handler needs in order to settle a request it
    // sealed several fuzz steps earlier.

    mapping(bytes32 handle => bool value) private _plaintexts;
    uint256 private _handleSalt;

    function mintBoolHandle(uint256 salt) external view returns (bytes32) {
        return _boolHandle(string(abi.encodePacked("invariant/", salt)));
    }

    function buildInputProof(bytes32 handle, address owner, address app)
        external
        view
        returns (bytes memory)
    {
        return _inputProof(handle, owner, app);
    }

    function buildDecryptionProof(bytes32 handle, bool value) external view returns (bytes memory) {
        return _decryptionProof(handle, value);
    }

    function rememberPlaintext(bytes32 handle, bool value) external {
        _plaintexts[handle] = value;
    }

    function plaintextFor(bytes32 handle) external view returns (bool) {
        return _plaintexts[handle];
    }
}

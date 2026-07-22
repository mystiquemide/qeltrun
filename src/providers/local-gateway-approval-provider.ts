import { concatHex, encodeAbiParameters, keccak256, numberToHex, toBytes, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { isSameAddress } from '../domain/index.js';
import type {
  ApprovalProvider,
  Hex,
  RevealedApproval,
  SealApprovalInput,
  SealedApproval,
} from '../domain/types.js';

/// NoxCompute address `Nox.noxComputeContract()` resolves to on the Hardhat chain (31337).
export const LOCAL_NOX_COMPUTE = '0x75C6AF4430cc474b1bb9b8540b7E46D6f8e1C685' as const;

/// TEE type tag for `ebool`. `TEEType.Bool` is enum index 0.
const TEE_TYPE_BOOL = 0;
/// TEE type tag for `euint16`, enum index 5. Matches `TEE_TYPE_UINT16` in
/// `test/solidity/NoxLocalEnv.sol`, and it is the byte you can read out of any live signal
/// handle on Sepolia at position 5.
const TEE_TYPE_UINT16 = 5;
/// Bit 0 of the attrs byte. Set means a confidential handle rather than a public one.
const ATTR_IS_UNIQUE_HANDLE = 0x01;

/// `QeltrunPayoutFirewallV2.REQUIRED_SIGNALS`. The verdict is `aggregate == 3`.
const REQUIRED_SIGNALS = 3;

const EIP712_DOMAIN = {
  name: 'NoxCompute',
  version: '1',
} as const;

const HANDLE_PROOF_TYPES = {
  HandleProof: [
    { name: 'handle', type: 'bytes32' },
    { name: 'owner', type: 'address' },
    { name: 'app', type: 'address' },
    { name: 'createdAt', type: 'uint256' },
  ],
} as const;

const DECRYPTION_PROOF_TYPES = {
  DecryptionProof: [
    { name: 'handle', type: 'bytes32' },
    { name: 'decryptedResult', type: 'bytes' },
  ],
} as const;

export type LocalGatewayApprovalProviderConfig = {
  chainId: number;
  /// Key the locally deployed NoxCompute was initialized with as its gateway.
  gatewayPrivateKey: Hex;
  /// Wallet allowed to seal. Handles are bound to it exactly as on a live network.
  approver: Address;
  noxComputeAddress?: Hex;
};

type Address = Hex;

/// A local stand-in for the iExec Nox gateway, for running the demo without a testnet.
///
/// This is *not* a stub of the approval logic. It emits genuine 137-byte input proofs and
/// genuine compact decryption proofs, signed with the key a locally deployed NoxCompute was
/// initialized with. The contract's `Nox.fromExternal` and `Nox.publicDecrypt` calls run the
/// real protocol verification against them; only the TEE's confidentiality is simulated,
/// since the plaintext bit is held in this process rather than inside an enclave.
///
/// On a live network `NoxApprovalProvider` replaces this class and nothing else changes.
export class LocalGatewayApprovalProvider implements ApprovalProvider {
  readonly chainId: number;

  private readonly gateway: ReturnType<typeof privateKeyToAccount>;
  private readonly approver: Address;
  private readonly noxComputeAddress: Hex;
  private readonly plaintexts = new Map<Hex, boolean>();
  /// Reviewer signal values, kept separately from the v1 bool plaintexts because the verdict is
  /// computed from them rather than looked up.
  private readonly signals = new Map<Hex, number>();
  private nonce = 0;

  constructor(config: LocalGatewayApprovalProviderConfig) {
    this.chainId = config.chainId;
    this.gateway = privateKeyToAccount(config.gatewayPrivateKey);
    this.approver = config.approver;
    this.noxComputeAddress = config.noxComputeAddress ?? LOCAL_NOX_COMPUTE;
  }

  get gatewayAddress(): Address {
    return this.gateway.address;
  }

  /// Whether this instance minted the handle and can therefore reveal it.
  knowsHandle(handle: Hex): boolean {
    return this.plaintexts.has(handle);
  }

  async sealApproval(input: SealApprovalInput): Promise<SealedApproval> {
    if (!isSameAddress(input.approver, this.approver)) {
      throw new Error(`LOCAL_SEAL_WALLET_MISMATCH:${input.approver}:expected:${this.approver}`);
    }

    const handle = this.mintBoolHandle();
    this.plaintexts.set(handle, input.approve);

    const createdAt = BigInt(Math.floor(Date.now() / 1000));
    const signature = await this.gateway.signTypedData({
      domain: this.domain(),
      types: HANDLE_PROOF_TYPES,
      primaryType: 'HandleProof',
      message: {
        handle,
        owner: input.approver,
        app: input.applicationContract,
        createdAt,
      },
    });

    // owner(20) ‖ app(20) ‖ createdAt(32) ‖ signature(65) = 137 bytes.
    const handleProof = concatHex([
      input.approver,
      input.applicationContract,
      numberToHex(createdAt, { size: 32 }),
      signature,
    ]);

    return {
      handle,
      handleProof,
      owner: input.approver,
      applicationContract: input.applicationContract,
    };
  }

  async revealApproval(handle: Hex): Promise<RevealedApproval> {
    const value = this.plaintexts.get(handle);
    if (value === undefined) {
      throw new Error(`LOCAL_UNKNOWN_HANDLE:${handle}`);
    }

    const decryptedResult = value ? '0x01' : '0x00';
    const signature = await this.gateway.signTypedData({
      domain: this.domain(),
      types: DECRYPTION_PROOF_TYPES,
      primaryType: 'DecryptionProof',
      message: { handle, decryptedResult },
    });

    // signature(65) ‖ decryptedResult.
    return { handle, value, decryptionProof: concatHex([signature, decryptedResult]) };
  }

  // ============ v2, three reviewer signals ============

  /// Whether this instance minted the signal handle.
  knowsSignal(handle: Hex): boolean {
    return this.signals.has(handle);
  }

  /**
   * Seal one reviewer's `euint16` position.
   *
   * Unlike v1 there is no approver check here, because any of the three reviewers may seal and
   * the contract decides which addresses are allowed. The wallet that seals must still be the
   * wallet that sends the transaction, since NoxCompute compares the proof owner against the
   * firewall's `msg.sender`.
   */
  async sealSignal(input: {
    reviewer: Address;
    applicationContract: Address;
    signal: number;
  }): Promise<SealedApproval> {
    if (!Number.isInteger(input.signal) || input.signal < 0 || input.signal > 65535) {
      throw new Error(`INVALID_UINT16_SIGNAL:${input.signal}`);
    }

    const handle = this.mintHandle(TEE_TYPE_UINT16);
    this.signals.set(handle, input.signal);

    const createdAt = BigInt(Math.floor(Date.now() / 1000));
    const signature = await this.gateway.signTypedData({
      domain: this.domain(),
      types: HANDLE_PROOF_TYPES,
      primaryType: 'HandleProof',
      message: {
        handle,
        owner: input.reviewer,
        app: input.applicationContract,
        createdAt,
      },
    });

    return {
      handle,
      handleProof: concatHex([
        input.reviewer,
        input.applicationContract,
        numberToHex(createdAt, { size: 32 }),
        signature,
      ]),
      owner: input.reviewer,
      applicationContract: input.applicationContract,
    };
  }

  /**
   * Sign a decryption proof for the aggregate verdict.
   *
   * The verdict handle is produced by NoxCompute's confidential arithmetic, so it is supplied by
   * the caller after reading `verdictHandle(requestId)` off chain. This mirrors
   * `NoxLocalEnv.buildDecryptionProof(handle, value)` in the Solidity harness: the gateway signs
   * a value it computed, and only the enclave's confidentiality is simulated, never the approval
   * logic.
   *
   * The value is computed exactly as `submitPrivateSignal` does it, clamp anything above one to
   * zero, sum, then `aggregate == REQUIRED_SIGNALS`. Getting this wrong would make the local path
   * disagree with the contract, which is the one thing it must never do.
   */
  async revealVerdict(
    verdictHandle: Hex,
    signalHandles: readonly Hex[],
  ): Promise<RevealedApproval> {
    if (signalHandles.length !== REQUIRED_SIGNALS) {
      throw new Error(`LOCAL_EXPECTED_${REQUIRED_SIGNALS}_SIGNALS:got:${signalHandles.length}`);
    }

    let aggregate = 0;
    for (const handle of signalHandles) {
      const value = this.signals.get(handle);
      if (value === undefined) throw new Error(`LOCAL_UNKNOWN_SIGNAL_HANDLE:${handle}`);
      // `Nox.select(Nox.le(signal, 1), signal, 0)`.
      aggregate += value <= 1 ? value : 0;
    }

    const approved = aggregate === REQUIRED_SIGNALS;
    const decryptedResult = approved ? '0x01' : '0x00';
    const signature = await this.gateway.signTypedData({
      domain: this.domain(),
      types: DECRYPTION_PROOF_TYPES,
      primaryType: 'DecryptionProof',
      message: { handle: verdictHandle, decryptedResult },
    });

    return {
      handle: verdictHandle,
      value: approved,
      decryptionProof: concatHex([signature, decryptedResult]),
    };
  }

  private domain() {
    return {
      ...EIP712_DOMAIN,
      chainId: this.chainId,
      verifyingContract: this.noxComputeAddress,
    } as const;
  }

  private mintBoolHandle(): Hex {
    return this.mintHandle(TEE_TYPE_BOOL);
  }

  /// Handle layout: [0]=version [1-4]=chainId [5]=teeType [6]=attrs [7-31]=pre-handle.
  private mintHandle(teeType: number): Hex {
    const bytes = new Uint8Array(32);
    bytes[0] = 0;
    new DataView(bytes.buffer).setUint32(1, this.chainId, false);
    bytes[5] = teeType;
    bytes[6] = ATTR_IS_UNIQUE_HANDLE;

    const preHandle = toBytes(
      keccak256(
        encodeAbiParameters([{ type: 'string' }, { type: 'uint256' }], [
          'qeltrun/local-gateway',
          BigInt(this.nonce++),
        ]),
      ),
    );
    bytes.set(preHandle.subarray(0, 25), 7);

    return toHex(bytes);
  }
}

import { recoverTypedDataAddress, size, slice, hexToNumber } from 'viem';
import { describe, expect, it } from 'vitest';

import {
  LOCAL_NOX_COMPUTE,
  LocalGatewayApprovalProvider,
} from '../src/providers/local-gateway-approval-provider.js';
import type { Address, Hex } from '../src/domain/types.js';

const GATEWAY_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex;
const APPROVER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;
const FIREWALL = '0x5FbDB2315678afecb367f032d93F642f64180aa3' as Address;
const CHAIN_ID = 31337;

function makeProvider() {
  return new LocalGatewayApprovalProvider({
    chainId: CHAIN_ID,
    gatewayPrivateKey: GATEWAY_KEY,
    approver: APPROVER,
  });
}

describe('local gateway approval provider', () => {
  it('emits a 137-byte input proof laid out as owner ‖ app ‖ createdAt ‖ signature', async () => {
    const provider = makeProvider();
    const sealed = await provider.sealApproval({
      approver: APPROVER,
      applicationContract: FIREWALL,
      approve: true,
    });

    expect(size(sealed.handleProof)).toBe(137);
    expect(slice(sealed.handleProof, 0, 20).toLowerCase()).toBe(APPROVER.toLowerCase());
    expect(slice(sealed.handleProof, 20, 40).toLowerCase()).toBe(FIREWALL.toLowerCase());
    expect(size(slice(sealed.handleProof, 72, 137))).toBe(65);
  });

  it('signs the input proof as the gateway NoxCompute was initialized with', async () => {
    const provider = makeProvider();
    const sealed = await provider.sealApproval({
      approver: APPROVER,
      applicationContract: FIREWALL,
      approve: true,
    });

    const createdAt = BigInt(hexToNumber(slice(sealed.handleProof, 40, 72)));
    const recovered = await recoverTypedDataAddress({
      domain: { name: 'NoxCompute', version: '1', chainId: CHAIN_ID, verifyingContract: LOCAL_NOX_COMPUTE },
      types: {
        HandleProof: [
          { name: 'handle', type: 'bytes32' },
          { name: 'owner', type: 'address' },
          { name: 'app', type: 'address' },
          { name: 'createdAt', type: 'uint256' },
        ],
      },
      primaryType: 'HandleProof',
      message: { handle: sealed.handle, owner: APPROVER, app: FIREWALL, createdAt },
      signature: slice(sealed.handleProof, 72, 137),
    });

    expect(recovered.toLowerCase()).toBe(provider.gatewayAddress.toLowerCase());
  });

  it('mints handles carrying the chain id, the bool type tag and the confidential attr bit', async () => {
    const provider = makeProvider();
    const { handle } = await provider.sealApproval({
      approver: APPROVER,
      applicationContract: FIREWALL,
      approve: true,
    });

    expect(size(handle)).toBe(32);
    expect(hexToNumber(slice(handle, 0, 1))).toBe(0); // version
    expect(hexToNumber(slice(handle, 1, 5))).toBe(CHAIN_ID);
    expect(hexToNumber(slice(handle, 5, 6))).toBe(0); // TEEType.Bool
    expect(hexToNumber(slice(handle, 6, 7)) & 0x01).toBe(1); // confidential, not a public handle
  });

  it('mints a distinct handle per approval, so one seal cannot be reused for another request', async () => {
    const provider = makeProvider();
    const first = await provider.sealApproval({
      approver: APPROVER,
      applicationContract: FIREWALL,
      approve: true,
    });
    const second = await provider.sealApproval({
      approver: APPROVER,
      applicationContract: FIREWALL,
      approve: true,
    });

    expect(first.handle).not.toBe(second.handle);
  });

  it('refuses to seal for a wallet other than the configured approver', async () => {
    const provider = makeProvider();
    await expect(
      provider.sealApproval({
        approver: '0x3000000000000000000000000000000000000003' as Address,
        applicationContract: FIREWALL,
        approve: true,
      }),
    ).rejects.toThrow('LOCAL_SEAL_WALLET_MISMATCH');
  });

  it('reveals the sealed bit behind a signature ‖ plaintext decryption proof', async () => {
    const provider = makeProvider();

    for (const approve of [true, false]) {
      const sealed = await provider.sealApproval({
        approver: APPROVER,
        applicationContract: FIREWALL,
        approve,
      });
      const revealed = await provider.revealApproval(sealed.handle);

      expect(revealed.value).toBe(approve);
      expect(size(revealed.decryptionProof)).toBe(66);
      expect(slice(revealed.decryptionProof, 65, 66)).toBe(approve ? '0x01' : '0x00');
    }
  });

  it('cannot reveal a handle it never sealed', async () => {
    const provider = makeProvider();
    await expect(provider.revealApproval(`0x${'11'.repeat(32)}` as Hex)).rejects.toThrow(
      'LOCAL_UNKNOWN_HANDLE',
    );
  });
});

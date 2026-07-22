import { describe, expect, it } from 'vitest';

import { LocalGatewayApprovalProvider } from '../src/providers/local-gateway-approval-provider.js';
import type { Address, Hex } from '../src/domain/types.js';

/// Hardhat account #9, a published development key with no funds on any real network.
const GATEWAY_KEY = '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6' as Hex;
const APPROVER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;
const TREASURY = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Address;
const RISK = '0x90F79bf6EB2c4f870365E785982E1f101E93b906' as Address;
const FIREWALL = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as Address;
const VERDICT_HANDLE = ('0x' + '11'.repeat(32)) as Hex;

function provider(): LocalGatewayApprovalProvider {
  return new LocalGatewayApprovalProvider({
    chainId: 31337,
    gatewayPrivateKey: GATEWAY_KEY,
    approver: APPROVER,
  });
}

async function sealAll(p: LocalGatewayApprovalProvider, values: number[]): Promise<Hex[]> {
  const reviewers = [APPROVER, TREASURY, RISK];
  const handles: Hex[] = [];
  for (const [i, signal] of values.entries()) {
    const sealed = await p.sealSignal({
      reviewer: reviewers[i] as Address,
      applicationContract: FIREWALL,
      signal,
    });
    handles.push(sealed.handle);
  }
  return handles;
}

describe('local gateway, v2 reviewer signals', () => {
  it('mints uint16 handles carrying TEE type 5 and the chain id', async () => {
    const p = provider();
    const { handle, handleProof } = await p.sealSignal({
      reviewer: APPROVER,
      applicationContract: FIREWALL,
      signal: 1,
    });

    // [0] version, [1-4] chainId, [5] TEE type, [6] attrs.
    expect(handle.slice(0, 4)).toBe('0x00');
    expect(handle.slice(4, 12)).toBe('00007a69'); // 31337
    expect(handle.slice(12, 14)).toBe('05'); // euint16
    expect(handle.slice(14, 16)).toBe('01'); // confidential

    // owner(20) + app(20) + createdAt(32) + signature(65) = 137 bytes.
    expect((handleProof.length - 2) / 2).toBe(137);
  });

  it('rejects values outside uint16', async () => {
    const p = provider();
    await expect(
      p.sealSignal({ reviewer: APPROVER, applicationContract: FIREWALL, signal: 65536 }),
    ).rejects.toThrow('INVALID_UINT16_SIGNAL');
  });

  it('approves only when all three reviewers seal a one', async () => {
    const p = provider();
    const handles = await sealAll(p, [1, 1, 1]);
    const revealed = await p.revealVerdict(VERDICT_HANDLE, handles);
    expect(revealed.value).toBe(true);
    expect(revealed.handle).toBe(VERDICT_HANDLE);
    // signature(65) + decryptedResult(1) = 66 bytes.
    expect((revealed.decryptionProof.length - 2) / 2).toBe(66);
  });

  it('refuses when any reviewer seals a zero', async () => {
    const p = provider();
    expect((await p.revealVerdict(VERDICT_HANDLE, await sealAll(p, [1, 0, 1]))).value).toBe(false);
  });

  /**
   * The clamp is the security property. `Nox.select(Nox.le(signal, 1), signal, 0)` means a
   * reviewer who submits three cannot clear the threshold alone, and their signal is worth zero
   * rather than three. Without this the local path would approve where the contract refuses.
   */
  it('clamps values above one to zero, so nobody can approve alone', async () => {
    const p = provider();
    expect((await p.revealVerdict(VERDICT_HANDLE, await sealAll(p, [3, 0, 0]))).value).toBe(false);
    expect((await p.revealVerdict(VERDICT_HANDLE, await sealAll(p, [3, 1, 1]))).value).toBe(false);
    expect((await p.revealVerdict(VERDICT_HANDLE, await sealAll(p, [65535, 1, 1]))).value).toBe(
      false,
    );
  });

  it('refuses to sign for a signal handle it did not mint', async () => {
    const p = provider();
    const handles = await sealAll(p, [1, 1, 1]);
    const foreign = ('0x' + 'ab'.repeat(32)) as Hex;
    await expect(p.revealVerdict(VERDICT_HANDLE, [handles[0] as Hex, foreign, handles[2] as Hex]))
      .rejects.toThrow('LOCAL_UNKNOWN_SIGNAL_HANDLE');
  });

  it('requires exactly three signals', async () => {
    const p = provider();
    const handles = await sealAll(p, [1, 1, 1]);
    await expect(p.revealVerdict(VERDICT_HANDLE, handles.slice(0, 2))).rejects.toThrow(
      'LOCAL_EXPECTED_3_SIGNALS',
    );
  });
});

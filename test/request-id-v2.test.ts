import { describe, expect, it } from 'vitest';

import { deriveRequestIdV2 } from '../src/domain/index.js';
import type { Address, VendorId } from '../src/domain/types.js';

const vector = {
  vendorId: '0xfe8551dfbb91003d295270354cce2b6b94133f2dff360898e11a61edaa7df2fd' as VendorId,
  currentWallet: '0x1111111111111111111111111111111111111111' as Address,
  proposedWallet: '0x2222222222222222222222222222222222222222' as Address,
  requestedBy: '0x3333333333333333333333333333333333333333' as Address,
  nonce: 7n,
  approverEpoch: 1n,
  chainId: 11155111,
  firewallAddress: '0x4444444444444444444444444444444444444444' as Address,
};

describe('v2 request id derivation', () => {
  it('is deterministic', () => {
    expect(deriveRequestIdV2(vector)).toBe(deriveRequestIdV2(vector));
  });

  it('invalidates ids when the reviewer epoch changes', () => {
    expect(deriveRequestIdV2({ ...vector, approverEpoch: 2n })).not.toBe(deriveRequestIdV2(vector));
  });

  it('remains chain and deployment bound', () => {
    expect(deriveRequestIdV2({ ...vector, chainId: 421614 })).not.toBe(deriveRequestIdV2(vector));
    expect(
      deriveRequestIdV2({
        ...vector,
        firewallAddress: '0x5555555555555555555555555555555555555555' as Address,
      }),
    ).not.toBe(deriveRequestIdV2(vector));
  });
});

import { describe, expect, it } from 'vitest';

import { deriveRequestId, vendorId } from '../src/domain/index.js';
import type { Address, RequestIdInput } from '../src/domain/types.js';

/// Shared conformance vector. `test/solidity/RequestIdParity.t.sol` asserts the Solidity
/// implementation produces the same two values from the same inputs. If either side changes
/// its encoding, exactly one of the two suites goes red.
const VENDOR_LABEL = 'vendor:northwind-logistics';
const EXPECTED_VENDOR_ID = '0xfe8551dfbb91003d295270354cce2b6b94133f2dff360898e11a61edaa7df2fd';
const EXPECTED_REQUEST_ID = '0xed56ad482d904adff7f5248092a8b59c030beb539fbc1d915ddffc8a3747ea21';

const vector: RequestIdInput = {
  vendorId: EXPECTED_VENDOR_ID,
  currentWallet: '0x1111111111111111111111111111111111111111' as Address,
  proposedWallet: '0x2222222222222222222222222222222222222222' as Address,
  requestedBy: '0x3333333333333333333333333333333333333333' as Address,
  nonce: 7n,
  chainId: 11155111,
  firewallAddress: '0x4444444444444444444444444444444444444444' as Address,
};

describe('request id derivation', () => {
  it('derives the vendor id the contract expects', () => {
    expect(vendorId(VENDOR_LABEL)).toBe(EXPECTED_VENDOR_ID);
  });

  it('matches the pinned cross-language vector', () => {
    expect(deriveRequestId(vector)).toBe(EXPECTED_REQUEST_ID);
  });

  it('changes when the proposed destination changes', () => {
    const other = deriveRequestId({
      ...vector,
      proposedWallet: '0x9999999999999999999999999999999999999999' as Address,
    });
    expect(other).not.toBe(EXPECTED_REQUEST_ID);
  });

  it('changes across chains, so an approval cannot be replayed to another network', () => {
    expect(deriveRequestId({ ...vector, chainId: 421614 })).not.toBe(EXPECTED_REQUEST_ID);
  });

  it('changes across deployments, so an approval cannot be replayed to another contract', () => {
    const other = deriveRequestId({
      ...vector,
      firewallAddress: '0x5555555555555555555555555555555555555555' as Address,
    });
    expect(other).not.toBe(EXPECTED_REQUEST_ID);
  });

  it('changes with the nonce', () => {
    expect(deriveRequestId({ ...vector, nonce: 8n })).not.toBe(EXPECTED_REQUEST_ID);
  });
});

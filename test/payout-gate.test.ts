import { describe, expect, it } from 'vitest';

import { decidePayout, vendorId } from '../src/domain/index.js';
import type { Address, VendorRecord } from '../src/domain/types.js';

const VENDOR = vendorId('vendor:northwind-logistics');

const payoutWallet = '0x5000000000000000000000000000000000000005' as Address;
const attackerWallet = '0x6000000000000000000000000000000000000006' as Address;
const approver = '0x2000000000000000000000000000000000000002' as Address;

const registered: VendorRecord = {
  vendorId: VENDOR,
  payoutWallet,
  approver,
  registered: true,
};

describe('payout gate', () => {
  it('allows the vendor current payout wallet', () => {
    expect(decidePayout(registered, payoutWallet)).toEqual({
      status: 'allowed',
      reason: 'DESTINATION_UNCHANGED',
      vendorId: VENDOR,
      destination: payoutWallet,
    });
  });

  it('is case-insensitive about the destination', () => {
    const decision = decidePayout(registered, payoutWallet.toUpperCase().replace('0X', '0x') as Address);
    expect(decision.status).toBe('allowed');
  });

  it('blocks any destination the vendor has not been moved to', () => {
    expect(decidePayout(registered, attackerWallet)).toMatchObject({
      status: 'blocked',
      reason: 'APPROVAL_REQUIRED',
    });
  });

  it('fails closed for an unregistered vendor', () => {
    const unknown: VendorRecord = {
      vendorId: vendorId('vendor:ghost'),
      payoutWallet: '0x0000000000000000000000000000000000000000',
      approver: '0x0000000000000000000000000000000000000000',
      registered: false,
    };

    // Note the destination matches the (zeroed) payout wallet. A gate that checked equality
    // before registration would wrongly allow this.
    expect(
      decidePayout(unknown, '0x0000000000000000000000000000000000000000' as Address),
    ).toMatchObject({ status: 'blocked', reason: 'VENDOR_NOT_REGISTERED' });
  });

  it('blocks the zero address even for a registered vendor', () => {
    expect(decidePayout(registered, '0x0000000000000000000000000000000000000000' as Address)).toMatchObject({
      status: 'blocked',
      reason: 'ZERO_DESTINATION',
    });
  });

  it('never returns allowed without a matching payout wallet', () => {
    const destinations: Address[] = [
      attackerWallet,
      '0x0000000000000000000000000000000000000000' as Address,
      approver,
    ];

    for (const destination of destinations) {
      expect(decidePayout(registered, destination).status).toBe('blocked');
    }
  });
});

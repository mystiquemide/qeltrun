import { describe, expect, it } from 'vitest';

import { InvalidRequest, parseGatewayRequest } from '../web/lib/local-gateway-schema.js';

const APPROVER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const FIREWALL = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const HANDLE = `0x${'ab'.repeat(32)}`;

describe('local gateway request validation', () => {
  it('accepts a well-formed seal request', () => {
    expect(
      parseGatewayRequest({
        action: 'seal',
        approver: APPROVER,
        applicationContract: FIREWALL,
        approve: true,
      }),
    ).toEqual({ action: 'seal', approver: APPROVER, applicationContract: FIREWALL, approve: true });
  });

  it('accepts a well-formed reveal request', () => {
    expect(parseGatewayRequest({ action: 'reveal', handle: HANDLE })).toEqual({
      action: 'reveal',
      handle: HANDLE,
    });
  });

  it('rejects an unknown action', () => {
    expect(() => parseGatewayRequest({ action: 'settle' })).toThrow('INVALID_ACTION');
  });

  it('rejects a non-object body', () => {
    for (const body of [null, 'seal', 42, undefined]) {
      expect(() => parseGatewayRequest(body)).toThrow(InvalidRequest);
    }
  });

  it('rejects malformed addresses rather than passing them to the signer', () => {
    const cases: Array<Record<string, unknown>> = [
      { approver: '0x123', applicationContract: FIREWALL },
      { approver: APPROVER, applicationContract: 'not-an-address' },
      { approver: APPROVER.slice(2), applicationContract: FIREWALL },
      { applicationContract: FIREWALL },
    ];

    for (const overrides of cases) {
      expect(() => parseGatewayRequest({ action: 'seal', approve: true, ...overrides })).toThrow(
        /INVALID_(APPROVER|APPLICATION_CONTRACT)/,
      );
    }
  });

  it('requires approve to be an actual boolean, not a truthy string', () => {
    expect(() =>
      parseGatewayRequest({
        action: 'seal',
        approver: APPROVER,
        applicationContract: FIREWALL,
        approve: 'true',
      }),
    ).toThrow('INVALID_APPROVE');
  });

  // A missing handle used to reach the reveal path as `undefined` and surface as a confusing
  // lookup miss instead of a 400.
  it('rejects a reveal request with a missing or malformed handle', () => {
    for (const handle of [undefined, null, '0x', `0x${'ab'.repeat(31)}`, 'deadbeef']) {
      expect(() => parseGatewayRequest({ action: 'reveal', handle })).toThrow('INVALID_HANDLE');
    }
  });
});

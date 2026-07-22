/**
 * Request validation for the local gateway route.
 *
 * Kept out of the route module so it can be unit tested without standing up Next.
 */
export type Hex = `0x${string}`;
export type Address = Hex;

export type SealRequest = {
  action: 'seal';
  approver: Address;
  applicationContract: Address;
  approve: boolean;
};

export type RevealRequest = { action: 'reveal'; handle: Hex };

/// v2. One reviewer sealing an `euint16` position.
export type SealSignalRequest = {
  action: 'sealSignal';
  reviewer: Address;
  applicationContract: Address;
  signal: number;
};

/// v2. The verdict handle comes from `verdictHandle(requestId)` on chain, and the signal handles
/// identify which three positions it aggregates, so the gateway can compute the value it signs.
export type RevealVerdictRequest = {
  action: 'revealVerdict';
  verdictHandle: Hex;
  signalHandles: Hex[];
};

export type GatewayRequest =
  | SealRequest
  | RevealRequest
  | SealSignalRequest
  | RevealVerdictRequest;

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const BYTES32 = /^0x[0-9a-fA-F]{64}$/;

export class InvalidRequest extends Error {}

function requireAddress(value: unknown, field: string): Address {
  if (typeof value !== 'string' || !ADDRESS.test(value)) {
    throw new InvalidRequest(`INVALID_${field}: expected a 20-byte hex address`);
  }
  return value as Address;
}

/// Parses an untrusted body into a request the route can act on, or throws {@link InvalidRequest}.
///
/// Without this, a body missing `handle` reached the reveal path as `undefined` and surfaced as
/// a confusing lookup miss rather than a 400.
export function parseGatewayRequest(body: unknown): GatewayRequest {
  if (typeof body !== 'object' || body === null) {
    throw new InvalidRequest('INVALID_BODY: expected a JSON object');
  }

  const { action } = body as { action?: unknown };

  if (action === 'seal') {
    const { approver, applicationContract, approve } = body as Record<string, unknown>;
    if (typeof approve !== 'boolean') {
      throw new InvalidRequest('INVALID_APPROVE: expected a boolean');
    }
    return {
      action: 'seal',
      approver: requireAddress(approver, 'APPROVER'),
      applicationContract: requireAddress(applicationContract, 'APPLICATION_CONTRACT'),
      approve,
    };
  }

  if (action === 'reveal') {
    const { handle } = body as { handle?: unknown };
    if (typeof handle !== 'string' || !BYTES32.test(handle)) {
      throw new InvalidRequest('INVALID_HANDLE: expected a 32-byte hex handle');
    }
    return { action: 'reveal', handle: handle as Hex };
  }

  if (action === 'sealSignal') {
    const { reviewer, applicationContract, signal } = body as Record<string, unknown>;
    if (typeof signal !== 'number' || !Number.isInteger(signal) || signal < 0 || signal > 65535) {
      throw new InvalidRequest('INVALID_SIGNAL: expected an integer within uint16');
    }
    return {
      action: 'sealSignal',
      reviewer: requireAddress(reviewer, 'REVIEWER'),
      applicationContract: requireAddress(applicationContract, 'APPLICATION_CONTRACT'),
      signal,
    };
  }

  if (action === 'revealVerdict') {
    const { verdictHandle, signalHandles } = body as Record<string, unknown>;
    if (typeof verdictHandle !== 'string' || !BYTES32.test(verdictHandle)) {
      throw new InvalidRequest('INVALID_VERDICT_HANDLE: expected a 32-byte hex handle');
    }
    if (!Array.isArray(signalHandles) || signalHandles.length !== 3) {
      throw new InvalidRequest('INVALID_SIGNAL_HANDLES: expected exactly three handles');
    }
    for (const h of signalHandles) {
      if (typeof h !== 'string' || !BYTES32.test(h)) {
        throw new InvalidRequest('INVALID_SIGNAL_HANDLES: expected 32-byte hex handles');
      }
    }
    return {
      action: 'revealVerdict',
      verdictHandle: verdictHandle as Hex,
      signalHandles: signalHandles as Hex[],
    };
  }

  throw new InvalidRequest(
    'INVALID_ACTION: expected "seal", "reveal", "sealSignal" or "revealVerdict"',
  );
}

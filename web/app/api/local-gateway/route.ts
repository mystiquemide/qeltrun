import { NextResponse } from 'next/server';

import { LocalGatewayApprovalProvider } from '@qeltrun/local-gateway';

/**
 * The Nox gateway, for the local chain only.
 *
 * On Sepolia the browser talks to iExec's gateway through `@iexec-nox/handle`. There is no
 * such service for a Hardhat node, so this route plays the same role: it holds the key the
 * locally deployed NoxCompute was initialized with and issues genuine 137-byte input proofs
 * and compact decryption proofs. The contract verifies them with the real protocol code.
 *
 * The key below is Hardhat account #9 — a published development key with no funds on any real
 * network. This route refuses to run outside development so it can never be deployed.
 */
const LOCAL_GATEWAY_KEY = '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6';
const LOCAL_CHAIN_ID = 31337;

type SealBody = {
  action: 'seal';
  approver: `0x${string}`;
  applicationContract: `0x${string}`;
  approve: boolean;
};

type RevealBody = { action: 'reveal'; handle: `0x${string}` };

/// Sealed bits must survive between the seal request and the reveal request, so the provider
/// is process-wide rather than per-request. Dev-only, single user, so a module global is fine.
const providers = new Map<string, LocalGatewayApprovalProvider>();

function providerFor(approver: `0x${string}`): LocalGatewayApprovalProvider {
  const key = approver.toLowerCase();
  let provider = providers.get(key);
  if (provider === undefined) {
    provider = new LocalGatewayApprovalProvider({
      chainId: LOCAL_CHAIN_ID,
      gatewayPrivateKey: LOCAL_GATEWAY_KEY,
      approver,
    });
    providers.set(key, provider);
  }
  return provider;
}

/// A handle can be revealed by any caller once the contract marks it publicly decryptable,
/// exactly as on a live network, so reveal has to find the provider that minted it.
function providerHolding(handle: `0x${string}`): LocalGatewayApprovalProvider | undefined {
  for (const provider of providers.values()) {
    if (provider.knowsHandle(handle)) return provider;
  }
  return undefined;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'LOCAL_GATEWAY_DISABLED' }, { status: 404 });
  }

  const body = (await request.json()) as SealBody | RevealBody;

  try {
    if (body.action === 'seal') {
      const sealed = await providerFor(body.approver).sealApproval({
        approver: body.approver,
        applicationContract: body.applicationContract,
        approve: body.approve,
      });
      return NextResponse.json(sealed);
    }

    const provider = providerHolding(body.handle);
    if (provider === undefined) {
      return NextResponse.json({ error: `LOCAL_UNKNOWN_HANDLE:${body.handle}` }, { status: 404 });
    }
    return NextResponse.json(await provider.revealApproval(body.handle));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'LOCAL_GATEWAY_ERROR' },
      { status: 400 },
    );
  }
}

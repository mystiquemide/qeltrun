'use client';

import { useMemo } from 'react';
import { useReadContract } from 'wagmi';

import { FIREWALL_ABI } from './firewall-abi';
import type { Address, Deployment, Hex } from './config';

export type RequestStatus = 'none' | 'pending' | 'sealed' | 'settled';
const STATUSES: RequestStatus[] = ['none', 'pending', 'sealed', 'settled'];

export function statusFrom(index: number | bigint | undefined): RequestStatus {
  return STATUSES[Number(index ?? 0)] ?? 'none';
}

const POLL = { refetchInterval: 4000 } as const;

/// Reading the chain needs no wallet. The whole dashboard renders from these hooks, so a judge
/// who never connects still sees live on-chain state rather than an empty shell.
export function useGate(deployment: Deployment | undefined, destination: Address | undefined) {
  return useReadContract({
    abi: FIREWALL_ABI,
    address: deployment?.firewall,
    functionName: 'isPayoutAllowed',
    args: deployment !== undefined && destination !== undefined
      ? [deployment.demoVendor.vendorId, destination]
      : undefined,
    chainId: deployment?.chainId,
    query: { enabled: deployment !== undefined && destination !== undefined, ...POLL },
  });
}

export function useVendor(deployment: Deployment | undefined) {
  return useReadContract({
    abi: FIREWALL_ABI,
    address: deployment?.firewall,
    functionName: 'getVendor',
    args: deployment !== undefined ? [deployment.demoVendor.vendorId] : undefined,
    chainId: deployment?.chainId,
    query: { enabled: deployment !== undefined, ...POLL },
  });
}

export function useRequest(deployment: Deployment | undefined, requestId: Hex | undefined) {
  return useReadContract({
    abi: FIREWALL_ABI,
    address: deployment?.firewall,
    functionName: 'getRequest',
    args: requestId !== undefined ? [requestId] : undefined,
    chainId: deployment?.chainId,
    query: { enabled: deployment !== undefined && requestId !== undefined, ...POLL },
  });
}

export function useNoxComputeAddress(deployment: Deployment | undefined) {
  return useReadContract({
    abi: FIREWALL_ABI,
    address: deployment?.firewall,
    functionName: 'noxComputeAddress',
    chainId: deployment?.chainId,
    query: { enabled: deployment !== undefined },
  });
}

/// Ask the contract for the request id rather than deriving it in the browser. The off-chain
/// derivation exists and is tested against the Solidity one, but the contract is the authority
/// and a `deriveRequestId` call costs nothing.
export function useDerivedRequestId(
  deployment: Deployment | undefined,
  currentWallet: Address | undefined,
  proposedWallet: Address | undefined,
  requestedBy: Address | undefined,
  nonce: bigint,
) {
  const enabled =
    deployment !== undefined &&
    currentWallet !== undefined &&
    proposedWallet !== undefined &&
    requestedBy !== undefined &&
    currentWallet !== proposedWallet;

  return useReadContract({
    abi: FIREWALL_ABI,
    address: deployment?.firewall,
    functionName: 'deriveRequestId',
    args: enabled
      ? [deployment.demoVendor.vendorId, currentWallet, proposedWallet, requestedBy, nonce]
      : undefined,
    chainId: deployment?.chainId,
    query: { enabled },
  });
}

export type VendorView = {
  payoutWallet: Address;
  approver: Address;
  registered: boolean;
};

export function useVendorView(deployment: Deployment | undefined): {
  vendor: VendorView | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useVendor(deployment);

  const vendor = useMemo<VendorView | undefined>(() => {
    if (data === undefined) return undefined;
    const record = data as unknown as VendorView;
    return {
      payoutWallet: record.payoutWallet,
      approver: record.approver,
      registered: record.registered,
    };
  }, [data]);

  return { vendor, isLoading, error: error as Error | null };
}

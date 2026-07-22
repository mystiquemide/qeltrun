'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { usePublicClient, useReadContract } from 'wagmi';

import { FIREWALL_V2_ABI } from '@qeltrun/abi';
import { isLocalChain, type Address, type Deployment, type Hex } from './config';

/// Mirrors `QeltrunPayoutFirewallV2.RequestStatus`. Index order is part of the ABI, and it
/// differs from v1: `collecting` replaced `pending` because a request now gathers three signals
/// before it can seal.
export type RequestStatus = 'none' | 'collecting' | 'sealed' | 'settled';
const STATUSES: RequestStatus[] = ['none', 'collecting', 'sealed', 'settled'];

export function statusFrom(index: number | bigint | undefined): RequestStatus {
  return STATUSES[Number(index ?? 0)] ?? 'none';
}

const POLL = { refetchInterval: 4000 } as const;

const abi = FIREWALL_V2_ABI;

/// Reading the chain needs no wallet. The whole console renders from these hooks, so somebody who
/// never connects still sees live on-chain state rather than an empty shell.
export function useGate(deployment: Deployment | undefined, destination: Address | undefined) {
  return useReadContract({
    abi,
    address: deployment?.firewall,
    functionName: 'isPayoutAllowed',
    args:
      deployment !== undefined && destination !== undefined
        ? [deployment.demoVendor.vendorId, destination]
        : undefined,
    chainId: deployment?.chainId,
    query: { enabled: deployment !== undefined && destination !== undefined, ...POLL },
  });
}

export function useVendor(deployment: Deployment | undefined) {
  return useReadContract({
    abi,
    address: deployment?.firewall,
    functionName: 'getVendor',
    args: deployment !== undefined ? [deployment.demoVendor.vendorId] : undefined,
    chainId: deployment?.chainId,
    query: { enabled: deployment !== undefined, ...POLL },
  });
}

export function useRequest(deployment: Deployment | undefined, requestId: Hex | undefined) {
  return useReadContract({
    abi,
    address: deployment?.firewall,
    functionName: 'getRequest',
    args: requestId !== undefined ? [requestId] : undefined,
    chainId: deployment?.chainId,
    query: { enabled: deployment !== undefined && requestId !== undefined, ...POLL },
  });
}

export function usePaused(deployment: Deployment | undefined) {
  return useReadContract({
    abi,
    address: deployment?.firewall,
    functionName: 'paused',
    chainId: deployment?.chainId,
    query: { enabled: deployment !== undefined, ...POLL },
  });
}

export function useNoxComputeAddress(deployment: Deployment | undefined) {
  return useReadContract({
    abi,
    address: deployment?.firewall,
    functionName: 'noxComputeAddress',
    chainId: deployment?.chainId,
    query: { enabled: deployment !== undefined },
  });
}

/// Whether one reviewer has already sealed a position on this request. This is what lets the
/// console show who has signed without revealing how any of them went.
export function useHasSubmitted(
  deployment: Deployment | undefined,
  requestId: Hex | undefined,
  reviewer: Address | undefined,
) {
  const enabled =
    deployment !== undefined && requestId !== undefined && reviewer !== undefined;
  return useReadContract({
    abi,
    address: deployment?.firewall,
    functionName: 'hasSubmittedSignal',
    args: enabled ? [requestId, reviewer] : undefined,
    chainId: deployment?.chainId,
    query: { enabled, ...POLL },
  });
}

export function useVerdictHandle(deployment: Deployment | undefined, requestId: Hex | undefined) {
  return useReadContract({
    abi,
    address: deployment?.firewall,
    functionName: 'verdictHandle',
    args: requestId !== undefined ? [requestId] : undefined,
    chainId: deployment?.chainId,
    query: { enabled: deployment !== undefined && requestId !== undefined, ...POLL },
  });
}

export function useAggregateHandle(deployment: Deployment | undefined, requestId: Hex | undefined) {
  return useReadContract({
    abi,
    address: deployment?.firewall,
    functionName: 'aggregateScoreHandle',
    args: requestId !== undefined ? [requestId] : undefined,
    chainId: deployment?.chainId,
    query: { enabled: deployment !== undefined && requestId !== undefined, ...POLL },
  });
}

/// How far back to look for a request on a public chain, roughly a week of Sepolia blocks. A
/// request left open longer than that stops being discoverable. Widening this is the wrong fix,
/// because an unbounded range is what makes a hosted RPC refuse the call.
const REQUEST_LOOKBACK = 50_000n;

/**
 * The vendor's most recent change request, found from chain.
 *
 * The request id hashes in the `msg.sender` that opened the request, so deriving it from the
 * connected wallet only ever resolves for that one wallet. The other two reviewers would each
 * derive a different id and be told there is no request to sign, which kills the whole
 * three-reviewer flow. `ChangeRequestOpened` is the shared source: all three reviewers, and a
 * visitor with no wallet at all, land on the same id.
 */
export function useOpenRequestId(deployment: Deployment | undefined) {
  const publicClient = usePublicClient({ chainId: deployment?.chainId });
  const enabled = deployment !== undefined && publicClient !== undefined;

  const { data, refetch } = useQuery({
    queryKey: [
      'qeltrun',
      'open-request',
      deployment?.chainId,
      deployment?.firewall,
      deployment?.demoVendor.vendorId,
    ],
    enabled,
    refetchInterval: 4000,
    queryFn: async (): Promise<Hex | null> => {
      if (!enabled) return null;
      // The local chain is short and starts at block 0, so scanning all of it is free. A public
      // chain needs a bound.
      let fromBlock = 0n;
      if (!isLocalChain(deployment.chainId)) {
        const head = await publicClient.getBlockNumber();
        fromBlock = head > REQUEST_LOOKBACK ? head - REQUEST_LOOKBACK : 0n;
      }
      const logs = await publicClient.getContractEvents({
        abi,
        address: deployment.firewall,
        eventName: 'ChangeRequestOpened',
        args: { vendorId: deployment.demoVendor.vendorId },
        fromBlock,
        toBlock: 'latest',
      });
      return (logs.at(-1)?.args.requestId as Hex | undefined) ?? null;
    },
  });

  return { requestId: data ?? undefined, refetch };
}

/**
 * The sealed signal handles for a request, found from chain rather than kept in local state.
 *
 * The local gateway computes the verdict from the three plaintexts it minted, so it needs the
 * exact three handles back to look them up - it does not just use whatever it has minted most
 * recently, since a dev server accumulates handles across every run against it. A handle sealed
 * by one reviewer only ever lived in that reviewer's own browser tab, so whoever ends up clicking
 * settle - permissionless, and often a different wallet from any of the three reviewers - would
 * otherwise only have their own handle, if any. `PrivateSignalSubmitted` is the shared source,
 * the same fix `useOpenRequestId` already made for the request id itself.
 */
export function useSignalHandles(deployment: Deployment | undefined, requestId: Hex | undefined) {
  const publicClient = usePublicClient({ chainId: deployment?.chainId });
  const enabled = deployment !== undefined && publicClient !== undefined && requestId !== undefined;

  const { data, refetch } = useQuery({
    queryKey: ['qeltrun', 'signal-handles', deployment?.chainId, deployment?.firewall, requestId],
    enabled,
    refetchInterval: 4000,
    queryFn: async (): Promise<Hex[]> => {
      if (!enabled) return [];
      let fromBlock = 0n;
      if (!isLocalChain(deployment.chainId)) {
        const head = await publicClient.getBlockNumber();
        fromBlock = head > REQUEST_LOOKBACK ? head - REQUEST_LOOKBACK : 0n;
      }
      const logs = await publicClient.getContractEvents({
        abi,
        address: deployment.firewall,
        eventName: 'PrivateSignalSubmitted',
        args: { requestId },
        fromBlock,
        toBlock: 'latest',
      });
      return logs.map((log) => log.args.handle as Hex);
    },
  });

  return { signalHandles: data ?? [], refetch };
}

export type VendorView = {
  payoutWallet: Address;
  approver: Address;
  treasuryReviewer: Address;
  riskReviewer: Address;
  approverEpoch: bigint;
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
    const r = data as unknown as VendorView;
    return {
      payoutWallet: r.payoutWallet,
      approver: r.approver,
      treasuryReviewer: r.treasuryReviewer,
      riskReviewer: r.riskReviewer,
      approverEpoch: r.approverEpoch,
      registered: r.registered,
    };
  }, [data]);

  return { vendor, isLoading, error: error as Error | null };
}

export type ReviewerRole = 'approver' | 'treasury' | 'risk';

export const ROLE_LABELS: Record<ReviewerRole, string> = {
  approver: 'Approver',
  treasury: 'Treasury',
  risk: 'Risk',
};

/// Which of the three seats a connected wallet holds, if any. Returns undefined for a wallet that
/// is not a reviewer, which is the common case and needs saying plainly in the UI.
export function roleFor(
  vendor: VendorView | undefined,
  address: Address | undefined,
): ReviewerRole | undefined {
  if (vendor === undefined || address === undefined) return undefined;
  const a = address.toLowerCase();
  if (a === vendor.approver.toLowerCase()) return 'approver';
  if (a === vendor.treasuryReviewer.toLowerCase()) return 'treasury';
  if (a === vendor.riskReviewer.toLowerCase()) return 'risk';
  return undefined;
}

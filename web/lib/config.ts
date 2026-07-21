import { defineChain } from 'viem';
import { sepolia } from 'viem/chains';

import localDeployment from '../deployment.local.json';

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

/// The Hardhat node `pnpm run node` starts. The web app talks to a real chain in both modes;
/// the only thing that differs is which one.
export const hardhatLocal = defineChain({
  id: 31337,
  name: 'Hardhat',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
});

/// The chains wagmi is configured for. Typing deployments to this union means a chain id that
/// wagmi cannot reach is a compile error rather than a runtime "no transport" failure.
export type SupportedChainId = typeof hardhatLocal.id | typeof sepolia.id;

export type Deployment = {
  chainId: SupportedChainId;
  firewall: Address;
  noxCompute: Address;
  /// Present only for the local chain, where our own route handler plays the gateway role.
  gateway?: Address;
  demoVendor: {
    label: string;
    vendorId: Hex;
    payoutWallet: Address;
    approver: Address;
  };
};

const sepoliaFirewall = process.env.NEXT_PUBLIC_SEPOLIA_FIREWALL as Address | undefined;
const sepoliaVendorLabel = process.env.NEXT_PUBLIC_SEPOLIA_VENDOR_LABEL ?? 'vendor:northwind-logistics';
const sepoliaVendorId = process.env.NEXT_PUBLIC_SEPOLIA_VENDOR_ID as Hex | undefined;
const sepoliaPayoutWallet = process.env.NEXT_PUBLIC_SEPOLIA_PAYOUT_WALLET as Address | undefined;
const sepoliaApprover = process.env.NEXT_PUBLIC_SEPOLIA_APPROVER as Address | undefined;

/// NoxCompute on Ethereum Sepolia, per `@iexec-nox/handle`'s network config.
export const SEPOLIA_NOX_COMPUTE = '0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF' as Address;

export const deployments: Record<number, Deployment> = {
  [localDeployment.chainId]: localDeployment as Deployment,
  ...(sepoliaFirewall !== undefined &&
  sepoliaVendorId !== undefined &&
  sepoliaPayoutWallet !== undefined &&
  sepoliaApprover !== undefined
    ? {
        [sepolia.id]: {
          chainId: sepolia.id,
          firewall: sepoliaFirewall,
          noxCompute: SEPOLIA_NOX_COMPUTE,
          demoVendor: {
            label: sepoliaVendorLabel,
            vendorId: sepoliaVendorId,
            payoutWallet: sepoliaPayoutWallet,
            approver: sepoliaApprover,
          },
        } satisfies Deployment,
      }
    : {}),
};

export const supportedChains = [hardhatLocal, sepolia] as const;

export function deploymentFor(chainId: number | undefined): Deployment | undefined {
  return chainId === undefined ? undefined : deployments[chainId];
}

export function isLocalChain(chainId: number | undefined): boolean {
  return chainId === hardhatLocal.id;
}

export function explorerTxUrl(chainId: number, hash: Hex): string | undefined {
  return chainId === sepolia.id ? `https://sepolia.etherscan.io/tx/${hash}` : undefined;
}

export function explorerAddressUrl(chainId: number, address: Address): string | undefined {
  return chainId === sepolia.id ? `https://sepolia.etherscan.io/address/${address}` : undefined;
}

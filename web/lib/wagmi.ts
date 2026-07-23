import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { http, createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';

import { hardhatLocal } from './config';

/// WalletConnect needs a project id. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID from
/// cloud.reown.com. The fallback keeps the build working; WalletConnect will not connect until a
/// real id is set, but the injected wallets (MetaMask, Rabby, any EIP-6963 wallet) still work.
///
/// `||`, not `??`: `.env.local` declares this key with an empty value to document it, and `??`
/// only falls back on `null`/`undefined`, not `''`. With `??` the fallback never fired, RainbowKit
/// received an empty string, and `next build` failed prerendering every page with "No projectId
/// found".
const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'qeltrun-set-a-real-project-id';

/**
 * A curated wallet list, on purpose.
 *
 * RainbowKit's default set pulls in the Coinbase connector, whose optional `@x402/*` dependencies
 * do not resolve in this workspace. Naming the wallets keeps that connector out while still giving
 * a reviewer MetaMask, Rabby, any injected wallet, and WalletConnect for mobile. Importing three
 * throwaway reviewer keys, which the demo needs, works with any of them.
 */
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet, rabbyWallet, injectedWallet, walletConnectWallet],
    },
  ],
  {
    appName: 'Qeltrun',
    projectId: WALLETCONNECT_PROJECT_ID,
  },
);

/// Tenderly's public Sepolia gateway. It is the default because it supports the wide
/// `eth_getLogs` range the console uses to discover requests, and it needs no API key. Alchemy's
/// free tier caps `getLogs` at ten blocks, which the request scan cannot work within. Override
/// with NEXT_PUBLIC_SEPOLIA_RPC_URL.
const SEPOLIA_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? 'https://sepolia.gateway.tenderly.co';

/// Sepolia is listed first so the app defaults to the live chain. The local Hardhat chain stays
/// available for development.
export const wagmiConfig = createConfig({
  chains: [sepolia, hardhatLocal],
  connectors,
  transports: {
    [hardhatLocal.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(SEPOLIA_RPC),
  },
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}

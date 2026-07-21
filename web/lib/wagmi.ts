import { http, createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';

import { hardhatLocal } from './config';

/// No explicit connectors. wagmi discovers injected wallets over EIP-6963, which covers every
/// browser wallet a reviewer is likely to have and lists them by name.
///
/// Importing from `wagmi/connectors` would pull the whole connector barrel — including the
/// Base/Coinbase SDK, whose optional `@x402/*` dependencies do not resolve — into a bundle that
/// only ever needs `injected`. WalletConnect is deliberately absent too: it needs a project id
/// and a relay round trip, which is one more thing to fail during a live demo.
export const wagmiConfig = createConfig({
  chains: [hardhatLocal, sepolia],
  multiInjectedProviderDiscovery: true,
  transports: {
    [hardhatLocal.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? undefined),
  },
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}

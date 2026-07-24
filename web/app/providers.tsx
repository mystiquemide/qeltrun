'use client';

import '@rainbow-me/rainbowkit/styles.css';

import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useState } from 'react';
import { WagmiProvider } from 'wagmi';

import { wagmiConfig } from '@/lib/wagmi';

/// The connect modal is themed to the console: phosphor-green accent on a near-black surface, so
/// it does not look like a bolt-on when it opens over the terminal.
const rainbowTheme = darkTheme({
  accentColor: '#4ade80',
  accentColorForeground: '#04120a',
  borderRadius: 'small',
  overlayBlur: 'small',
});

export function Providers({ children }: { children: React.ReactNode }) {
  // One client per mount, created lazily so the server render and the client render agree.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );

  return (
    // reducedMotion="user" makes every motion.* component in the app defer to the OS setting
    // automatically, so individual components never need their own useReducedMotion() check.
    <MotionConfig reducedMotion="user">
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={rainbowTheme} modalSize="compact">
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </MotionConfig>
  );
}

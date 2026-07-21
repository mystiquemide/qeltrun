import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const here = dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  reactStrictMode: true,
  // The gate logic and request-id derivation live in `../src/domain` and are shared with the
  // contract tests. Compiling them here rather than copying them is what keeps the UI from
  // drifting away from the thing it is a client for.
  transpilePackages: [],
  webpack(cfg) {
    // `../src` is written as NodeNext ESM, so its relative imports carry `.js` extensions that
    // point at `.ts` files on disk.
    cfg.resolve.extensionAlias = { ...cfg.resolve.extensionAlias, '.js': ['.ts', '.js'] };
    cfg.resolve.alias = {
      ...cfg.resolve.alias,
      '@qeltrun/domain': join(here, '../src/domain/index.ts'),
      '@qeltrun/local-gateway': join(here, '../src/providers/local-gateway-approval-provider.ts'),
    };
    // Optional node built-ins reached for by wallet connectors, never executed in the browser.
    cfg.resolve.fallback = { ...cfg.resolve.fallback, fs: false, net: false, tls: false };
    return cfg;
  },
};

export default config;

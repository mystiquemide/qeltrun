import type { Metadata } from 'next';

import { C, Callout, Code, DocHeader, H2, P, Related } from '@/components/docs/prose';

export const metadata: Metadata = {
  title: 'CLI commands: Qeltrun docs',
  description: 'The pnpm scripts for building, testing, deploying, and verifying Qeltrun.',
  alternates: { canonical: '/docs/cli' },
};

export default function Page() {
  return (
    <article>
      <DocHeader
        kind="Reference"
        title="CLI commands"
        intro="Qeltrun uses pnpm scripts. Run each with pnpm run <name> in the repository root."
      />

      <Callout tone="note" title="Source of truth">
        These commands are defined in <C>package.json</C>. This page groups them by task.
      </Callout>

      <H2 id="develop">Develop</H2>
      <Code>{`pnpm install            # install dependencies
pnpm run node           # start a local Hardhat node
pnpm run setup:local    # deploy the firewall and register the demo vendor
pnpm --filter qeltrun-web dev   # start the web app on port 3000`}</Code>

      <H2 id="test">Test and check</H2>
      <Code>{`pnpm test               # TypeScript unit tests (vitest)
pnpm run test:sol       # Solidity tests against the real NoxCompute
pnpm run test:sol:deep  # Solidity tests with deep fuzz and invariant runs
pnpm run demo           # end-to-end lifecycle, asserts each checkpoint
pnpm run verify         # the full CI check: types, tests, compile, ABI, docs`}</Code>

      <H2 id="build">Build and audit</H2>
      <Code>{`pnpm run compile        # compile the contracts
pnpm run export:abi:v2  # regenerate the v2 ABI the web app imports
pnpm run build:web      # production build of the web app
pnpm run lint:sol       # solhint
pnpm run audit:deps     # dependency vulnerability audit`}</Code>

      <H2 id="deploy">Deploy and verify live</H2>
      <Code>{`pnpm run deploy:v2:sepolia         # deploy the firewall to Sepolia
pnpm run verify:live:v2            # full lifecycle against the live gateway
pnpm run verify:live:v2:governance # rotation and recovery against Sepolia`}</Code>
      <P>
        The deploy and live-verify commands need <C>SEPOLIA_RPC_URL</C> and <C>PRIVATE_KEY</C> in
        the shell environment. See the deploy guide.
      </P>

      <Related
        links={[
          { label: 'Deploy to Sepolia', href: '/docs/deploy-sepolia' },
          { label: 'Configuration', href: '/docs/configuration' },
          { label: 'Local development', href: '/docs/local-development' },
        ]}
      />
    </article>
  );
}

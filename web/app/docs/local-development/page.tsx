import type { Metadata } from 'next';

import { C, Callout, Code, DocHeader, H2, P, Related, UL } from '@/components/docs/prose';

export const metadata: Metadata = {
  title: 'Local development: Qeltrun docs',
  description: 'The local development workflow: the chain, the console, the tests, and the checks.',
  alternates: { canonical: '/docs/local-development' },
};

export default function Page() {
  return (
    <article>
      <DocHeader
        kind="Tutorial"
        title="Local development"
        intro="How the local chain, the console, and the test suite fit together, and the checks that gate a change."
      />

      <H2 id="layout">Repository layout</H2>
      <UL>
        <li>
          <C>contracts/</C> holds the Solidity: the firewall, the NoxCompute test environment, and
          the Safe payout module.
        </li>
        <li>
          <C>src/</C> holds the shared TypeScript: the domain logic, the request-id derivation, and
          the Nox providers. The web app imports these directly.
        </li>
        <li>
          <C>web/</C> holds the Next.js app: the marketing pages, the <C>/proof</C> page, and the
          console.
        </li>
        <li>
          <C>scripts/</C> holds the deploy, setup, and live-verification scripts.
        </li>
      </UL>
      <Callout tone="note" title="One source of the gate logic">
        The console does not reimplement the gate. It imports the same domain code the contract
        tests use, so the UI cannot drift from the contract it is a client for.
      </Callout>

      <H2 id="chain">The local chain</H2>
      <P>
        The app never simulates the chain. <C>pnpm run node</C> starts a Hardhat node, and{' '}
        <C>pnpm run setup:local</C> deploys the real firewall and the real NoxCompute environment
        onto it. The only difference from Sepolia is which chain the app reads.
      </P>
      <P>
        Rerun <C>pnpm run setup:local</C> after a contract change to redeploy without restarting the
        node. The NoxCompute environment initializes once, so a clean chain needs a node restart.
      </P>

      <H2 id="tests">Run the tests</H2>
      <P>Run the TypeScript unit tests:</P>
      <Code>pnpm test</Code>
      <P>Run the Solidity tests, which run against the real NoxCompute rather than a mock:</P>
      <Code>pnpm run test:sol</Code>
      <P>
        Run the full check the CI uses. It runs the type check, both test suites, the contract
        compile, the ABI export, and the documented-count check:
      </P>
      <Code>pnpm run verify</Code>

      <H2 id="demo">Run the end-to-end demo</H2>
      <P>
        <C>pnpm run demo</C> runs the full lifecycle against an in-process chain and asserts each
        checkpoint. It prints the blocked payout, the sealed approval, and the allowed payout.
      </P>
      <Code>pnpm run demo</Code>

      <Related
        links={[
          { label: 'Quickstart', href: '/docs/quickstart' },
          { label: 'CLI commands', href: '/docs/cli' },
          { label: 'Architecture', href: '/docs/architecture' },
        ]}
      />
    </article>
  );
}

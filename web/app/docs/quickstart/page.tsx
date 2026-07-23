import type { Metadata } from 'next';

import { C, Callout, Code, DocHeader, H2, OL, P, Related, UL } from '@/components/docs/prose';

export const metadata: Metadata = {
  title: 'Quickstart: Qeltrun docs',
  description: 'Run Qeltrun on a local chain in five commands and watch the payout gate flip.',
  alternates: { canonical: '/docs/quickstart' },
};

export default function Page() {
  return (
    <article>
      <DocHeader
        kind="Tutorial"
        title="Quickstart"
        intro="Run Qeltrun on a local chain, open the console, and watch the gate move from blocked to allowed."
      />

      <H2 id="prerequisites">Prerequisites</H2>
      <UL>
        <li>Node.js 20 or later.</li>
        <li>
          pnpm 9 or later. Install it with <C>npm install -g pnpm</C>.
        </li>
        <li>A clone of the repository.</li>
      </UL>

      <H2 id="install">Install dependencies</H2>
      <P>Run this once in the repository root:</P>
      <Code>pnpm install</Code>
      <Callout tone="note" title="Build scripts">
        pnpm asks before it runs a package build script. If a postinstall step is blocked, run{' '}
        <C>pnpm approve-builds</C> and allow the listed packages.
      </Callout>

      <H2 id="start">Start a local chain and deploy</H2>
      <P>Use two terminals. In the first, start a Hardhat node and leave it running:</P>
      <Code>pnpm run node</Code>
      <P>
        In the second, deploy the firewall and register the demo vendor with three reviewers:
      </P>
      <Code>pnpm run setup:local</Code>
      <P>
        The command prints the deployed firewall address and the three reviewer accounts. It also
        writes <C>web/deployment.local.json</C>, which the app reads.
      </P>

      <H2 id="run">Run the console</H2>
      <P>Start the web app:</P>
      <Code>pnpm --filter qeltrun-web dev</Code>
      <P>
        Open <C>http://localhost:3000/app</C>. The console reads the local chain and shows the
        payout gate as <C>Payout blocked</C>, because the tested destination is not the address the
        vendor is cleared for.
      </P>

      <H2 id="drive">Drive the gate</H2>
      <OL>
        <li>Import the three reviewer keys the setup command printed into a browser wallet.</li>
        <li>
          Connect the first reviewer and select <C>Request the change</C>.
        </li>
        <li>Seal an approve position with each of the three reviewers in turn.</li>
        <li>
          Select <C>Reveal and settle</C>. The gateway decrypts the verdict and the contract moves
          the payout address.
        </li>
      </OL>
      <P>
        The gate now reads <C>Payout allowed</C>. You moved a payout destination through a sealed
        three-reviewer approval, with no reviewer able to see how the others voted.
      </P>

      <Callout tone="warning" title="One request per chain">
        Each request settles once. To run the flow again, restart the node and rerun{' '}
        <C>pnpm run setup:local</C> for a clean chain.
      </Callout>

      <Related
        links={[
          { label: 'Local development', href: '/docs/local-development' },
          { label: 'Run the three-reviewer flow', href: '/docs/reviewer-flow' },
          { label: 'Confidential approval', href: '/docs/confidential-model' },
        ]}
      />
    </article>
  );
}

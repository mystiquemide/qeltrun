import type { Metadata } from 'next';

import { C, Callout, Code, DocHeader, H2, OL, P, Related, UL } from '@/components/docs/prose';

export const metadata: Metadata = {
  title: 'Deploy to Sepolia: Qeltrun docs',
  description: 'Deploy the firewall to Ethereum Sepolia and verify it against the live iExec Nox gateway.',
  alternates: { canonical: '/docs/deploy-sepolia' },
};

export default function Page() {
  return (
    <article>
      <DocHeader
        kind="How-to"
        title="Deploy to Sepolia"
        intro="Deploy the firewall to Ethereum Sepolia and run the full lifecycle against the live iExec Nox gateway."
      />

      <H2 id="prerequisites">Prerequisites</H2>
      <UL>
        <li>A funded Sepolia account. The deploy sends transactions and pays gas.</li>
        <li>A Sepolia RPC URL from a provider such as Alchemy or Infura.</li>
        <li>The account's private key.</li>
      </UL>
      <Callout tone="warning" title="Keys stay in Hardhat only">
        <C>PRIVATE_KEY</C>, <C>SEPOLIA_RPC_URL</C>, and <C>TREASURY_SAFE</C> are read by Hardhat
        only. Never put them in the web app or in any <C>NEXT_PUBLIC_</C> variable. A{' '}
        <C>NEXT_PUBLIC_</C> value ships in the browser bundle.
      </Callout>

      <H2 id="env">Set the environment</H2>
      <P>
        Hardhat reads these from the process environment, not from a file. Export them in the shell
        that runs the deploy:
      </P>
      <Code>{`export SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
export PRIVATE_KEY="0xYOUR_KEY"`}</Code>

      <H2 id="deploy">Deploy the firewall</H2>
      <P>Deploy the v2 firewall:</P>
      <Code>pnpm run deploy:v2:sepolia</Code>
      <P>The script prints the deployed firewall address. Save it for the next step.</P>

      <H2 id="verify">Verify against the live gateway</H2>
      <P>
        Run the live verification. It opens a request, seals three reviewer positions, decrypts the
        verdict through the real gateway, and settles:
      </P>
      <Code>pnpm run verify:live:v2</Code>
      <Callout tone="note" title="The subgraph indexing wait">
        The gateway resolves access from a subgraph, so it can refuse a handle that is already
        publicly decryptable on chain for about a minute after sealing. The verifier retries that
        specific case. This is expected and is written up in the repository feedback notes.
      </Callout>

      <H2 id="frontend">Point the web app at the deployment</H2>
      <P>
        Set these in <C>web/.env.local</C> so the console reads your Sepolia deployment. The console
        reads only <C>NEXT_PUBLIC_</C> values:
      </P>
      <Code>{`NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_SEPOLIA_FIREWALL_V2=0xYOUR_FIREWALL
NEXT_PUBLIC_SEPOLIA_VENDOR_ID=0xYOUR_VENDOR_ID
NEXT_PUBLIC_SITE_URL=https://your-domain`}</Code>
      <OL>
        <li>Build the app with these set.</li>
        <li>
          Open <C>/app</C>. The console header now reads the Sepolia chain instead of the local
          chain.
        </li>
      </OL>

      <Related
        links={[
          { label: 'Configuration', href: '/docs/configuration' },
          { label: 'CLI commands', href: '/docs/cli' },
          { label: 'Firewall contract', href: '/docs/contracts' },
        ]}
      />
    </article>
  );
}

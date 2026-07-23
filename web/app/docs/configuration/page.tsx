import type { Metadata } from 'next';

import { C, Callout, Code, DocHeader, H2, P, Related } from '@/components/docs/prose';

export const metadata: Metadata = {
  title: 'Configuration: Qeltrun docs',
  description: 'Every environment variable Qeltrun reads, split by where it is safe to put it.',
  alternates: { canonical: '/docs/configuration' },
};

export default function Page() {
  return (
    <article>
      <DocHeader
        kind="Reference"
        title="Configuration"
        intro="Qeltrun reads two kinds of variable: secrets that stay in the Hardhat process, and public NEXT_PUBLIC_ values that ship in the browser bundle."
      />

      <Callout tone="warning" title="The split matters">
        A <C>NEXT_PUBLIC_</C> value is compiled into the browser bundle and is readable by anyone.
        Never put a private key or an unrestricted secret behind that prefix. Keep secrets in the
        Hardhat-only group below.
      </Callout>

      <H2 id="hardhat">Hardhat only (secrets)</H2>
      <P>
        Read from the process environment by Hardhat and the scripts. Export them in the shell.
        Never copy them into <C>web/.env.local</C>.
      </P>
      <Code>{`SEPOLIA_RPC_URL     # Sepolia RPC endpoint for deploy and live verify
PRIVATE_KEY         # deployer key, pays gas, signs transactions
TREASURY_SAFE       # the Safe that owns the firewall
ETHERSCAN_API_KEY   # optional, for source verification
FIREWALL_ADDRESS    # the firewall to exercise in verify:live`}</Code>

      <H2 id="web">Web app (public)</H2>
      <P>
        Read by the console from <C>web/.env.local</C>. All ship in the browser bundle by design.
        Leave them unset to run against the local chain.
      </P>
      <Code>{`NEXT_PUBLIC_SEPOLIA_RPC_URL       # RPC the browser reads Sepolia through
NEXT_PUBLIC_SEPOLIA_FIREWALL_V2   # deployed v2 firewall address
NEXT_PUBLIC_SEPOLIA_VENDOR_ID     # demo vendor id
NEXT_PUBLIC_SEPOLIA_VENDOR_LABEL  # demo vendor label
NEXT_PUBLIC_SEPOLIA_SAFE_MODULE   # optional Safe payout module address
NEXT_PUBLIC_SEPOLIA_PROPOSED_WALLET  # the destination the gate tests
NEXT_PUBLIC_SITE_URL              # origin for social card image URLs`}</Code>

      <Callout tone="note" title="The RPC key is public by design">
        The browser needs an RPC endpoint, so <C>NEXT_PUBLIC_SEPOLIA_RPC_URL</C> ships in the
        bundle. Restrict that key by domain at the provider rather than treating it as a secret.
      </Callout>

      <H2 id="proposed">Choosing the tested destination</H2>
      <P>
        <C>NEXT_PUBLIC_SEPOLIA_PROPOSED_WALLET</C> is the address the console tests the gate against.
        It must not be the vendor's current payout wallet, or the gate opens on allowed with nothing
        to show. Use an address the reviewers have not cleared.
      </P>

      <Related
        links={[
          { label: 'Deploy to Sepolia', href: '/docs/deploy-sepolia' },
          { label: 'CLI commands', href: '/docs/cli' },
          { label: 'Architecture', href: '/docs/architecture' },
        ]}
      />
    </article>
  );
}

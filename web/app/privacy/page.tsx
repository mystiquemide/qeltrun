import type { Metadata } from 'next';

import { LegalPage, LegalSection } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Privacy: Qeltrun',
  description:
    'What Qeltrun collects, which is nothing on a server, and what your browser, wallet, and '
    + 'RPC provider see when you use the app.',
  alternates: { canonical: '/privacy' },
};

/**
 * The privacy page states what the app actually does, not a template.
 *
 * Qeltrun is a static frontend that reads public chain data. It runs no backend that stores user
 * data, sets no cookies, and loads no analytics. The honest version of this page is short, so it
 * is short. Every claim here is checkable against the source, and the repository is linked from
 * the footer.
 */
export default function Page() {
  return (
    <LegalPage title="Privacy" updated="22 July 2026">
      <LegalSection heading="Summary">
        <p>
          Qeltrun runs in your browser. It has no user accounts and no server that stores your
          data. It sets no cookies and loads no analytics or advertising code. The app reads public
          data from the Ethereum blockchain and, when you choose, sends transactions through your
          own wallet.
        </p>
      </LegalSection>

      <LegalSection heading="What Qeltrun does not collect">
        <p>Qeltrun does not ask for or store any of the following:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Names, email addresses, or contact details.</li>
          <li>Accounts, passwords, or sign-in credentials.</li>
          <li>Wallet private keys or seed phrases. Your wallet holds these, not Qeltrun.</li>
          <li>Analytics, advertising identifiers, or tracking cookies.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="What your browser stores">
        <p>
          When you connect a wallet, the app saves your connection choice in your browser's local
          storage. This value stays on your device. It lets the app reconnect to the same wallet on
          your next visit. Clear your browser storage to remove it.
        </p>
      </LegalSection>

      <LegalSection heading="What third parties can see">
        <p>
          The app reads chain data through an RPC endpoint and is served by a hosting provider.
          Because any web request carries an IP address, these third parties receive standard
          request data:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            The RPC provider receives the read and write requests the app sends to the blockchain,
            along with your IP address.
          </li>
          <li>
            The hosting provider receives the requests your browser makes for the site's pages and
            files, along with your IP address.
          </li>
          <li>
            Your wallet extension follows its own privacy policy. Qeltrun does not control it.
          </li>
        </ul>
        <p>
          Each provider handles this data under its own privacy policy. Qeltrun does not add
          tracking on top of it.
        </p>
      </LegalSection>

      <LegalSection heading="On-chain data is public">
        <p>
          Any transaction you send is recorded on a public blockchain. Wallet addresses, amounts,
          and timestamps are visible to anyone. This is a property of the blockchain, not of
          Qeltrun. Do not send a transaction if you do not want it to be public.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          If the app starts collecting data, this page will change first and the date at the top
          will update. The current source is public, so you can verify these claims yourself. The
          repository is linked in the footer.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

import type { Metadata } from 'next';

import { LegalPage, LegalSection } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Terms: Qeltrun',
  description:
    'The terms for using Qeltrun: open-source software, provided as is, running on a test '
    + 'network, not audited, and not custody of any funds.',
  alternates: { canonical: '/terms' },
};

/**
 * The terms page states the real status of the project.
 *
 * Qeltrun is a hackathon project running on Ethereum Sepolia, a test network. The code is not
 * audited and the demo Safe is a temporary single-key setup. Saying so plainly is more useful
 * than a generic disclaimer, and it matches how the rest of the site treats claims.
 */
export default function Page() {
  return (
    <LegalPage title="Terms" updated="22 July 2026">
      <LegalSection heading="What Qeltrun is">
        <p>
          Qeltrun is open-source software. It is a payout firewall that blocks a vendor payment
          until a sealed approval proves the change. The license terms are in the repository.
        </p>
        <p>
          By using this app, you agree to these terms. If you do not agree, do not use it.
        </p>
      </LegalSection>

      <LegalSection heading="Test network only">
        <p>
          The live deployment runs on Ethereum Sepolia, a test network. It does not move
          real-value assets. Do not treat this deployment as a production financial control.
        </p>
        <p>
          The demo custody Safe is a temporary single-key setup for the demonstration. A
          production deployment would use a multi-signature Safe and would rotate the keys used
          here. Do not reuse the demo configuration with real funds.
        </p>
      </LegalSection>

      <LegalSection heading="Not audited">
        <p>
          The contracts have not had an independent security audit. The repository documents the
          project's own testing and review, but self-review is not an audit. Do not deploy this
          code to a production network or with real funds without an independent audit first.
        </p>
      </LegalSection>

      <LegalSection heading="Qeltrun holds no funds">
        <p>
          Qeltrun does not take custody of your assets. Funds stay in a Safe that its own key
          holders control. The app reads chain state and prepares transactions. Your wallet signs
          them. Qeltrun never holds your keys and never moves funds on its own.
        </p>
      </LegalSection>

      <LegalSection heading="No warranty">
        <p>
          The software is provided as is, without warranty of any kind, express or implied. This
          includes any warranty of merchantability, fitness for a particular purpose, and
          non-infringement.
        </p>
        <p>
          To the maximum extent the law allows, the authors are not liable for any claim, damage,
          or loss that arises from using the software or the deployment.
        </p>
      </LegalSection>

      <LegalSection heading="Your responsibility">
        <p>
          You are responsible for the transactions you sign and the wallet you use. A blockchain
          transaction cannot be reversed once it confirms. Check every transaction in your wallet
          before you approve it.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          These terms can change. The date at the top shows the last review. Continued use after a
          change means you accept the updated terms.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

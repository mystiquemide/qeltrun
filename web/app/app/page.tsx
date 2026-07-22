import type { Metadata } from 'next';

import { Console } from '@/components/console/console';

export const metadata: Metadata = {
  title: 'Console: Qeltrun',
  description:
    'The live payout gate. Read the vendor record, the request state and the Nox evidence '
    + 'directly from chain, with or without a wallet connected.',
  alternates: { canonical: '/app' },
};

/// The console is the one dark surface in the app. `.surface-console` opts in rather than the
/// stylesheet setting it globally, so the marketing pages stay light.
export default function Page() {
  return (
    <div className="surface-console">
      <Console />
    </div>
  );
}

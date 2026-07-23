import type { Metadata } from 'next';

import { Console } from '@/components/console/console';
import { ConsoleFooter } from '@/components/console/console-footer';

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
    <div className="surface-console flex min-h-dvh flex-col">
      <div className="flex-1">
        <Console />
      </div>
      <ConsoleFooter />
    </div>
  );
}

import { HANDLES, shortAddress } from '@/lib/sepolia-facts';
import { Rail } from './rail';

/**
 * The claim the whole product rests on, shown as data.
 *
 * These are the five real handles from the certified run. The public flags are what
 * `NoxCompute.isPubliclyDecryptable` answers today, so a sceptical reader can call it themselves
 * and check every row. Describing confidentiality in prose would be worth far less than this.
 */
export function Confidentiality() {
  return (
    <Rail band>
      <div className="px-6 py-16 md:px-12 md:py-24">
        <h2 className="h-section max-w-[20ch] text-[var(--color-ink-900)]">
          Four handles stay shut. One opens.
        </h2>
        <p className="mt-4 max-w-[64ch] text-[16px] leading-[1.6] text-[var(--color-ink-600)]">
          Every reviewer signal, and the running total they add up to, remains sealed for good. The
          contract holds values it can never read. Only the final yes or no is ever made
          decryptable, and these are the handles from the run above.
        </p>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead>
              <tr className="border-y border-[var(--color-rule)]">
                <Th>Handle</Th>
                <Th>Value</Th>
                <Th>Type</Th>
                <Th>Decryptable</Th>
              </tr>
            </thead>
            <tbody>
              {HANDLES.map((h) => (
                <tr key={h.handle} className="border-b border-[var(--color-rule)]">
                  <td className="py-4 pr-6 align-top">
                    <p className="text-[14px] font-semibold text-[var(--color-ink-900)]">
                      {h.role}
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-[var(--color-ink-600)]">
                      {h.note}
                    </p>
                  </td>
                  <td
                    className="ledger py-4 pr-6 align-top text-[12.5px] text-[var(--color-ink-600)]"
                    title={h.handle}
                  >
                    {shortAddress(h.handle, 12, 6)}
                  </td>
                  <td className="ledger py-4 pr-6 align-top text-[12.5px] text-[var(--color-ink-600)]">
                    {h.type}
                  </td>
                  <td className="py-4 align-top">
                    <span
                      className="text-[13px] font-semibold"
                      style={{
                        color: h.public ? 'var(--color-accent)' : 'var(--color-ink-400)',
                      }}
                    >
                      {h.public ? 'public' : 'sealed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 max-w-[70ch] text-[14px] leading-[1.65] text-[var(--color-ink-600)]">
          The bytes describe themselves. Byte one through four carry the chain id, so every handle
          here begins <span className="ledger">0000aa36a7</span>, which is 11155111. Byte five
          carries the encrypted type, which is why the four sealed handles read{' '}
          <span className="ledger">05</span> for uint16 and the verdict reads{' '}
          <span className="ledger">00</span> for bool. Call{' '}
          <span className="ledger">isPubliclyDecryptable</span> on NoxCompute with any value above
          and check the last column yourself.
        </p>
      </div>
    </Rail>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="py-3 pr-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-400)]">
      {children}
    </th>
  );
}

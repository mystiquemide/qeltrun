import Image from 'next/image';

import { CONTRACTS, etherscanAddress, shortAddress } from '@/lib/sepolia-facts';
import { Rail } from './rail';

/**
 * What a customer logo row would have been, if Qeltrun had customers.
 *
 * It has none, and inventing a `TRUSTED BY` strip of borrowed logos would break the one rule the
 * whole page rests on. Four deployed contracts anyone can open on Etherscan carry more weight
 * with a technical reader anyway.
 *
 * iExec is labelled as what it is, the technology this is built on. Filing a sponsor under
 * `TRUSTED BY` would be a claim they never made.
 */
export function Deployment() {
  return (
    <Rail band>
      <div className="px-6 py-16 md:px-12 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="h-section max-w-[18ch] text-[var(--color-ink-900)]">
              Live on Ethereum Sepolia.
            </h2>
            <p className="mt-4 max-w-[56ch] text-[16px] leading-[1.6] text-[var(--color-ink-600)]">
              Four contracts, live and readable by anyone. The gate at the top of this page is this
              firewall, answering in real time.
            </p>
          </div>

          <a
            href="https://www.iex.ec"
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3 pb-1"
          >
            <Image
              src="/iexec-nox.png"
              alt="iExec"
              width={26}
              height={30}
              className="opacity-45 transition-opacity group-hover:opacity-80"
            />
            <span className="text-[13px] leading-tight text-[var(--color-ink-400)] transition-colors group-hover:text-[var(--color-ink-600)]">
              Built on
              <br />
              iExec Nox
            </span>
          </a>
        </div>

        {/* Open canvas. Content sits directly on the section with hairline rules separating the
            columns, matching the capability strip above. No cells, no borders around anything. */}
        <ul className="mt-14 grid border-t border-[var(--color-rule)] sm:grid-cols-2 lg:grid-cols-4">
          {CONTRACTS.map((c) => (
            <li
              key={c.address}
              className="border-b border-[var(--color-rule)] py-6 sm:border-b-0 sm:pr-8 lg:border-r lg:last:border-r-0 lg:pl-8 lg:first:pl-0"
            >
              <p className="text-[13px] font-semibold text-[var(--color-ink-900)]">{c.label}</p>
              <a
                href={etherscanAddress(c.address)}
                target="_blank"
                rel="noreferrer"
                title={c.address}
                className="ledger mt-2 inline-block text-[12.5px] text-[var(--color-accent)] underline decoration-transparent underline-offset-4 transition hover:decoration-current"
              >
                {shortAddress(c.address)}
              </a>
              <p className="mt-3 text-[13px] leading-[1.55] text-[var(--color-ink-600)]">{c.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </Rail>
  );
}

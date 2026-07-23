import Link from 'next/link';

import { Mark } from './nav';
import { Rail } from './rail';

const GITHUB = 'https://github.com/mystiquemide/qeltrun';

/// Dependency versions and contract addresses live in the repository and at /proof. Repeating
/// them here would be the third copy of the same data, on a page nobody visits for it.
const REFERENCES: { name: string; version: string; href: string }[] = [
  { name: 'iExec Nox', version: 'confidential compute', href: 'https://www.iex.ec' },
  { name: 'Safe', version: 'treasury custody', href: 'https://safe.global' },
];

/// Attribution is not required by the Unsplash licence. It is here because crediting sources
/// matches how the rest of the site treats claims, condensed to one line so it does not outweigh
/// the product links.
const PHOTOGRAPHERS = [
  { name: 'Clem Onojeghuo', href: 'https://unsplash.com/@clemono?utm_source=qeltrun&utm_medium=referral' },
  { name: 'Anton Lammert', href: 'https://unsplash.com/@anton_lammert?utm_source=qeltrun&utm_medium=referral' },
  { name: 'Pascal Meier', href: 'https://unsplash.com/@zhpix?utm_source=qeltrun&utm_medium=referral' },
];

const PRODUCT_LINKS = [
  { label: 'Open the console', href: '/app' },
  { label: 'How it works', href: '/#lifecycle' },
  { label: 'Proof', href: '/proof' },
  { label: 'Docs', href: '/docs' },
];

const LEGAL_LINKS = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];

export function Footer() {
  return (
    <>
      <section className="relative overflow-hidden bg-[var(--color-hero-bg)]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/band-curve.jpg)' }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, var(--color-hero-scrim-from) 0%, var(--color-hero-scrim-mid) 50%, var(--color-hero-scrim-to) 100%)',
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1240px] px-6 py-20 md:px-12 md:py-24">
          <h2 className="max-w-[20ch] text-[clamp(28px,3.4vw,44px)] font-semibold leading-[1.1] tracking-[-0.02em] text-white">
            Watch it refuse a payment.
          </h2>
          <p className="mt-5 max-w-[54ch] text-[16px] leading-[1.6] text-[var(--color-hero-ink)]">
            The console reads the live gate whether or not you connect a wallet. Point it at a
            destination the reviewers have not cleared and it will tell you no.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/app"
              className="rounded-md bg-[var(--color-accent)] px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--color-accent-solid)]"
            >
              Open the console
            </Link>
            <a
              href={GITHUB}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-white/25 px-6 py-3.5 text-[15px] font-medium text-white transition-colors hover:border-white/60"
            >
              Read the contracts
            </a>
          </div>
        </div>
      </section>

      <Rail band>
        <footer className="px-6 py-14 md:px-12 md:py-16">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5 text-[var(--color-ink-900)]">
                <Mark />
                <span className="text-[16px] font-semibold tracking-[-0.02em]">Qeltrun</span>
              </div>
              <p className="mt-4 max-w-[34ch] text-[13.5px] leading-[1.6] text-[var(--color-ink-600)]">
                A vendor change fraud firewall for treasuries. Before funds move, prove the change.
              </p>
            </div>

            <FooterColumn title="Product">
              {PRODUCT_LINKS.map((l) => (
                <FooterLink key={l.href} href={l.href}>
                  {l.label}
                </FooterLink>
              ))}
              <FooterLink href={GITHUB} external>
                GitHub
              </FooterLink>
            </FooterColumn>

            <FooterColumn title="Built with">
              {REFERENCES.map((r) => (
                <FooterLink key={r.name} href={r.href} external>
                  <span className="inline">{r.name} </span>
                  <span className="ledger text-[11.5px] text-[var(--color-ink-400)]">
                    {r.version}
                  </span>
                </FooterLink>
              ))}
            </FooterColumn>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--color-rule)] pt-6">
            <p className="text-[12.5px] text-[var(--color-ink-600)]">MIT licensed.</p>
            {LEGAL_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[12.5px] text-[var(--color-ink-600)] transition-colors hover:text-[var(--color-ink-900)]"
              >
                {l.label}
              </Link>
            ))}

            {/* Photograph credits stay in the document without taking visual space. The Unsplash
                licence does not require attribution, so this is courtesy rather than obligation,
                and courtesy should not cost the footer a line of copy. Screen readers and
                crawlers still reach the links. */}
            <p className="sr-only">
              Photographs by{' '}
              {PHOTOGRAPHERS.map((p, i) => (
                <span key={p.name}>
                  {i > 0 && (i === PHOTOGRAPHERS.length - 1 ? ' and ' : ', ')}
                  <a href={p.href} target="_blank" rel="noreferrer">
                    {p.name}
                  </a>
                </span>
              ))}{' '}
              on Unsplash.
            </p>
          </div>
        </footer>
      </Rail>
    </>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-400)]">
        {title}
      </p>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const className =
    'text-[13.5px] leading-snug text-[var(--color-ink-600)] transition-colors hover:text-[var(--color-ink-900)]';
  return (
    <li>
      {external ? (
        <a href={href} target="_blank" rel="noreferrer" className={className}>
          {children}
        </a>
      ) : (
        <Link href={href} className={className}>
          {children}
        </Link>
      )}
    </li>
  );
}

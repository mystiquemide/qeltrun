'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { DOCS_TREE } from './docs-nav';

/**
 * The docs frame: a sidebar and a content column, inside the marketing rail.
 *
 * The sidebar reads `DOCS_TREE` and marks the current page from the URL. On narrow screens it
 * collapses above the content rather than behind a toggle, because the tree is short.
 */
export function DocsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto grid max-w-[1240px] gap-10 px-6 py-12 md:grid-cols-[220px_minmax(0,1fr)] md:px-12 md:py-16">
      <aside className="md:sticky md:top-24 md:h-max">
        <nav aria-label="Documentation">
          {DOCS_TREE.map((group) => (
            <div key={group.title} className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-400)]">
                {group.title}
              </p>
              <ul className="mt-2.5 space-y-1">
                {group.links.map((link) => {
                  const active = pathname === link.href;
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={active ? 'page' : undefined}
                        className={`block rounded-md px-2 py-1.5 text-[14px] transition-colors ${
                          active
                            ? 'bg-[var(--color-band)] font-medium text-[var(--color-accent)]'
                            : 'text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)]'
                        }`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

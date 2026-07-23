import { DocsShell } from '@/components/docs/docs-shell';
import { Footer } from '@/components/marketing/footer';
import { Nav } from '@/components/marketing/nav';

/// Every docs page shares the nav, the sidebar shell, and the footer. The page itself only
/// provides its prose.
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main id="main-content">
        <DocsShell>{children}</DocsShell>
      </main>
      <Footer />
    </>
  );
}

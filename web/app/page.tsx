import { Audience } from '@/components/marketing/audience';
import { Capabilities } from '@/components/marketing/capabilities';
import { Contrast } from '@/components/marketing/contrast';
import { Footer } from '@/components/marketing/footer';
import { Hero } from '@/components/marketing/hero';
import { Lifecycle } from '@/components/marketing/lifecycle';
import { Nav } from '@/components/marketing/nav';
import { Statement } from '@/components/marketing/statement';

/**
 * The landing page answers what a visitor actually arrives wanting to know.
 *
 * The contract addresses, sealed Nox handles, governance receipts and the eighteen transaction
 * run used to live here. All of it is real and worth keeping, and none of it belongs in front of
 * somebody whose job is paying vendors. It moved to `/proof`, one click away, and the repository
 * carries the same material for anyone reading the code.
 *
 * L3, the embedded product scene, is still outstanding. It shows the console, so it waits until
 * the console is rebuilt for the three reviewer flow.
 */
export default function Page() {
  return (
    <>
      <Nav />
      <main id="main-content">
        <Hero />
        <Audience />
        <Contrast />
        <Statement image="/band-structure.jpg">
          Every stolen invoice was approved by somebody who was sure.
        </Statement>
        <Lifecycle />
        <Capabilities />
      </main>
      <Footer />
    </>
  );
}

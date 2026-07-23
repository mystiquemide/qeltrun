/**
 * The three throwaway reviewer keys for the public Sepolia demo.
 *
 * WARNING. These are burner keys. They were generated for this demo, hold no real value, and are
 * published on purpose so anyone can import all three and drive the full three-reviewer flow on
 * Sepolia. They are the same idea as Hardhat's well-known development accounts.
 *
 * NEVER send real funds or mainnet assets to these addresses. Anyone can spend them. They exist
 * only so a visitor can seal the three positions the flow needs, on a test network, with nothing
 * at stake.
 *
 * The registration script `scripts/setup-demo-vendor-sepolia.ts` funds these three addresses with
 * a little Sepolia ETH and registers the demo vendor with them as its three reviewer seats. The
 * vendor id below is `keccak(vendor:qeltrun-demo)`, computed the same way on chain, so this file,
 * the console config, and the registration script all agree before the script is ever run.
 */
import type { Address, Hex } from './config';

export const DEMO_VENDOR_LABEL = 'vendor:qeltrun-demo';
export const DEMO_VENDOR_ID =
  '0xa9604c47565f26df6e7a3a07b9afd6cff617e09781f9ef313cd7f0039af45f4b' as Hex;

/// The destination the console tests the gate against. It must differ from the vendor's current
/// payout wallet, or the gate opens on allowed with nothing to show.
export const DEMO_PROPOSED_WALLET =
  '0x4444444444444444444444444444444444444444' as Address;

export type DemoReviewer = {
  role: 'Approver' | 'Treasury' | 'Risk';
  address: Address;
  privateKey: Hex;
};

export const DEMO_REVIEWERS: DemoReviewer[] = [
  {
    role: 'Approver',
    address: '0x9e7b59aB4f48D342af54e3B98Aa6f291f8655E30',
    privateKey: '0xedd776591a54f0460868a38fda15611978f72e07f8aa0da66bdc90f96561d86d',
  },
  {
    role: 'Treasury',
    address: '0x627f92602454741fb1Fc5d03Fc474f4B6614dd89',
    privateKey: '0x0b93f99e28c934cd8ca7a6b274deac5bae4c3f493ec7c610ea42477cafcd85c6',
  },
  {
    role: 'Risk',
    address: '0xC4fCf447a0AfA02871Aa701585F7cB4DE48D7C5A',
    privateKey: '0x7030f8472f79b496fc5f66e715e526dd59a553f8235b9ee7faeb24ea3646b635',
  },
];

/**
 * Register the public demo vendor on Sepolia and fund its three throwaway reviewer keys.
 *
 * The console at /app points at a vendor whose three reviewer seats are the burner keys in
 * web/lib/demo-reviewers.ts. This script makes that vendor real on chain so a visitor can import
 * the three keys and drive the full seal-and-settle flow. The keys are throwaway and published on
 * purpose; see the warning in that file.
 *
 * The firewall is owned by the treasury Safe, so registerVendor runs as a Safe transaction. The
 * Safe is 1-of-1, so the single signer executes it directly.
 *
 * Run it:
 *   export SEPOLIA_RPC_URL="https://sepolia.gateway.tenderly.co"   # or your own RPC
 *   export PRIVATE_KEY="0x..."          # the Safe signer key, holds Sepolia ETH
 *   export TREASURY_SAFE="0x2891Fc04EC1b5e482A37978961fC3256BCA1B263"
 *   export FIREWALL_V2_ADDRESS="0x719a235Be27F0b7B7F82775aFBEA6a2dE6264fe6"
 *   pnpm exec tsx scripts/setup-demo-vendor-sepolia.ts
 *
 * It prints the registered vendor id, which must match NEXT_PUBLIC_SEPOLIA_VENDOR_ID.
 */
import { Contract, Interface, JsonRpcProvider, Wallet, getAddress, parseEther } from 'ethers';

import { vendorId } from '../src/domain/index.js';

/// Kept in step with web/lib/demo-reviewers.ts. If you regenerate the keys there, change these.
const DEMO_VENDOR_LABEL = 'vendor:qeltrun-demo';
const DEMO_PAYOUT_WALLET = '0x1111111111111111111111111111111111111111';
const REVIEWERS = {
  approver: '0x9e7b59aB4f48D342af54e3B98Aa6f291f8655E30',
  treasury: '0x627f92602454741fb1Fc5d03Fc474f4B6614dd89',
  risk: '0xC4fCf447a0AfA02871Aa701585F7cB4DE48D7C5A',
};

/// Enough Sepolia ETH per reviewer to seal and settle several times.
const FUND_EACH = parseEther('0.02');

type SafeProtocol = {
  createTransaction(input: {
    transactions: Array<{ to: string; value: string; data: string }>;
    onlyCalls?: boolean;
  }): Promise<unknown>;
  executeTransaction(transaction: unknown): Promise<{
    hash: string;
    transactionResponse: { wait(): Promise<{ status: string; blockNumber: bigint }> };
  }>;
};
type SafeInitializer = {
  init(config: { provider: string; signer: string; safeAddress: string }): Promise<SafeProtocol>;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === '') throw new Error(`MISSING_${name}`);
  return value;
}

async function main(): Promise<void> {
  const rpcUrl = required('SEPOLIA_RPC_URL');
  const rawKey = required('PRIVATE_KEY');
  const key = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
  const safeAddress = getAddress(required('TREASURY_SAFE'));
  const firewallAddress = getAddress(required('FIREWALL_V2_ADDRESS'));

  const provider = new JsonRpcProvider(rpcUrl);
  const signer = new Wallet(key, provider);
  const demoVendorId = vendorId(DEMO_VENDOR_LABEL);

  // 1. Fund the three reviewer keys so they can send their own seal transactions.
  for (const [role, address] of Object.entries(REVIEWERS)) {
    const current = await provider.getBalance(address);
    if (current >= FUND_EACH) {
      console.log(`fund ${role} ${address}: already funded (${current} wei)`);
      continue;
    }
    const tx = await signer.sendTransaction({ to: address, value: FUND_EACH - current });
    await tx.wait();
    console.log(`fund ${role} ${address}: ${tx.hash}`);
  }

  // 2. Register the vendor as a Safe transaction, because the Safe owns the firewall.
  const module = await import('@safe-global/protocol-kit');
  const Safe = module.default as unknown as SafeInitializer;
  const protocolKit = await Safe.init({ provider: rpcUrl, signer: key, safeAddress });

  const firewallInterface = new Interface([
    'function registerVendor(bytes32 vendorId, address payoutWallet, address approver, address treasuryReviewer, address riskReviewer)',
    'function getVendor(bytes32 vendorId) view returns (tuple(address payoutWallet, address approver, address treasuryReviewer, address riskReviewer, uint64 approverEpoch, bool registered))',
  ]);

  const readonly = new Contract(firewallAddress, firewallInterface, provider) as unknown as {
    getVendor(id: string): Promise<{ registered: boolean }>;
  };
  const existing = await readonly.getVendor(demoVendorId);
  if (existing.registered) {
    console.log(`vendor ${demoVendorId} already registered; skipping registration`);
  } else {
    const data = firewallInterface.encodeFunctionData('registerVendor', [
      demoVendorId,
      DEMO_PAYOUT_WALLET,
      REVIEWERS.approver,
      REVIEWERS.treasury,
      REVIEWERS.risk,
    ]);
    const safeTx = await protocolKit.createTransaction({
      transactions: [{ to: firewallAddress, value: '0', data }],
      onlyCalls: true,
    });
    const result = await protocolKit.executeTransaction(safeTx);
    const receipt = await result.transactionResponse.wait();
    if (receipt.status !== 'success') throw new Error(`REGISTRATION_FAILED:${result.hash}`);
    console.log(`registerVendor: ${result.hash}`);
  }

  console.log(
    JSON.stringify(
      {
        vendorLabel: DEMO_VENDOR_LABEL,
        vendorId: demoVendorId,
        payoutWallet: DEMO_PAYOUT_WALLET,
        reviewers: REVIEWERS,
        note: 'Set NEXT_PUBLIC_SEPOLIA_VENDOR_ID to the vendorId above.',
      },
      null,
      2,
    ),
  );
}

await main();

/**
 * Exercise the full lifecycle against a live network and the real iExec Nox gateway.
 *
 *   export $(grep -v '^#' .env | xargs)
 *   pnpm run verify:live
 *
 * `pnpm run demo` proves the contract logic against the genuine NoxCompute bytecode, but it
 * signs proofs with a local gateway key. This is the only thing that exercises iExec's actual
 * gateway service — the encryption round trip, the handle it mints, and the decryption proof it
 * signs. Everything else can be green while this fails.
 *
 * Prints the transaction hashes so they can go in the README as deployment evidence.
 *
 * Requires `FIREWALL_ADDRESS`, `SEPOLIA_RPC_URL` and `PRIVATE_KEY`. The key must belong to the
 * wallet that will act as approver, because Nox binds each handle to the wallet that seals it
 * *and* the contract checks that wallet against `msg.sender`.
 */
import { createPublicClient, createWalletClient, formatEther, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

import { FIREWALL_ABI } from '../web/lib/firewall-abi.js';
import { vendorId } from '../src/domain/index.js';
import { NoxApprovalProvider } from '../src/providers/nox-approval-provider.js';
import type { Address, Hex } from '../src/domain/types.js';

const VENDOR_LABEL = process.env.VENDOR_LABEL ?? 'vendor:northwind-logistics';
const ORIGINAL_WALLET = '0x1111111111111111111111111111111111111111' as Address;
/// Override with `DESTINATION` to move the vendor somewhere specific — for example to whatever
/// the dashboard is configured to test, so a screenshot shows the gate actually opening.
const PROPOSED_WALLET = (process.env.DESTINATION ?? '0x2222222222222222222222222222222222222222') as Address;
const NONCE = BigInt(process.env.NONCE ?? '1');

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === '') throw new Error(`MISSING_ENV:${name}`);
  return value;
}

function normalizeKey(raw: string): Hex {
  return (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex;
}

const explorer = (hash: Hex) => `https://sepolia.etherscan.io/tx/${hash}`;

async function main(): Promise<void> {
  const firewall = required('FIREWALL_ADDRESS') as Address;
  const account = privateKeyToAccount(normalizeKey(required('PRIVATE_KEY')));
  const transport = http(required('SEPOLIA_RPC_URL'));

  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ account, chain: sepolia, transport });

  const receipts: Array<{ step: string; hash: Hex }> = [];

  const send = async (step: string, hash: Hex): Promise<void> => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`REVERTED:${step}:${hash}`);
    receipts.push({ step, hash });
    console.log(`   ${step.padEnd(18)} ${explorer(hash)}`);
  };

  const gate = async (destination: Address): Promise<readonly [boolean, string]> =>
    (await publicClient.readContract({
      address: firewall,
      abi: FIREWALL_ABI,
      functionName: 'isPayoutAllowed',
      args: [vendorId(VENDOR_LABEL), destination],
    })) as readonly [boolean, string];

  console.log(`Firewall  ${firewall}`);
  console.log(`Approver  ${account.address}`);
  console.log(`Balance   ${formatEther(await publicClient.getBalance({ address: account.address }))} ETH\n`);

  // ---- 1. Register the vendor, unless a previous run already did.
  const vendor = (await publicClient.readContract({
    address: firewall,
    abi: FIREWALL_ABI,
    functionName: 'getVendor',
    args: [vendorId(VENDOR_LABEL)],
  })) as { payoutWallet: Address; approver: Address; registered: boolean };

  console.log('1. Vendor registration');
  if (!vendor.registered) {
    await send(
      'registerVendor',
      await walletClient.writeContract({
        address: firewall,
        abi: FIREWALL_ABI,
        functionName: 'registerVendor',
        args: [vendorId(VENDOR_LABEL), ORIGINAL_WALLET, account.address],
      }),
    );
  } else {
    console.log(`   already registered, payout wallet ${vendor.payoutWallet}`);
  }

  // ---- 2. Open a change request. Proves nothing; the gate must stay shut.
  console.log('\n2. Open a change request');
  const currentWallet = (
    (await publicClient.readContract({
      address: firewall,
      abi: FIREWALL_ABI,
      functionName: 'getVendor',
      args: [vendorId(VENDOR_LABEL)],
    })) as { payoutWallet: Address }
  ).payoutWallet;

  const destination = currentWallet === PROPOSED_WALLET ? ORIGINAL_WALLET : PROPOSED_WALLET;

  const requestId = (await publicClient.readContract({
    address: firewall,
    abi: FIREWALL_ABI,
    functionName: 'deriveRequestId',
    args: [vendorId(VENDOR_LABEL), currentWallet, destination, account.address, NONCE],
  })) as Hex;

  const existing = (await publicClient.readContract({
    address: firewall,
    abi: FIREWALL_ABI,
    functionName: 'getRequest',
    args: [requestId],
  })) as { status: number };

  console.log(`   request id         ${requestId}`);
  if (Number(existing.status) === 0) {
    await send(
      'openChangeRequest',
      await walletClient.writeContract({
        address: firewall,
        abi: FIREWALL_ABI,
        functionName: 'openChangeRequest',
        args: [vendorId(VENDOR_LABEL), destination, NONCE],
      }),
    );
  } else {
    console.log(`   already open, status ${existing.status}`);
  }

  console.log(`   gate               ${JSON.stringify(await gate(destination))}`);

  // ---- 3. Seal through the real iExec gateway. This is the step nothing else covers.
  console.log('\n3. Seal through the live iExec Nox gateway');
  const approvals = await NoxApprovalProvider.fromViemWalletClient(walletClient);
  const sealed = await approvals.sealApproval({
    approver: account.address,
    applicationContract: firewall,
    approve: true,
  });

  console.log(`   handle             ${sealed.handle}`);
  console.log(`   input proof        ${(sealed.handleProof.length - 2) / 2} bytes`);

  await send(
    'sealApproval',
    await walletClient.writeContract({
      address: firewall,
      abi: FIREWALL_ABI,
      functionName: 'sealApproval',
      args: [requestId, sealed.handle, sealed.handleProof],
    }),
  );

  console.log(`   gate               ${JSON.stringify(await gate(destination))}  <- still shut`);

  // ---- 4. Reveal through the gateway and settle.
  console.log('\n4. Reveal and settle');
  // The gateway indexes ACL state from a subgraph, so this can take a minute to become
  // available after `sealApproval` confirms. The provider retries that specific error.
  console.log('   waiting for the gateway to index the handle…');
  const revealed = await approvals.revealApproval(sealed.handle);
  console.log(`   decrypted bit      ${String(revealed.value)}`);
  console.log(`   decryption proof   ${(revealed.decryptionProof.length - 2) / 2} bytes`);

  await send(
    'settleApproval',
    await walletClient.writeContract({
      address: firewall,
      abi: FIREWALL_ABI,
      functionName: 'settleApproval',
      args: [requestId, revealed.decryptionProof],
    }),
  );

  const [allowed, reason] = await gate(destination);
  console.log(`   gate               ${JSON.stringify([allowed, reason])}`);

  if (!allowed) throw new Error(`GATE_DID_NOT_OPEN:${reason}`);

  console.log('\nLive lifecycle held. Transactions:\n');
  for (const { step, hash } of receipts) console.log(`| \`${step}\` | [\`${hash.slice(0, 18)}…\`](${explorer(hash)}) |`);
}

await main();

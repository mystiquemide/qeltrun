/** Execute the three-reviewer v2 lifecycle against Sepolia and the live Nox gateway. */
import { createPublicClient, createWalletClient, encodePacked, http, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

import { FIREWALL_V2_ABI } from '../src/contracts/generated/firewall-v2-abi.js';
import { vendorId } from '../src/domain/index.js';
import type { Address, Hex } from '../src/domain/types.js';
import { NoxSignalProvider } from '../src/providers/nox-signal-provider.js';

type SafeTransaction = unknown;
type SafeProtocol = {
  createTransaction(input: {
    transactions: Array<{ to: string; value: string; data: string }>;
  }): Promise<SafeTransaction>;
  executeTransaction(transaction: SafeTransaction): Promise<{
    hash: Hex;
    transactionResponse: { wait(): Promise<{ status: string }> };
  }>;
};
type SafeInitializer = {
  init(config: { provider: string; signer: string; safeAddress: string }): Promise<SafeProtocol>;
};

const NOX_COMPUTE = '0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF' as Address;
const NOX_ACL_ABI = [
  {
    type: 'function',
    name: 'isPubliclyDecryptable',
    stateMutability: 'view',
    inputs: [{ name: 'handle', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === '') throw new Error(`MISSING_${name}`);
  return value;
}

function normalizeKey(value: string): Hex {
  return (value.startsWith('0x') ? value : `0x${value}`) as Hex;
}

function derivedKey(root: Hex, label: string): Hex {
  return keccak256(encodePacked(['bytes32', 'string'], [root, label]));
}

async function main(): Promise<void> {
  const rpcUrl = required('SEPOLIA_RPC_URL');
  const rootKey = normalizeKey(required('PRIVATE_KEY'));
  const safeAddress = required('TREASURY_SAFE') as Address;
  const firewall = required('FIREWALL_V2_ADDRESS') as Address;
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const approver = privateKeyToAccount(rootKey);
  const treasuryReviewer = privateKeyToAccount(derivedKey(rootKey, 'qeltrun/v2/treasury-reviewer'));
  const riskReviewer = privateKeyToAccount(derivedKey(rootKey, 'qeltrun/v2/risk-reviewer'));
  const accounts = [approver, treasuryReviewer, riskReviewer] as const;
  const approverWallet = createWalletClient({ account: approver, chain: sepolia, transport });
  const treasuryWallet = createWalletClient({ account: treasuryReviewer, chain: sepolia, transport });
  const riskWallet = createWalletClient({ account: riskReviewer, chain: sepolia, transport });
  const wallets = [approverWallet, treasuryWallet, riskWallet] as const;
  const receipts: Array<{ step: string; hash: Hex }> = [];

  const confirm = async (step: string, hash: Hex): Promise<void> => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`REVERTED:${step}:${hash}`);
    receipts.push({ step, hash });
  };

  for (let index = 1; index < accounts.length; index++) {
    const account = accounts[index];
    if (account === undefined) continue;
    const balance = await publicClient.getBalance({ address: account.address });
    if (balance < 2_000_000_000_000_000n) {
      await confirm(
        `fundReviewer${index}`,
        await approverWallet.sendTransaction({ to: account.address, value: 3_000_000_000_000_000n }),
      );
    }
  }

  const vendor = vendorId('vendor:qeltrun-v2-live');
  const proposedWallet = '0x5555555555555555555555555555555555555555' as Address;
  const vendorRecord = (await publicClient.readContract({
    address: firewall,
    abi: FIREWALL_V2_ABI,
    functionName: 'getVendor',
    args: [vendor],
  })) as { registered: boolean; payoutWallet: Address; approverEpoch: bigint };

  if (!vendorRecord.registered) {
    const { encodeFunctionData } = await import('viem');
    const registrationData = encodeFunctionData({
      abi: FIREWALL_V2_ABI,
      functionName: 'registerVendor',
      args: [
        vendor,
        approver.address,
        approver.address,
        treasuryReviewer.address,
        riskReviewer.address,
      ],
    });
    const module = await import('@safe-global/protocol-kit');
    const Safe = module.default as unknown as SafeInitializer;
    const protocolKit = await Safe.init({ provider: rpcUrl, signer: rootKey, safeAddress });
    const safeTx = await protocolKit.createTransaction({
      transactions: [{ to: firewall, value: '0', data: registrationData }],
    });
    const result = await protocolKit.executeTransaction(safeTx);
    const receipt = await result.transactionResponse.wait();
    if (receipt.status !== 'success') throw new Error(`SAFE_REGISTER_FAILED:${result.hash}`);
    receipts.push({ step: 'registerVendor', hash: result.hash });
  }

  const current = (await publicClient.readContract({
    address: firewall,
    abi: FIREWALL_V2_ABI,
    functionName: 'getVendor',
    args: [vendor],
  })) as { payoutWallet: Address; approverEpoch: bigint };
  const destination = current.payoutWallet.toLowerCase() === proposedWallet.toLowerCase()
    ? approver.address
    : proposedWallet;
  const nonce = BigInt(process.env.NONCE ?? '9001');
  const requestId = (await publicClient.readContract({
    address: firewall,
    abi: FIREWALL_V2_ABI,
    functionName: 'deriveRequestId',
    args: [vendor, current.payoutWallet, destination, approver.address, nonce, current.approverEpoch],
  })) as Hex;
  await confirm(
    'openChangeRequest',
    await approverWallet.writeContract({
      address: firewall,
      abi: FIREWALL_V2_ABI,
      functionName: 'openChangeRequest',
      args: [vendor, destination, nonce],
    }),
  );

  const rawHandles: Hex[] = [];
  for (let index = 0; index < wallets.length; index++) {
    const wallet = wallets[index];
    if (wallet === undefined) throw new Error(`MISSING_REVIEWER_WALLET:${index}`);
    const provider = await NoxSignalProvider.fromViemWalletClient(wallet);
    const encrypted = await provider.encryptSignal(1n, firewall);
    rawHandles.push(encrypted.handle);
    await confirm(
      `submitSignal${index + 1}`,
      await wallet.writeContract({
        address: firewall,
        abi: FIREWALL_V2_ABI,
        functionName: 'submitPrivateSignal',
        args: [requestId, encrypted.handle, encrypted.handleProof],
      }),
    );
  }

  const aggregate = (await publicClient.readContract({
    address: firewall,
    abi: FIREWALL_V2_ABI,
    functionName: 'aggregateScoreHandle',
    args: [requestId],
  })) as Hex;
  const verdict = (await publicClient.readContract({
    address: firewall,
    abi: FIREWALL_V2_ABI,
    functionName: 'verdictHandle',
    args: [requestId],
  })) as Hex;
  const privacy = await Promise.all(
    [...rawHandles, aggregate, verdict].map((handle) =>
      publicClient.readContract({
        address: NOX_COMPUTE,
        abi: NOX_ACL_ABI,
        functionName: 'isPubliclyDecryptable',
        args: [handle],
      }),
    ),
  );
  if (privacy.slice(0, 4).some(Boolean) || privacy[4] !== true) {
    throw new Error(`PRIVACY_INVARIANT_FAILED:${JSON.stringify(privacy)}`);
  }

  const nox = await NoxSignalProvider.fromViemWalletClient(approverWallet);
  const revealed = await nox.revealVerdict(verdict);
  if (!revealed.value) throw new Error('EXPECTED_APPROVED_VERDICT');
  await confirm(
    'settleApproval',
    await approverWallet.writeContract({
      address: firewall,
      abi: FIREWALL_V2_ABI,
      functionName: 'settleApproval',
      args: [requestId, revealed.decryptionProof],
    }),
  );

  const finalWallet = (await publicClient.readContract({
    address: firewall,
    abi: FIREWALL_V2_ABI,
    functionName: 'getPayoutWallet',
    args: [vendor],
  })) as Address;
  if (finalWallet.toLowerCase() !== destination.toLowerCase()) {
    throw new Error(`WALLET_NOT_CHANGED:${finalWallet}:expected:${destination}`);
  }

  console.log(
    JSON.stringify(
      {
        vendor,
        reviewers: accounts.map(({ address }) => address),
        requestId,
        destination,
        rawHandlesPublic: privacy.slice(0, 3),
        aggregatePublic: privacy[3],
        verdictPublic: privacy[4],
        verdict: revealed.value,
        transactions: receipts,
      },
      null,
      2,
    ),
  );
}

await main();

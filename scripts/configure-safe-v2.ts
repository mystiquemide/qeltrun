/** Accept v2 firewall ownership and enable its payout module through the treasury Safe. */
import { Contract, Interface, JsonRpcProvider, Wallet, getAddress } from 'ethers';

type SafeTransaction = unknown;
type SafeProtocol = {
  createTransaction(input: {
    transactions: Array<{ to: string; value: string; data: string }>;
    onlyCalls?: boolean;
  }): Promise<SafeTransaction>;
  executeTransaction(transaction: SafeTransaction): Promise<{
    hash: string;
    transactionResponse: { wait(): Promise<{ status: string; blockNumber: bigint }> };
  }>;
  isModuleEnabled(moduleAddress: string): Promise<boolean>;
};
type SafeInitializer = {
  init(config: { provider: string; signer: string; safeAddress: string }): Promise<SafeProtocol>;
};
type FirewallOwnership = {
  owner(): Promise<string>;
  pendingOwner(): Promise<string>;
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
  const moduleAddress = getAddress(required('SAFE_MODULE_ADDRESS'));
  const provider = new JsonRpcProvider(rpcUrl);
  const signer = new Wallet(key, provider);
  const module = await import('@safe-global/protocol-kit');
  const Safe = module.default as unknown as SafeInitializer;
  const protocolKit = await Safe.init({ provider: rpcUrl, signer: key, safeAddress });

  const firewall = new Contract(
    firewallAddress,
    [
      'function owner() view returns (address)',
      'function pendingOwner() view returns (address)',
    ],
    provider,
  ) as unknown as FirewallOwnership;
  const currentOwner = getAddress((await firewall.owner()) as string);
  const pendingOwner = getAddress((await firewall.pendingOwner()) as string);
  if (pendingOwner !== safeAddress) {
    throw new Error(`PENDING_OWNER_MISMATCH:${pendingOwner}:expected:${safeAddress}`);
  }

  const firewallInterface = new Interface(['function acceptOwnership()']);
  const safeInterface = new Interface(['function enableModule(address module)']);
  const safeTransaction = await protocolKit.createTransaction({
    transactions: [
      {
        to: firewallAddress,
        value: '0',
        data: firewallInterface.encodeFunctionData('acceptOwnership'),
      },
      {
        to: safeAddress,
        value: '0',
        data: safeInterface.encodeFunctionData('enableModule', [moduleAddress]),
      },
    ],
    onlyCalls: true,
  });
  const result = await protocolKit.executeTransaction(safeTransaction);
  const receipt = await result.transactionResponse.wait();
  if (receipt.status !== 'success') throw new Error(`SAFE_CONFIGURATION_FAILED:${result.hash}`);

  const finalOwner = getAddress((await firewall.owner()) as string);
  const moduleEnabled = await protocolKit.isModuleEnabled(moduleAddress);
  if (finalOwner !== safeAddress) throw new Error(`OWNER_NOT_ACCEPTED:${finalOwner}`);
  if (!moduleEnabled) throw new Error(`MODULE_NOT_ENABLED:${moduleAddress}`);

  console.log(
    JSON.stringify(
      {
        safeAddress,
        signer: signer.address,
        previousFirewallOwner: currentOwner,
        firewallOwner: finalOwner,
        moduleAddress,
        moduleEnabled,
        safeTransaction: result.hash,
        blockNumber: receipt.blockNumber.toString(),
      },
      null,
      2,
    ),
  );
}

await main();

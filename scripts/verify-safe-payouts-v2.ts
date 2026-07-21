/** Certify native, ERC-20, and paused Safe module execution on Sepolia. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  Contract,
  ContractFactory,
  Interface,
  JsonRpcProvider,
  Wallet,
  getAddress,
  type InterfaceAbi,
} from 'ethers';

type SafeTransaction = unknown;
type SafeProtocol = {
  createTransaction(input: {
    transactions: Array<{ to: string; value: string; data: string }>;
    options?: { safeTxGas?: bigint | string };
  }): Promise<SafeTransaction>;
  executeTransaction(transaction: SafeTransaction): Promise<{
    hash: string;
    transactionResponse: { wait(): Promise<{ status: string; blockNumber: bigint }> };
  }>;
};
type SafeInitializer = {
  init(config: { provider: string; signer: string; safeAddress: string }): Promise<SafeProtocol>;
};
type FirewallView = {
  getPayoutWallet(vendorId: string): Promise<string>;
  paused(): Promise<boolean>;
};
type TokenView = { balanceOf(account: string): Promise<bigint> };

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
  const existingDemoToken = process.env.DEMO_TOKEN_ADDRESS?.trim();
  const existingDemoTokenAddress =
    existingDemoToken === undefined || existingDemoToken === ''
      ? null
      : getAddress(existingDemoToken);
  const provider = new JsonRpcProvider(rpcUrl);
  const signer = new Wallet(key, provider);
  const modulePackage = await import('@safe-global/protocol-kit');
  const Safe = modulePackage.default as unknown as SafeInitializer;
  const protocolKit = await Safe.init({ provider: rpcUrl, signer: key, safeAddress });
  const vendorId = '0xd52caa61e1a8f1a43f6b03225799455025e90db256712acc80ffc7271f3769a4';

  const firewall = new Contract(
    firewallAddress,
    [
      'function getPayoutWallet(bytes32 vendorId) view returns (address)',
      'function paused() view returns (bool)',
    ],
    provider,
  ) as unknown as FirewallView;
  const destination = getAddress((await firewall.getPayoutWallet(vendorId)) as string);

  const moduleInterface = new Interface([
    'function executeNativePayout(bytes32 vendorId,uint256 amount)',
    'function executeTokenPayout(bytes32 vendorId,address token,uint256 amount)',
  ]);
  const firewallInterface = new Interface(['function pause()', 'function unpause()']);
  const executeSafe = async (
    to: string,
    data: string,
    options?: { safeTxGas?: bigint | string },
  ): Promise<string> => {
    const safeTx = await protocolKit.createTransaction({
      transactions: [{ to, value: '0', data }],
      ...(options === undefined ? {} : { options }),
    });
    const result = await protocolKit.executeTransaction(safeTx);
    const receipt = await result.transactionResponse.wait();
    if (receipt.status !== 'success') throw new Error(`SAFE_OUTER_TX_REVERTED:${result.hash}`);
    return result.hash;
  };

  const verifyBlockedPayouts = async (tokenAddress: string | null): Promise<{
    blockedNativePayoutTx: string;
    blockedTokenPayoutTx: string | null;
  }> => {
    const blockedBefore = await provider.getBalance(destination);
    const blockedNativePayoutTx = await executeSafe(
      moduleAddress,
      moduleInterface.encodeFunctionData('executeNativePayout', [vendorId, 1n]),
      { safeTxGas: 200_000n },
    );
    const blockedAfter = await provider.getBalance(destination);
    if (blockedAfter !== blockedBefore) throw new Error('PAUSED_PAYOUT_MOVED_FUNDS');
    let blockedTokenPayoutTx: string | null = null;
    if (tokenAddress !== null) {
      const tokenContract = new Contract(
        tokenAddress,
        ['function balanceOf(address account) view returns (uint256)'],
        provider,
      ) as unknown as TokenView;
      const tokenBefore = await tokenContract.balanceOf(destination);
      blockedTokenPayoutTx = await executeSafe(
        moduleAddress,
        moduleInterface.encodeFunctionData('executeTokenPayout', [vendorId, tokenAddress, 1n]),
        { safeTxGas: 250_000n },
      );
      const tokenAfter = await tokenContract.balanceOf(destination);
      if (tokenAfter !== tokenBefore) throw new Error('PAUSED_TOKEN_PAYOUT_MOVED_FUNDS');
    }
    return { blockedNativePayoutTx, blockedTokenPayoutTx };
  };

  if (await firewall.paused()) {
    const blocked = await verifyBlockedPayouts(existingDemoTokenAddress);
    const unpauseTx = await executeSafe(
      firewallAddress,
      firewallInterface.encodeFunctionData('unpause'),
    );
    if (await firewall.paused()) throw new Error('FIREWALL_STILL_PAUSED');
    console.log(
      JSON.stringify(
        {
          resumedInterruptedPauseTest: true,
          safeAddress,
          firewallAddress,
          moduleAddress,
          vendorId,
          destination,
          ...blocked,
          pausedPayoutMovedFunds: false,
          unpauseTx,
          firewallPausedAfterTest: false,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (existingDemoTokenAddress !== null) {
    const pauseTx = await executeSafe(firewallAddress, firewallInterface.encodeFunctionData('pause'));
    const blocked = await verifyBlockedPayouts(existingDemoTokenAddress);
    const unpauseTx = await executeSafe(
      firewallAddress,
      firewallInterface.encodeFunctionData('unpause'),
    );
    if (await firewall.paused()) throw new Error('FIREWALL_STILL_PAUSED');
    console.log(
      JSON.stringify(
        {
          blockedOnlyTest: true,
          safeAddress,
          firewallAddress,
          moduleAddress,
          vendorId,
          destination,
          demoToken: existingDemoTokenAddress,
          pauseTx,
          ...blocked,
          pausedPayoutMovedFunds: false,
          unpauseTx,
          firewallPausedAfterTest: false,
        },
        null,
        2,
      ),
    );
    return;
  }

  if ((await provider.getBalance(safeAddress)) < 3_000_000_000_000_000n) {
    const funding = await signer.sendTransaction({
      to: safeAddress,
      value: 5_000_000_000_000_000n,
    });
    await funding.wait();
  }

  const artifactPath = join(
    process.cwd(),
    'artifacts/contracts/demo/QeltrunDemoToken.sol/QeltrunDemoToken.json',
  );
  const artifact = JSON.parse(await readFile(artifactPath, 'utf8')) as {
    abi: InterfaceAbi;
    bytecode: string;
  };
  const tokenFactory = new ContractFactory(artifact.abi, artifact.bytecode, signer);
  const token = await tokenFactory.deploy(safeAddress);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  const tokenDeploymentTx = token.deploymentTransaction()?.hash;
  if (tokenDeploymentTx === undefined) throw new Error('MISSING_TOKEN_DEPLOYMENT_TX');

  const nativeAmount = 1_000_000_000_000_000n;
  const nativeBefore = await provider.getBalance(destination);
  const nativePayoutTx = await executeSafe(
    moduleAddress,
    moduleInterface.encodeFunctionData('executeNativePayout', [vendorId, nativeAmount]),
  );
  const nativeAfter = await provider.getBalance(destination);
  if (nativeAfter - nativeBefore !== nativeAmount) throw new Error('NATIVE_PAYOUT_MISMATCH');

  const tokenAmount = 125_000_000_000_000_000_000n;
  const tokenContract = new Contract(
    tokenAddress,
    ['function balanceOf(address account) view returns (uint256)'],
    provider,
  ) as unknown as TokenView;
  const tokenBefore = (await tokenContract.balanceOf(destination)) as bigint;
  const tokenPayoutTx = await executeSafe(
    moduleAddress,
    moduleInterface.encodeFunctionData('executeTokenPayout', [vendorId, tokenAddress, tokenAmount]),
  );
  const tokenAfter = (await tokenContract.balanceOf(destination)) as bigint;
  if (tokenAfter - tokenBefore !== tokenAmount) throw new Error('TOKEN_PAYOUT_MISMATCH');

  const pauseTx = await executeSafe(firewallAddress, firewallInterface.encodeFunctionData('pause'));
  if (!(await firewall.paused())) throw new Error('FIREWALL_NOT_PAUSED');
  const blocked = await verifyBlockedPayouts(tokenAddress);
  const unpauseTx = await executeSafe(
    firewallAddress,
    firewallInterface.encodeFunctionData('unpause'),
  );
  if (await firewall.paused()) throw new Error('FIREWALL_STILL_PAUSED');

  console.log(
    JSON.stringify(
      {
        safeAddress,
        firewallAddress,
        moduleAddress,
        vendorId,
        destination,
        demoToken: tokenAddress,
        tokenDeploymentTx,
        nativePayoutTx,
        nativeAmount: nativeAmount.toString(),
        tokenPayoutTx,
        tokenAmount: tokenAmount.toString(),
        pauseTx,
        ...blocked,
        pausedPayoutMovedFunds: false,
        unpauseTx,
        firewallPausedAfterTest: false,
      },
      null,
      2,
    ),
  );
}

await main();

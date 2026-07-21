/** Deploy a deterministic 1-of-1 Safe for the temporary Sepolia treasury. */
import { JsonRpcProvider, Wallet, getAddress } from 'ethers';

type SafeDeployment = { to: string; value: string; data: string };
type SafeProtocol = {
  getAddress(): Promise<string>;
  isSafeDeployed(): Promise<boolean>;
  createSafeDeploymentTransaction(): Promise<SafeDeployment>;
};
type SafeInitializer = {
  init(config: {
    provider: string;
    signer: string;
    predictedSafe: {
      safeAccountConfig: { owners: string[]; threshold: number };
      safeDeploymentConfig: { safeVersion: '1.4.1'; saltNonce: string };
    };
  }): Promise<SafeProtocol>;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === '') throw new Error(`MISSING_${name}`);
  return value;
}

function privateKey(): string {
  const key = required('PRIVATE_KEY');
  return key.startsWith('0x') ? key : `0x${key}`;
}

async function main(): Promise<void> {
  const module = await import('@safe-global/protocol-kit');
  const Safe = module.default as unknown as SafeInitializer;
  const rpcUrl = required('SEPOLIA_RPC_URL');
  const owner = getAddress(required('SAFE_OWNER'));
  const provider = new JsonRpcProvider(rpcUrl);
  const signer = new Wallet(privateKey(), provider);
  if (signer.address !== owner) {
    throw new Error(`SIGNER_OWNER_MISMATCH:${signer.address}:expected:${owner}`);
  }
  const network = await provider.getNetwork();
  if (network.chainId !== 11155111n) throw new Error(`UNSUPPORTED_CHAIN:${network.chainId}`);

  const protocolKit = await Safe.init({
    provider: rpcUrl,
    signer: signer.privateKey,
    predictedSafe: {
      safeAccountConfig: { owners: [owner], threshold: 1 },
      safeDeploymentConfig: {
        safeVersion: '1.4.1',
        saltNonce: process.env.SAFE_SALT_NONCE?.trim() || '0',
      },
    },
  });

  const safeAddress = await protocolKit.getAddress();
  if (await protocolKit.isSafeDeployed()) {
    console.log(JSON.stringify({ safeAddress, owner, threshold: 1, alreadyDeployed: true }, null, 2));
    return;
  }

  const deployment = await protocolKit.createSafeDeploymentTransaction();
  const response = await signer.sendTransaction({
    to: deployment.to,
    value: deployment.value,
    data: deployment.data,
  });
  const receipt = await response.wait();
  if (receipt?.status !== 1) throw new Error(`SAFE_DEPLOYMENT_FAILED:${response.hash}`);
  if ((await provider.getCode(safeAddress)) === '0x') throw new Error(`SAFE_HAS_NO_CODE:${safeAddress}`);

  console.log(
    JSON.stringify(
      {
        safeAddress,
        owner,
        threshold: 1,
        deploymentTx: response.hash,
        blockNumber: receipt.blockNumber,
        alreadyDeployed: false,
      },
      null,
      2,
    ),
  );
}

await main();

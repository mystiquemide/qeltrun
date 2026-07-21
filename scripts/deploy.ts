/**
 * Deploy `QeltrunPayoutFirewall` to a live network.
 *
 *   SEPOLIA_RPC_URL=... PRIVATE_KEY=... pnpm run deploy:sepolia
 *
 * Hardhat 3 reads `configVariable(...)` straight from the process environment; it does not
 * load `.env` files. Export the variables in the shell that runs this command and keep them
 * out of the repository.
 *
 * The script refuses to deploy to a chain Nox does not support, because a firewall whose
 * `Nox.noxComputeContract()` reverts would be a contract that can never approve anything.
 */
import hre from 'hardhat';

import { asFirewall } from '../src/contracts/firewall.js';

/// Chains where `Nox.noxComputeContract()` resolves, keyed to the NoxCompute it returns.
const SUPPORTED_CHAINS: Record<number, { name: string; noxCompute: string }> = {
  11155111: { name: 'Ethereum Sepolia', noxCompute: '0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF' },
  421614: { name: 'Arbitrum Sepolia', noxCompute: '0xd464B198f06756a1d00be223634b85E0a731c229' },
};

async function main(): Promise<void> {
  const { ethers, provider } = await hre.network.getOrCreate();

  const chainId = Number((await provider.request({ method: 'eth_chainId' })) as string);
  const chain = SUPPORTED_CHAINS[chainId];
  if (chain === undefined) {
    throw new Error(
      `UNSUPPORTED_CHAIN:${chainId}. Nox is available on ${Object.keys(SUPPORTED_CHAINS).join(', ')}.`,
    );
  }

  const [deployer] = await ethers.getSigners();
  if (deployer === undefined) {
    throw new Error('NO_SIGNER: set PRIVATE_KEY for the target network.');
  }

  const balance = await provider.request({
    method: 'eth_getBalance',
    params: [deployer.address, 'latest'],
  });
  if (BigInt(balance as string) === 0n) {
    throw new Error(`EMPTY_DEPLOYER:${deployer.address}. Fund it before deploying.`);
  }

  console.log(`Deploying to ${chain.name} (${chainId}) as ${deployer.address}`);

  const firewall = asFirewall(await ethers.deployContract('QeltrunPayoutFirewall'));
  await firewall.waitForDeployment();
  const address = await firewall.getAddress();

  // Confirm the deployment resolves the NoxCompute we expect. If this disagrees, every
  // `sealApproval` would fail proof validation against the wrong protocol contract.
  const resolved = await firewall.noxComputeAddress();
  if (resolved.toLowerCase() !== chain.noxCompute.toLowerCase()) {
    throw new Error(`NOX_ADDRESS_MISMATCH:${resolved}:expected:${chain.noxCompute}`);
  }

  console.log(
    JSON.stringify(
      {
        network: chain.name,
        chainId,
        firewall: address,
        noxCompute: resolved,
        deployer: deployer.address,
        deploymentTx: firewall.deploymentTransaction()?.hash ?? null,
      },
      null,
      2,
    ),
  );

  console.log(
    '\nPass this firewall address as `applicationContract` to `encryptInput`. Nox binds every\n' +
      'input proof to it, so a handle sealed for a different address will be rejected on chain.',
  );
}

await main();

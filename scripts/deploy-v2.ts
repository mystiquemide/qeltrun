/** Deploy v2 policy and its Safe adapter, then hand ownership to the treasury Safe. */
import hre from 'hardhat';

import { asFirewallV2 } from '../src/contracts/firewall-v2.js';
import type { Address } from '../src/domain/types.js';

const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_NOX = '0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF';

function treasurySafe(): Address {
  const value = process.env.TREASURY_SAFE?.trim();
  if (value === undefined || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error('INVALID_TREASURY_SAFE: set TREASURY_SAFE to the deployed Sepolia Safe.');
  }
  return value as Address;
}

async function main(): Promise<void> {
  const safe = treasurySafe();
  const { ethers, provider } = await hre.network.getOrCreate();
  const chainId = Number((await provider.request({ method: 'eth_chainId' })) as string);
  if (chainId !== SEPOLIA_CHAIN_ID) throw new Error(`UNSUPPORTED_CHAIN:${chainId}`);

  const [deployer] = await ethers.getSigners();
  if (deployer === undefined) throw new Error('NO_SIGNER: set PRIVATE_KEY.');
  if ((await ethers.provider.getCode(safe)) === '0x') throw new Error(`SAFE_HAS_NO_CODE:${safe}`);

  const firewall = asFirewallV2(
    await ethers.deployContract('QeltrunPayoutFirewallV2', [deployer.address]),
  );
  await firewall.waitForDeployment();
  const firewallAddress = await firewall.getAddress();
  const resolvedNox = await firewall.noxComputeAddress();
  if (resolvedNox.toLowerCase() !== SEPOLIA_NOX.toLowerCase()) {
    throw new Error(`NOX_ADDRESS_MISMATCH:${resolvedNox}:expected:${SEPOLIA_NOX}`);
  }

  const module = await ethers.deployContract('QeltrunSafePayoutModule', [safe, firewallAddress]);
  await module.waitForDeployment();
  const transfer = await firewall.transferOwnership(safe);
  await transfer.wait();

  console.log(
    JSON.stringify(
      {
        chainId,
        deployer: deployer.address,
        treasurySafe: safe,
        firewall: firewallAddress,
        safeModule: await module.getAddress(),
        noxCompute: resolvedNox,
        firewallDeploymentTx: firewall.deploymentTransaction()?.hash ?? null,
        moduleDeploymentTx: module.deploymentTransaction()?.hash ?? null,
        ownershipTransferTx: transfer.hash,
        requiredSafeActions: [
          `acceptOwnership() on ${firewallAddress}`,
          `enableModule(${await module.getAddress()}) on the Safe`,
        ],
      },
      null,
      2,
    ),
  );
}

await main();

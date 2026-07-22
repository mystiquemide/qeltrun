/**
 * Stand up a complete Qeltrun environment on a running Hardhat node, for the console.
 *
 *   pnpm run node          # terminal 1
 *   pnpm run setup:local   # terminal 2
 *   pnpm --filter qeltrun-web dev
 *
 * The web app never simulates anything. It talks to a real chain running the real NoxCompute, so
 * the only difference between this and Sepolia is which chain id is selected. The contract code,
 * the proof format and the verification path are identical.
 *
 * Writes `web/deployment.local.json`, which the web app reads at build time.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import hre from 'hardhat';

import { vendorId } from '../src/domain/index.js';
import { LOCAL_NOX_COMPUTE } from '../src/providers/local-gateway-approval-provider.js';
import type { Address } from '../src/domain/types.js';

/// Hardhat account #9's key, used as the local Nox gateway signer. Well-known development key.
const LOCAL_GATEWAY_ADDRESS = '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720' as Address;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const DEMO_VENDOR_LABEL = 'vendor:northwind-logistics';
const DEMO_PAYOUT_WALLET = '0x1111111111111111111111111111111111111111' as Address;

type FirewallV2 = {
  waitForDeployment(): Promise<unknown>;
  getAddress(): Promise<string>;
  registerVendor(
    vendorId: string,
    payoutWallet: Address,
    approver: Address,
    treasuryReviewer: Address,
    riskReviewer: Address,
  ): Promise<{ wait(): Promise<unknown> }>;
};

async function main(): Promise<void> {
  const { ethers, provider } = await hre.network.getOrCreate();
  const signers = await ethers.getSigners();
  const [deployer, approver, treasury, risk] = signers;
  if (
    deployer === undefined
    || approver === undefined
    || treasury === undefined
    || risk === undefined
  ) {
    throw new Error('NOT_ENOUGH_SIGNERS: is `pnpm run node` running?');
  }

  const chainId = Number((await provider.request({ method: 'eth_chainId' })) as string);

  // Place the real NoxCompute at the address `Nox.noxComputeContract()` resolves to.
  const noxFactory = await ethers.getContractFactory('LocalNoxCompute');
  const template = await noxFactory.deploy();
  await template.waitForDeployment();
  const runtimeCode = await provider.request({
    method: 'eth_getCode',
    params: [await template.getAddress(), 'latest'],
  });
  await provider.request({ method: 'hardhat_setCode', params: [LOCAL_NOX_COMPUTE, runtimeCode] });

  const nox = noxFactory.attach(LOCAL_NOX_COMPUTE).connect(deployer) as unknown as {
    initialize(
      admin: string,
      upgrader: string,
      kmsPublicKey: string,
      gateway: string,
    ): Promise<{ wait(): Promise<unknown> }>;
    gateway(): Promise<string>;
  };

  // Re-running this script against a node that is already set up is normal. You redeploy the
  // firewall after a contract change without restarting the chain. NoxCompute is initialize-once,
  // so calling it again reverts with an opaque `InvalidInitialization()`. Only initialize if the
  // gateway is unset.
  const existingGateway = await nox.gateway().catch(() => ZERO_ADDRESS);
  if (existingGateway === ZERO_ADDRESS) {
    await (
      await nox.initialize(deployer.address, deployer.address, '0x02deadbeef', LOCAL_GATEWAY_ADDRESS)
    ).wait();
  } else if (existingGateway.toLowerCase() !== LOCAL_GATEWAY_ADDRESS.toLowerCase()) {
    throw new Error(
      `NOX_GATEWAY_MISMATCH:${existingGateway}:expected:${LOCAL_GATEWAY_ADDRESS}. `
        + 'Restart `pnpm run node` to get a clean chain.',
    );
  }

  // The deployer owns the firewall locally, so it can register vendors directly. On Sepolia the
  // treasury Safe owns it and registration goes through a Safe transaction.
  const firewall = (await ethers.deployContract('QeltrunPayoutFirewallV2', [
    deployer.address,
  ])) as unknown as FirewallV2;
  await firewall.waitForDeployment();
  const firewallAddress = (await firewall.getAddress()) as Address;

  // `_validateReviewers` requires four distinct non-zero addresses, so the payout wallet and the
  // three reviewers all have to differ.
  const demoVendorId = vendorId(DEMO_VENDOR_LABEL);
  await (
    await firewall.registerVendor(
      demoVendorId,
      DEMO_PAYOUT_WALLET,
      approver.address as Address,
      treasury.address as Address,
      risk.address as Address,
    )
  ).wait();

  const deployment = {
    chainId,
    firewall: firewallAddress,
    noxCompute: LOCAL_NOX_COMPUTE,
    gateway: LOCAL_GATEWAY_ADDRESS,
    // Reviewer addresses are deliberately not written here. The console reads them from
    // `getVendor`, because they change: rotation moved the Sepolia approver once already, and a
    // configured copy would now be wrong. They are printed below for wallet import instead.
    demoVendor: {
      label: DEMO_VENDOR_LABEL,
      vendorId: demoVendorId,
    },
  };

  await writeFile(
    join(process.cwd(), 'web/deployment.local.json'),
    `${JSON.stringify(deployment, null, 2)}\n`,
    'utf8',
  );

  console.log(JSON.stringify(deployment, null, 2));
  console.log(
    '\nImport all three reviewer keys to drive the full flow. Hardhat accounts #1, #2 and #3,'
      + '\nwell-known development keys, never usable anywhere real.'
      + `\n  approver  ${approver.address}`
      + `\n  treasury  ${treasury.address}`
      + `\n  risk      ${risk.address}`,
  );
}

await main();

/**
 * End-to-end proof that the payout gate only opens for a real Nox approval.
 *
 * Run with `pnpm run demo`. Everything happens against an in-process Hardhat chain running
 * the genuine NoxCompute protocol contract, so the approval bit really does travel as a Nox
 * handle and the gate really is opened by a gateway-signed decryption proof.
 *
 * The script narrates each checkpoint and asserts its outcome, so a failure is a
 * non-zero exit rather than a misleading transcript.
 */
import hre from 'hardhat';

import { asFirewall, firewallAs } from '../src/contracts/firewall.js';
import { decidePayout, requestStatusFrom, vendorId } from '../src/domain/index.js';
import {
  LOCAL_NOX_COMPUTE,
  LocalGatewayApprovalProvider,
} from '../src/providers/local-gateway-approval-provider.js';
import type { Address, Hex, VendorRecord } from '../src/domain/types.js';

/// Hardhat account #9's key, used here as the local Nox gateway signer. This is a well-known
/// development key baked into every Hardhat node; it holds nothing and signs nothing real.
const LOCAL_GATEWAY_KEY = '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6' as Hex;

const VENDOR_LABEL = 'vendor:northwind-logistics';
const VENDOR_ID = vendorId(VENDOR_LABEL);

const GREEN = '[32m';
const RED = '[31m';
const DIM = '[2m';
const BOLD = '[1m';
const RESET = '[0m';

let step = 0;

function checkpoint(title: string): void {
  step += 1;
  console.log(`\n${BOLD}${step}. ${title}${RESET}`);
}

function detail(label: string, value: string): void {
  console.log(`   ${DIM}${label.padEnd(20)}${RESET} ${value}`);
}

function verdict(allowed: boolean, reason: string): void {
  const tag = allowed ? `${GREEN}ALLOWED${RESET}` : `${RED}BLOCKED${RESET}`;
  console.log(`   ${DIM}${'gate'.padEnd(20)}${RESET} ${tag}  ${DIM}${reason}${RESET}`);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`DEMO_ASSERTION_FAILED: ${message}`);
  }
}

async function main(): Promise<void> {
  const { ethers, provider } = await hre.network.getOrCreate();
  const [deployer, approver, treasury] = await ethers.getSigners();
  assert(deployer !== undefined && approver !== undefined && treasury !== undefined, 'signers');

  const chainId = Number((await provider.request({ method: 'eth_chainId' })) as string);

  checkpoint('Stand up the Nox protocol contract locally');
  // `Nox.noxComputeContract()` hard-codes one address per chain, so place the real bytecode
  // there rather than pointing the app somewhere else.
  const noxFactory = await ethers.getContractFactory('LocalNoxCompute');
  const noxTemplate = await noxFactory.deploy();
  await noxTemplate.waitForDeployment();
  const runtimeCode = await provider.request({
    method: 'eth_getCode',
    params: [await noxTemplate.getAddress(), 'latest'],
  });
  await provider.request({ method: 'hardhat_setCode', params: [LOCAL_NOX_COMPUTE, runtimeCode] });

  const gatewayWallet = new ethers.Wallet(LOCAL_GATEWAY_KEY);
  const nox = noxFactory.attach(LOCAL_NOX_COMPUTE).connect(deployer) as unknown as {
    initialize(
      admin: string,
      upgrader: string,
      kmsPublicKey: string,
      gateway: string,
    ): Promise<{ wait(): Promise<unknown> }>;
  };
  await (
    await nox.initialize(deployer.address, deployer.address, '0x02deadbeef', gatewayWallet.address)
  ).wait();

  detail('NoxCompute', LOCAL_NOX_COMPUTE);
  detail('gateway', gatewayWallet.address);
  detail('chain id', String(chainId));

  checkpoint('Deploy the firewall and register a vendor');
  const firewall = asFirewall(await ethers.deployContract('QeltrunPayoutFirewall'));
  await firewall.waitForDeployment();
  const firewallAddress = (await firewall.getAddress()) as Address;

  const honestWallet = '0x1111111111111111111111111111111111111111' as Address;
  const attackerWallet = '0x2222222222222222222222222222222222222222' as Address;

  await (await firewall.registerVendor(VENDOR_ID, honestWallet, approver.address as Address)).wait();

  detail('firewall', firewallAddress);
  detail('vendor', `${VENDOR_LABEL} (${VENDOR_ID.slice(0, 18)}…)`);
  detail('payout wallet', honestWallet);
  detail('approver', approver.address);
  assert(
    (await firewall.noxComputeAddress()) === LOCAL_NOX_COMPUTE,
    'firewall must resolve the local NoxCompute',
  );

  const readVendor = async (): Promise<VendorRecord> => {
    const raw = await firewall.getVendor(VENDOR_ID);
    return {
      vendorId: VENDOR_ID,
      payoutWallet: raw.payoutWallet as Address,
      approver: raw.approver as Address,
      registered: raw.registered as boolean,
    };
  };

  checkpoint('An invoice arrives asking for a new destination — the gate holds');
  let [allowed, reason] = await firewall.isPayoutAllowed(VENDOR_ID, attackerWallet);
  verdict(allowed, reason);
  assert(allowed === false, 'unapproved destination must be blocked');
  assert(decidePayout(await readVendor(), attackerWallet).status === 'blocked', 'client agrees');

  checkpoint('Open a change request — still blocked, because opening proves nothing');
  const asTreasury = firewallAs(firewall, treasury);
  const requestId = await asTreasury.openChangeRequest.staticCall(VENDOR_ID, attackerWallet, 1n);
  await (await asTreasury.openChangeRequest(VENDOR_ID, attackerWallet, 1n)).wait();

  detail('request id', requestId);
  detail('status', requestStatusFrom(Number((await firewall.getRequest(requestId)).status)));
  [allowed, reason] = await firewall.isPayoutAllowed(VENDOR_ID, attackerWallet);
  verdict(allowed, reason);
  assert(allowed === false, 'an open request must not unlock the gate');

  checkpoint('Approver seals the decision inside the TEE — still blocked, the bit is opaque');
  const approvals = new LocalGatewayApprovalProvider({
    chainId,
    gatewayPrivateKey: LOCAL_GATEWAY_KEY,
    approver: approver.address as Address,
  });

  const sealed = await approvals.sealApproval({
    approver: approver.address as Address,
    applicationContract: firewallAddress,
    approve: true,
  });

  await (
    await firewallAs(firewall, approver).sealApproval(requestId, sealed.handle, sealed.handleProof)
  ).wait();

  detail('nox handle', sealed.handle);
  detail('input proof', `${sealed.handleProof.slice(0, 26)}… (${(sealed.handleProof.length - 2) / 2} bytes)`);
  detail('status', requestStatusFrom(Number((await firewall.getRequest(requestId)).status)));
  [allowed, reason] = await firewall.isPayoutAllowed(VENDOR_ID, attackerWallet);
  verdict(allowed, reason);
  assert(allowed === false, 'a sealed but unsettled approval must not unlock the gate');
  assert(
    (await firewall.sealedApprovalHandle(requestId)) === sealed.handle,
    'the contract must hold the handle it was given',
  );

  checkpoint('Reveal the bit with a gateway-signed decryption proof — the gate opens');
  const revealed = await approvals.revealApproval(sealed.handle);
  await (await firewall.settleApproval(requestId, revealed.decryptionProof)).wait();

  detail('decrypted bit', String(revealed.value));
  detail('status', requestStatusFrom(Number((await firewall.getRequest(requestId)).status)));
  [allowed, reason] = await firewall.isPayoutAllowed(VENDOR_ID, attackerWallet);
  verdict(allowed, reason);
  assert(allowed === true, 'a settled approval must unlock the new destination');
  assert((await readVendor()).payoutWallet === attackerWallet, 'payout wallet must have moved');

  checkpoint('And the wallet it moved away from now needs its own approval');
  [allowed, reason] = await firewall.isPayoutAllowed(VENDOR_ID, honestWallet);
  verdict(allowed, reason);
  assert(allowed === false, 'the previous destination must not stay allowed');

  console.log(`\n${GREEN}All checkpoints held.${RESET}\n`);
}

await main();

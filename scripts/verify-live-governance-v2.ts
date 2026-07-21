/** Certify v2 approver rotation and delayed recovery against Sepolia. */
import {
  Contract,
  Interface,
  JsonRpcProvider,
  Wallet,
  getAddress,
  keccak256,
  solidityPacked,
  toUtf8Bytes,
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

type Vendor = {
  payoutWallet: string;
  approver: string;
  treasuryReviewer: string;
  riskReviewer: string;
  approverEpoch: bigint;
  registered: boolean;
};
type Recovery = { newApprover: string; executeAfter: bigint; candidateAccepted: boolean };
type FirewallView = {
  getVendor(vendorId: string): Promise<Vendor>;
  getApproverRecovery(vendorId: string): Promise<Recovery>;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === '') throw new Error(`MISSING_${name}`);
  return value;
}

function derivedWallet(rootKey: string, label: string, provider: JsonRpcProvider): Wallet {
  const key = keccak256(solidityPacked(['bytes32', 'string'], [rootKey, label]));
  return new Wallet(key, provider);
}

async function main(): Promise<void> {
  const rpcUrl = required('SEPOLIA_RPC_URL');
  const rawKey = required('PRIVATE_KEY');
  const key = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
  const safeAddress = getAddress(required('TREASURY_SAFE'));
  const firewallAddress = getAddress(required('FIREWALL_V2_ADDRESS'));
  const provider = new JsonRpcProvider(rpcUrl);
  const ownerSigner = new Wallet(key, provider);
  const rotationCandidate = derivedWallet(key, 'qeltrun/v2/rotation-candidate', provider);
  const treasuryReviewer = derivedWallet(key, 'qeltrun/v2/treasury-reviewer', provider);
  const riskReviewer = derivedWallet(key, 'qeltrun/v2/risk-reviewer', provider);
  const recoveryCandidate = derivedWallet(key, 'qeltrun/v2/recovery-candidate', provider);
  const modulePackage = await import('@safe-global/protocol-kit');
  const Safe = modulePackage.default as unknown as SafeInitializer;
  const protocolKit = await Safe.init({ provider: rpcUrl, signer: key, safeAddress });

  const abi = [
    'function registerVendor(bytes32,address,address,address,address)',
    'function proposeApproverRotation(bytes32,address)',
    'function approveApproverRotation(bytes32,address)',
    'function acceptApproverRotation(bytes32)',
    'function scheduleApproverRecovery(bytes32,address)',
    'function acceptApproverRecovery(bytes32)',
    'function vetoApproverRecovery(bytes32)',
    'function executeApproverRecovery(bytes32)',
    'function getVendor(bytes32) view returns ((address payoutWallet,address approver,address treasuryReviewer,address riskReviewer,uint64 approverEpoch,bool registered))',
    'function getApproverRecovery(bytes32) view returns ((address newApprover,uint64 executeAfter,bool candidateAccepted))',
  ];
  const firewall = new Contract(firewallAddress, abi, provider) as unknown as FirewallView;
  const firewallInterface = new Interface(abi);
  const executeSafe = async (
    data: string,
    options?: { safeTxGas?: bigint | string },
  ): Promise<string> => {
    const safeTx = await protocolKit.createTransaction({
      transactions: [{ to: firewallAddress, value: '0', data }],
      ...(options === undefined ? {} : { options }),
    });
    const result = await protocolKit.executeTransaction(safeTx);
    const receipt = await result.transactionResponse.wait();
    if (receipt.status !== 'success') throw new Error(`SAFE_OUTER_TX_REVERTED:${result.hash}`);
    return result.hash;
  };
  const sendDirect = async (wallet: Wallet, data: string): Promise<string> => {
    const tx = await wallet.sendTransaction({ to: firewallAddress, data });
    const receipt = await tx.wait();
    if (receipt?.status !== 1) throw new Error(`DIRECT_TX_REVERTED:${tx.hash}`);
    return tx.hash;
  };
  const fund = async (wallet: Wallet): Promise<string | null> => {
    if ((await provider.getBalance(wallet.address)) >= 1_000_000_000_000_000n) return null;
    const tx = await ownerSigner.sendTransaction({ to: wallet.address, value: 2_000_000_000_000_000n });
    await tx.wait();
    return tx.hash;
  };

  const fundingTransactions: string[] = [];
  for (const wallet of [rotationCandidate, recoveryCandidate]) {
    const fundingTx = await fund(wallet);
    if (fundingTx !== null) fundingTransactions.push(fundingTx);
  }

  const primaryVendorId = '0xd52caa61e1a8f1a43f6b03225799455025e90db256712acc80ffc7271f3769a4';
  let primary = await firewall.getVendor(primaryVendorId);
  let rotationProposeTx: string | null = null;
  let rotationAcceptTx: string | null = null;
  let rotationApproveTx: string | null = null;
  if (getAddress(primary.approver) === ownerSigner.address) {
    rotationProposeTx = await executeSafe(
      firewallInterface.encodeFunctionData('proposeApproverRotation', [
        primaryVendorId,
        rotationCandidate.address,
      ]),
    );
    rotationAcceptTx = await sendDirect(
      rotationCandidate,
      firewallInterface.encodeFunctionData('acceptApproverRotation', [primaryVendorId]),
    );
    const beforeCurrentApproval = await firewall.getVendor(primaryVendorId);
    if (getAddress(beforeCurrentApproval.approver) !== ownerSigner.address) {
      throw new Error('ROTATION_FINALIZED_WITHOUT_CURRENT_APPROVER');
    }
    rotationApproveTx = await sendDirect(
      ownerSigner,
      firewallInterface.encodeFunctionData('approveApproverRotation', [
        primaryVendorId,
        rotationCandidate.address,
      ]),
    );
    primary = await firewall.getVendor(primaryVendorId);
  }
  if (getAddress(primary.approver) !== rotationCandidate.address || primary.approverEpoch !== 2n) {
    throw new Error('NORMAL_ROTATION_NOT_FINALIZED');
  }

  const recoveryVendorId = keccak256(toUtf8Bytes('qeltrun/v2/recovery-disposable/2026-07-21'));
  let recoveryVendor = await firewall.getVendor(recoveryVendorId);
  let registerRecoveryVendorTx: string | null = null;
  if (!recoveryVendor.registered) {
    registerRecoveryVendorTx = await executeSafe(
      firewallInterface.encodeFunctionData('registerVendor', [
        recoveryVendorId,
        '0x6666666666666666666666666666666666666666',
        ownerSigner.address,
        treasuryReviewer.address,
        riskReviewer.address,
      ]),
    );
    recoveryVendor = await firewall.getVendor(recoveryVendorId);
  }

  let recovery = await firewall.getApproverRecovery(recoveryVendorId);
  let recoveryScheduleTx: string | null = null;
  let recoveryAcceptTx: string | null = null;
  let earlyExecutionFailureTx: string | null = null;
  let recoveryVetoTx: string | null = null;
  let finalRecoveryScheduleTx: string | null = null;
  let finalRecoveryAcceptTx: string | null = null;
  let recoveryExecuteTx: string | null = null;

  if (getAddress(recoveryVendor.approver) === ownerSigner.address && recovery.newApprover === ZERO_ADDRESS) {
    recoveryScheduleTx = await executeSafe(
      firewallInterface.encodeFunctionData('scheduleApproverRecovery', [
        recoveryVendorId,
        recoveryCandidate.address,
      ]),
    );
    recoveryAcceptTx = await sendDirect(
      recoveryCandidate,
      firewallInterface.encodeFunctionData('acceptApproverRecovery', [recoveryVendorId]),
    );
    earlyExecutionFailureTx = await executeSafe(
      firewallInterface.encodeFunctionData('executeApproverRecovery', [recoveryVendorId]),
      { safeTxGas: 250_000n },
    );
    recovery = await firewall.getApproverRecovery(recoveryVendorId);
    if (getAddress(recovery.newApprover) !== recoveryCandidate.address) {
      throw new Error('EARLY_RECOVERY_CHANGED_STATE');
    }
    recoveryVetoTx = await sendDirect(
      ownerSigner,
      firewallInterface.encodeFunctionData('vetoApproverRecovery', [recoveryVendorId]),
    );
    recovery = await firewall.getApproverRecovery(recoveryVendorId);
    if (recovery.newApprover !== ZERO_ADDRESS) throw new Error('RECOVERY_VETO_FAILED');

    finalRecoveryScheduleTx = await executeSafe(
      firewallInterface.encodeFunctionData('scheduleApproverRecovery', [
        recoveryVendorId,
        recoveryCandidate.address,
      ]),
    );
    finalRecoveryAcceptTx = await sendDirect(
      recoveryCandidate,
      firewallInterface.encodeFunctionData('acceptApproverRecovery', [recoveryVendorId]),
    );
    recovery = await firewall.getApproverRecovery(recoveryVendorId);
  }

  const latestBlock = await provider.getBlock('latest');
  if (latestBlock === null) throw new Error('MISSING_LATEST_BLOCK');
  if (
    getAddress(recoveryVendor.approver) === ownerSigner.address &&
    recovery.newApprover !== ZERO_ADDRESS &&
    BigInt(latestBlock.timestamp) >= recovery.executeAfter
  ) {
    recoveryExecuteTx = await executeSafe(
      firewallInterface.encodeFunctionData('executeApproverRecovery', [recoveryVendorId]),
    );
    recoveryVendor = await firewall.getVendor(recoveryVendorId);
  }

  const delayedRecoveryComplete = getAddress(recoveryVendor.approver) === recoveryCandidate.address;
  console.log(
    JSON.stringify(
      {
        safeAddress,
        firewallAddress,
        fundingTransactions,
        normalRotation: {
          vendorId: primaryVendorId,
          candidate: rotationCandidate.address,
          proposeTx: rotationProposeTx,
          candidateAcceptTx: rotationAcceptTx,
          currentApproverApproveTx: rotationApproveTx,
          approver: primary.approver,
          approverEpoch: primary.approverEpoch.toString(),
          complete: true,
        },
        recovery: {
          vendorId: recoveryVendorId,
          candidate: recoveryCandidate.address,
          registerVendorTx: registerRecoveryVendorTx,
          scheduleTx: recoveryScheduleTx,
          candidateAcceptTx: recoveryAcceptTx,
          earlyExecutionFailureTx,
          vetoTx: recoveryVetoTx,
          finalScheduleTx: finalRecoveryScheduleTx,
          finalCandidateAcceptTx: finalRecoveryAcceptTx,
          executeAfter: recovery.executeAfter.toString(),
          executeTx: recoveryExecuteTx,
          delayedRecoveryComplete,
        },
      },
      null,
      2,
    ),
  );
}

await main();

/**
 * Verified Ethereum Sepolia deployment facts.
 *
 * Every value here was read back off chain on 2026-07-22 at block 11324881, not copied from a
 * deploy log. Runtime code sizes matched the certification record exactly: 12,617 bytes for the
 * firewall and 2,338 for the Safe module.
 *
 * These are immutable deployed addresses, so they are constants here on purpose. The dashboard
 * still reads mutable state (payout wallet, reviewers, epoch, paused) from chain, because a
 * configured copy of anything that can change would only ever go stale.
 */
export const SEPOLIA_CHAIN_ID = 11155111;

export type Contract = {
  label: string;
  address: `0x${string}`;
  note: string;
};

export const CONTRACTS: Contract[] = [
  {
    label: 'Payout firewall',
    address: '0x719a235Be27F0b7B7F82775aFBEA6a2dE6264fe6',
    note: 'Holds the gate. Three private signals settle one verdict.',
  },
  {
    label: 'Safe payout module',
    address: '0xea3C039795B5b04105B795c8B0cB85e0a42Cc85C',
    note: 'Checks the policy destination immediately before the Safe sends funds.',
  },
  {
    label: 'Treasury Safe',
    address: '0x2891Fc04EC1b5e482A37978961fC3256BCA1B263',
    note: 'Owns the firewall and custodies the funds. Temporary 1 of 1.',
  },
  {
    label: 'NoxCompute',
    address: '0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF',
    note: 'The canonical iExec Nox protocol contract on Sepolia.',
  },
];

/**
 * The five Nox handles from the certified three-reviewer run.
 *
 * Signal handles were read out of the `PrivateSignalSubmitted` receipts; the aggregate and
 * verdict came from `aggregateScoreHandle` and `verdictHandle`. The `public` flags are what
 * `NoxCompute.isPubliclyDecryptable` answered on 2026-07-22, and anyone can call it and get the
 * same answers.
 *
 * The bytes are self-describing. Byte 0 is the version, bytes 1 to 4 are the chain id, so
 * `0000aa36a7` is 11155111. Byte 5 is the TEE type, which is why the four private handles read
 * `05` for uint16 and the verdict reads `00` for bool.
 */
export type NoxHandle = {
  role: string;
  handle: `0x${string}`;
  type: 'uint16' | 'bool';
  public: boolean;
  note: string;
};

export const HANDLES: NoxHandle[] = [
  {
    role: 'Approver signal',
    handle: '0x0000aa36a705013eee15b7467ad806b105e64ed0e1da16c144d3867a23f6d863',
    type: 'uint16',
    public: false,
    note: 'Sealed by the vendor approver.',
  },
  {
    role: 'Treasury signal',
    handle: '0x0000aa36a70501f8c36048eaf8a3218d90e7bc0dfe2d2c608795f8d122d389c7',
    type: 'uint16',
    public: false,
    note: 'Sealed by the treasury reviewer.',
  },
  {
    role: 'Risk signal',
    handle: '0x0000aa36a7050189ba64610050e54e68cfbfbb64c95fe3b1af4224b35594a112',
    type: 'uint16',
    public: false,
    note: 'Sealed by the risk reviewer.',
  },
  {
    role: 'Aggregate',
    handle: '0x0000aa36a705017747198c5c9332d2a51df3f793f81a587b2c3dc4eedb44e0a7',
    type: 'uint16',
    public: false,
    note: 'The sum. Computed by the contract, never readable by it.',
  },
  {
    role: 'Verdict',
    handle: '0x0000aa36a70001c27055d1d4a7151b137ae11e26b2ec1c9f8734cb5082dc837e',
    type: 'bool',
    public: true,
    note: 'The only handle the contract makes publicly decryptable.',
  },
];

/**
 * Governance receipts, all from the live certification run.
 *
 * The rotation completed on the live vendor and moved its approver epoch to 2, which is why the
 * approver today is the rotation candidate and no longer the deployer.
 *
 * The pending recovery is on a **disposable test vendor**, not the live vendor. It exists to
 * observe the seven day delay on a public chain. Saying otherwise would imply the production
 * vendor is mid-recovery, which it is not.
 */
export const RECOVERY_EXECUTE_AFTER = 1785268932;

export const GOVERNANCE_TXS = {
  rotationProposed: '0xeee51ae209354194c5a0b95593618bc7bbf8bc6e2120d17a218f4d36fafaa785',
  rotationCandidateAccepted: '0x5a7bcd70ea3f1e860d255af101ad3111251174bc1dff4170e7f7009f0b349ca7',
  rotationApproved: '0xf19a7f085cac7b0761ca198be27a104a078627dd312e137a6b3859b8216f2889',
  recoveryScheduled: '0xe79285ef018012ab24d0c595863ad1c96df60361760100995576ce81bfd6f75f',
  recoveryAccepted: '0xaf2e3e15c032e846489477e6e0300b11e2413d7b7b6931fedfb5473d8f1d793d',
  recoveryEarlyAttemptFailed: '0xacdb4b029de8641c901ea16920c956277749649634d420bb63346c72a0312c3d',
  recoveryVetoed: '0x3756c66a1f7a21fdbce0f810081b69bac3098a6fda939ddcc11e832e3b60811f',
} as const;

/**
 * The full certified run, every hash verified on chain on 2026-07-22.
 *
 * Blocks 11321759 to 11321907, so the whole thing took 148 blocks, roughly half an hour.
 *
 * The two paused attempts are the subtle ones. Both transactions have status `success`, because
 * the Safe confirmed, while the inner payout reverted and the Safe emitted `ExecutionFailure`.
 * No balance moved. Calling those rows "failed transactions" would be wrong in both directions.
 */
export type Receipt = { step: string; outcome: string; hash: string; block: number };
export type ReceiptGroup = { title: string; note: string; rows: Receipt[] };

export const RECEIPT_GROUPS: ReceiptGroup[] = [
  {
    title: 'A vendor asks to be paid somewhere new',
    note: 'The request records intent and moves nothing. Three reviewers then seal a private position on it, and the gate stays shut until the third one lands.',
    rows: [
      { step: 'Vendor onboarded with three reviewers', outcome: 'approver, treasury, risk', hash: '0x5825d79dadf89eeac3724c75186ce6f4e5cea38051fa0f59b07a4e125d1b0b4e', block: 11321792 },
      { step: 'Destination change requested', outcome: 'gate unchanged', hash: '0xdbb4e084e78a6ddbdecb8bc8a2c26d9b0232c742ac7ca1e0544d78def98cd6b0', block: 11321802 },
      { step: 'Approver seals a private position', outcome: '1 of 3', hash: '0x1f5e837c4b32cd9e61f963579e89e20a664ec1638a1b3fbabdb343ffdbb955bd', block: 11321803 },
      { step: 'Treasury seals a private position', outcome: '2 of 3', hash: '0x3e5bbc1afaa6a8bc4d810bd830c373562998962c8e632977860f16988386cdc7', block: 11321804 },
      { step: 'Risk seals a private position', outcome: 'verdict sealed', hash: '0xeb950db8fbff6edf164429ebffe4eda84d28b932a478e088801062d936b5f021', block: 11321806 },
      { step: 'Verdict decrypted and settled', outcome: 'destination approved', hash: '0x0743b8760fc8f27bdb5212b99ece5bd9811169e9c2d1ceec2b9aa25dc4071364', block: 11321808 },
    ],
  },
  {
    title: 'The treasury pays the approved destination',
    note: 'Funds sit in the Safe throughout. The module re-checks the policy destination in the same transaction that sends them, so an approval cannot go stale between decision and payment.',
    rows: [
      { step: 'ERC-20 asset issued for the payout path', outcome: 'QDT, Sepolia only', hash: '0xe985b1494c8d95a67117bcd815519e53e3c1bce9b8c7aea257d300dfff477c6a', block: 11321824 },
      { step: 'Native payment sent', outcome: '0.001 ETH delivered', hash: '0xdf59b0a5a774db948cd496cf8db3a78057ef34f9141f91cc385ff2b79e39cc5f', block: 11321825 },
      { step: 'ERC-20 payment sent', outcome: '125 QDT delivered', hash: '0x4f2ce50193daa88b18403b7a6d209933c8471c40fc8764d26217434ed073d443', block: 11321827 },
    ],
  },
  {
    title: 'The same payments, refused',
    note: 'With the firewall halted, both payments were attempted again against the same approved destination. The Safe transactions confirmed, the transfers reverted inside them, and no balance moved.',
    rows: [
      { step: 'Firewall halted', outcome: 'paused', hash: '0x264edd60a8388329cb22bccfd4a1a2fbe374927f3a1d5a9324aa761041979ebe', block: 11321903 },
      { step: 'Native payment attempted', outcome: 'refused, nothing sent', hash: '0xd9ff367360a8fc68cb303bd2c53e97227ac1e702d84310aa0dee9b92fac2c8a1', block: 11321904 },
      { step: 'ERC-20 payment attempted', outcome: 'refused, nothing sent', hash: '0xb2fbf4db67e4f5641cafce6e23ab22f23c1debfedf42ce09ff5ff35194754628', block: 11321906 },
      { step: 'Firewall resumed', outcome: 'live again', hash: '0x20234a7761b9f5d7bc0f423ee90e4ae6dd98cff0907b9681ae57168f0ede3c4f', block: 11321907 },
    ],
  },
  {
    title: 'Nobody holds a key that can override this',
    note: 'The account that deployed the firewall does not own it. Ownership went to the treasury Safe through a two step transfer the Safe had to accept, and the Safe cannot approve a destination either.',
    rows: [
      { step: 'Treasury Safe created', outcome: 'holds the funds', hash: '0xd7854c0f6ad42bb1491c04330d516e286ca8d46c11c8755c5d2e0b81d5e59499', block: 11321759 },
      { step: 'Firewall published', outcome: '12,617 bytes', hash: '0x1b5cc916da0e392fdb287bcd14bd195743fc199e99516bae784d065c7c371826', block: 11321762 },
      { step: 'Payout module published', outcome: '2,338 bytes', hash: '0x38422a6c1240e2a198f6d444dd261ba0653f6cfcaa41a4c59545c818944ece9f', block: 11321763 },
      { step: 'Deployer offers up ownership', outcome: 'awaiting acceptance', hash: '0x305b63d8cad75bea329694015e0c9eb6c67f171107c6876fc12d8bb91f9f96d2', block: 11321764 },
      { step: 'Safe takes ownership', outcome: 'deployer has no powers', hash: '0xb2f06ac5c002d3295b9aa2f0cebb2132c0f9fa5f2e7cbb9681ce621f86f5c57f', block: 11321774 },
    ],
  },
];

export function etherscanAddress(address: string): string {
  return `https://sepolia.etherscan.io/address/${address}`;
}

export function etherscanTx(hash: string): string {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}

/// Middle-truncation. Addresses are read by their ends, so that is what stays visible.
export function shortAddress(address: string, lead = 10, tail = 8): string {
  return address.length <= lead + tail + 1
    ? address
    : `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

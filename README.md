# Qeltrun

**Before funds move, prove the destination change.**

[![CI](https://github.com/Mystiquemide/qeltrun/actions/workflows/ci.yml/badge.svg)](https://github.com/Mystiquemide/qeltrun/actions/workflows/ci.yml)
[![Ethereum Sepolia](https://img.shields.io/badge/network-Ethereum%20Sepolia-627eea)](https://sepolia.etherscan.io/address/0x719a235Be27F0b7B7F82775aFBEA6a2dE6264fe6)
[![iExec Nox](https://img.shields.io/badge/privacy-iExec%20Nox-00c389)](https://docs.iex.ec/nox-protocol/getting-started/welcome)

## The story

I do not have a dramatic theft receipt to turn into marketing.

I built Qeltrun because treasury controls usually verify who signed a payment, but not whether a
vendor's newly supplied destination is legitimate.

The receipt I can show is technical: a live Sepolia Safe, three private Nox reviewer signals,
real native and ERC-20 payouts, and failed transactions when the policy is paused.

## One rule

I did not build another multisig, an owner-managed allowlist, or an encrypted counter demo. I
built a payout firewall where a Safe can pay a vendor only at the destination approved through
three confidential reviewers.

## How it works

Anyone may request a vendor-wallet change, but opening a request proves nothing.
Three distinct reviewers submit private `uint16` signals through iExec Nox.
The contract keeps every raw signal and the aggregate private, then reveals only the final
all-approved verdict. A Safe module resolves the current policy wallet immediately before paying.

| Operation | Result |
|---|---|
| Open wallet-change request | Recorded, payout policy stays unchanged |
| Submit one or two reviewer signals | Inputs stay private, request cannot settle |
| Submit the third signal | Final verdict becomes decryptable, raw values remain private |
| Settle a true verdict | Vendor payout wallet changes once |
| Pay native or ERC-20 assets | Safe module pays only the current policy wallet |
| Pause the firewall | Both native and token payouts fail closed |
| Rotate the approver | Current approver and candidate must both consent |
| Recover a lost approver key | Candidate acceptance, seven-day delay, current-approver veto |

The three reviewer roles are the current approver, treasury reviewer, and risk reviewer. Reviewer
changes increment an epoch, so old collecting or sealed requests cannot survive a role change.
Request IDs also bind the vendor, old and proposed wallets, requester, nonce, epoch, chain, and
contract address.

## Try it in 2 minutes

### Fastest proof path

No wallet is needed to inspect the evidence:

1. Open the [v2 firewall on Sepolia](https://sepolia.etherscan.io/address/0x719a235Be27F0b7B7F82775aFBEA6a2dE6264fe6).
2. Inspect the [three-signal settlement](https://sepolia.etherscan.io/tx/0x0743b8760fc8f27bdb5212b99ece5bd9811169e9c2d1ceec2b9aa25dc4071364).
3. Inspect the [native payout](https://sepolia.etherscan.io/tx/0xdf59b0a5a774db948cd496cf8db3a78057ef34f9141f91cc385ff2b79e39cc5f) and [ERC-20 payout](https://sepolia.etherscan.io/tx/0x4f2ce50193daa88b18403b7a6d209933c8471c40fc8764d26217434ed073d443).
4. Inspect the [paused native failure](https://sepolia.etherscan.io/tx/0xd9ff367360a8fc68cb303bd2c53e97227ac1e702d84310aa0dee9b92fac2c8a1) and [paused token failure](https://sepolia.etherscan.io/tx/0xb2fbf4db67e4f5641cafce6e23ab22f23c1debfedf42ce09ff5ff35194754628).

The expected result is asymmetric: successful module calls emit `VendorPayoutExecuted`; paused
attempts emit Safe `ExecutionFailure` and no payout event.

### Runnable path

```bash
pnpm install
pnpm run verify
pnpm run demo
```

`pnpm run demo` runs the original end-to-end Nox lifecycle on an in-process Hardhat chain and
exits non-zero if any checkpoint fails.

## 12 ways Qeltrun was verified

| Case | Outcome | Proof |
|---|---|---|
| Handle minted for another contract | Rejected by Nox app binding | [`QeltrunPayoutFirewall.attack.t.sol`](test/solidity/QeltrunPayoutFirewall.attack.t.sol) |
| Handle minted for another owner | Rejected by Nox owner binding | [`QeltrunPayoutFirewall.attack.t.sol`](test/solidity/QeltrunPayoutFirewall.attack.t.sol) |
| Forged gateway signature | Rejected | [`QeltrunPayoutFirewall.attack.t.sol`](test/solidity/QeltrunPayoutFirewall.attack.t.sol) |
| Expired proof | Rejected | [`QeltrunPayoutFirewall.attack.t.sol`](test/solidity/QeltrunPayoutFirewall.attack.t.sol) |
| Handle replayed on a second request | Rejected by one-shot handle ledger | [`QeltrunPayoutFirewallV2.t.sol`](test/solidity/QeltrunPayoutFirewallV2.t.sol) |
| Concurrent stale settlement | Rejected before wallet overwrite | [`QeltrunPayoutFirewallV2.t.sol`](test/solidity/QeltrunPayoutFirewallV2.t.sol) |
| Three private reviewer inputs | Only final verdict became public | [Live lifecycle](https://sepolia.etherscan.io/tx/0x0743b8760fc8f27bdb5212b99ece5bd9811169e9c2d1ceec2b9aa25dc4071364) |
| External caller invokes payout module | Rejected | [`QeltrunSafePayoutModule.t.sol`](test/solidity/QeltrunSafePayoutModule.t.sol) |
| Disabled module attempts payout | Safe funds stay put | [`QeltrunSafePayoutModule.t.sol`](test/solidity/QeltrunSafePayoutModule.t.sol) |
| Paused native and token payouts | Both failed, balances unchanged | [Native](https://sepolia.etherscan.io/tx/0xd9ff367360a8fc68cb303bd2c53e97227ac1e702d84310aa0dee9b92fac2c8a1) / [token](https://sepolia.etherscan.io/tx/0xb2fbf4db67e4f5641cafce6e23ab22f23c1debfedf42ce09ff5ff35194754628) |
| Candidate accepts rotation alone | Approver remains unchanged | [`QeltrunPayoutFirewallV2.governance.t.sol`](test/solidity/QeltrunPayoutFirewallV2.governance.t.sol) |
| Recovery executes before seven days | Safe execution failed; veto succeeded | [Early failure](https://sepolia.etherscan.io/tx/0xacdb4b029de8641c901ea16920c956277749649634d420bb63346c72a0312c3d) / [veto](https://sepolia.etherscan.io/tx/0x3756c66a1f7a21fdbce0f810081b69bac3098a6fda939ddcc11e832e3b60811f) |

The Solidity harness uses genuine `NoxCompute` bytecode from
`@iexec-nox/nox-protocol-contracts`. It validates the real proof layout, EIP-712 digests,
gateway recovery, ACL, and decryption checks instead of replacing the protocol contract with a
mock.

## Addresses and live proof

Network: Ethereum Sepolia, chain ID `11155111`.

| Component | Address | Deployment proof |
|---|---|---|
| v2 firewall | [`0x719a235Be27F0b7B7F82775aFBEA6a2dE6264fe6`](https://sepolia.etherscan.io/address/0x719a235Be27F0b7B7F82775aFBEA6a2dE6264fe6) | [`0x1b5cc9...1826`](https://sepolia.etherscan.io/tx/0x1b5cc916da0e392fdb287bcd14bd195743fc199e99516bae784d065c7c371826) |
| Treasury Safe | [`0x2891Fc04EC1b5e482A37978961fC3256BCA1B263`](https://sepolia.etherscan.io/address/0x2891Fc04EC1b5e482A37978961fC3256BCA1B263) | [`0xd7854c...9499`](https://sepolia.etherscan.io/tx/0xd7854c0f6ad42bb1491c04330d516e286ca8d46c11c8755c5d2e0b81d5e59499) |
| Safe payout module | [`0xea3C039795B5b04105B795c8B0cB85e0a42Cc85C`](https://sepolia.etherscan.io/address/0xea3C039795B5b04105B795c8B0cB85e0a42Cc85C) | [`0x38422a...ce9f`](https://sepolia.etherscan.io/tx/0x38422a6c1240e2a198f6d444dd261ba0653f6cfcaa41a4c59545c818944ece9f) |
| NoxCompute | [`0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF`](https://sepolia.etherscan.io/address/0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF) | Canonical iExec Sepolia deployment |
| Demo token | [`0xdD4e53433FF3D99C76728df1ca68023a81a12d60`](https://sepolia.etherscan.io/address/0xdD4e53433FF3D99C76728df1ca68023a81a12d60) | [`0xe985b1...c6a`](https://sepolia.etherscan.io/tx/0xe985b1494c8d95a67117bcd815519e53e3c1bce9b8c7aea257d300dfff477c6a) |

Safe ownership acceptance and module enablement happened in one batched transaction:
[`0xb2f06a...c57f`](https://sepolia.etherscan.io/tx/0xb2f06ac5c002d3295b9aa2f0cebb2132c0f9fa5f2e7cbb9681ce621f86f5c57f).

Generated ABI: [`src/contracts/generated/firewall-v2-abi.ts`](src/contracts/generated/firewall-v2-abi.ts).

## Real usage

The Sepolia Safe has executed actual testnet transactions through the module:

| Action | Transaction | Result |
|---|---|---|
| Register three-reviewer vendor | [`0x5825d7...0b4e`](https://sepolia.etherscan.io/tx/0x5825d79dadf89eeac3724c75186ce6f4e5cea38051fa0f59b07a4e125d1b0b4e) | Vendor epoch 1 |
| Settle three-signal approval | [`0x0743b8...1364`](https://sepolia.etherscan.io/tx/0x0743b8760fc8f27bdb5212b99ece5bd9811169e9c2d1ceec2b9aa25dc4071364) | Wallet changed once |
| Native payout | [`0xdf59b0...cc5f`](https://sepolia.etherscan.io/tx/0xdf59b0a5a774db948cd496cf8db3a78057ef34f9141f91cc385ff2b79e39cc5f) | `0.001 ETH` to policy wallet |
| ERC-20 payout | [`0x4f2ce5...d443`](https://sepolia.etherscan.io/tx/0x4f2ce50193daa88b18403b7a6d209933c8471c40fc8764d26217434ed073d443) | `125 QDT` to policy wallet |
| Two-party approver rotation | [`0xf19a7f...2889`](https://sepolia.etherscan.io/tx/0xf19a7f085cac7b0761ca198be27a104a078627dd312e137a6b3859b8216f2889) | Approver epoch advanced to 2 |

The console is gated behind wallet connect: it renders nothing but a connect prompt until a
wallet is attached, so every number and every action on screen traces back to a signature. New
screenshots of the v2 console are pending; the pair below still shows the earlier v1 dashboard
against Sepolia and predates the wallet gate.

| Blocked | Allowed |
|---|---|
| ![Payout blocked](docs/screenshots/01-blocked.png) | ![Payout allowed](docs/screenshots/02-allowed.png) |

## How this differs

| Alternative | What it does | Why Qeltrun is different |
|---|---|---|
| Safe or multisig alone | Proves enough owners signed a transfer | Qeltrun checks whether the destination passed confidential policy before the Safe pays it |
| Owner-managed allowlist | Lets an admin directly replace destinations | The Safe governs reviewers and recovery, but there is no direct `setPayoutWallet` bypass |
| Manual vendor callback | Relies on finance staff following a process | Qeltrun turns the decision into a state transition that the payout module enforces |
| Generic encrypted-value demo | Stores and later reveals a private value | Qeltrun uses the private computation as authorization for a real treasury action |
| Public three-signature vote | Exposes every reviewer's decision | Qeltrun leaves raw signals and their aggregate private, revealing only the final verdict |

## Honest limitations

- **Unaudited.** The repository has self-review, Slither baselines, fuzzing, invariants, and live
  transaction evidence. None of that is a third-party security audit.
- **Testnet only.** The contracts and assets are on Sepolia and have never held real funds.
- **Temporary Safe setup.** The demo Safe is 1-of-1. Its exposed test key must be rotated and
  independent owners added before production use.
- **Nox trust assumption.** Compromise of the Nox gateway signing key or its TEE trust model
  breaks confidentiality and proof authority.
- **Safe governance exists.** The Safe can register vendors, change operational reviewers,
  pause, and schedule delayed approver recovery. It cannot directly replace a payout wallet.
- **Screenshots lag the shipped frontend.** The v2 console (wallet-gated, RainbowKit, Sepolia
  default) is live in the repo; the README screenshots above still show the earlier v1 dashboard.
- **One live recovery observation is still maturing.** Early failure and veto passed on Sepolia.
  Successful post-delay execution passes locally and the matching public-chain transaction can
  execute after `2026-07-28 20:02:12 UTC`.
- **No real-world identity claim.** Reviewer wallets authorize a destination change. Qeltrun
  does not prove ownership of a bank account or legal vendor identity.

Nox is TEE-based confidential computing using Intel TDX. It is not FHE and it is not a
zero-knowledge proof system.

## What's real

The v2 contract, Safe, module, Nox inputs, settlement, native payout, token payout, pause
failures, rotation, and recovery controls all have live Sepolia evidence. There is no mocked
value in that live path.

Local Solidity tests run genuine NoxCompute bytecode. The local gateway service uses a test key
because iExec does not provide its Sepolia gateway inside a local Hardhat process. The proof
bytes and on-chain verification remain protocol-compatible.

Current status:

- 36 Vitest tests pass.
- 64 Solidity tests pass.
- Deep profile passes with 2,048 fuzz runs and 1,024 invariant runs at depth 64.
- v1 and v2 Slither finding sets match reviewed baselines.
- Dependency audit reports no known vulnerabilities.
- Hackathon backend release gate passes. The extra seven-day Sepolia observation is scheduled,
  not blocking.

| Test suite | Count |
|---|---:|
| `test/solidity/QeltrunPayoutFirewall.attack.t.sol` | 19 |
| `test/solidity/QeltrunPayoutFirewall.invariant.t.sol` | 11 |
| `test/solidity/QeltrunPayoutFirewall.t.sol` | 8 |
| `test/solidity/QeltrunPayoutFirewallV2.governance.t.sol` | 6 |
| `test/solidity/QeltrunPayoutFirewallV2.t.sol` | 11 |
| `test/solidity/QeltrunSafePayoutModule.t.sol` | 7 |
| `test/solidity/RequestIdParity.t.sol` | 2 |
| `test/*.test.ts` | 36 |

Read the [contracts reference](https://qeltrun.vercel.app/docs/contracts) and
[confidential model](https://qeltrun.vercel.app/docs/confidential-model) in the docs portal for
the security model and transaction matrix.

## Run locally

Requires Node.js 22 or later and pnpm.

```bash
git clone https://github.com/Mystiquemide/qeltrun.git
cd qeltrun
corepack enable && pnpm install
pnpm run verify
pnpm run demo
```

Deployment secrets use placeholders only. See [`.env.example`](.env.example). Never commit a
funded private key.

Built for the iExec WTF Hackathon Summer Edition. [MIT licensed](LICENSE).

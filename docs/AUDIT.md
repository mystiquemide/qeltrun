# Security review

Qeltrun is an unaudited hackathon project deployed on Ethereum Sepolia. This document records
the repository's internal security review and explains the Slither findings accepted by CI. It
is not a third-party audit and must not be used as evidence that the contracts are safe for
production funds.

## Scope

The automated review covers:

- `contracts/QeltrunPayoutFirewall.sol`, the legacy single-approver firewall.
- `contracts/QeltrunPayoutFirewallV2.sol`, the current three-reviewer firewall.
- `contracts/integrations/QeltrunSafePayoutModule.sol`, the Safe payout adapter.

CI compares current Slither output with `slither-baseline.json` and
`slither-v2-baseline.json`. A new finding or a removed finding fails the build and requires a
fresh review. Baselines acknowledge specific findings; they do not suppress them or certify the
rest of the system.

## Accepted v1 findings

Slither reports three variants of the same potential reentrancy path in
`QeltrunPayoutFirewall.sealApproval`:

| Detector | Assessment | Reason for acceptance |
|---|---|---|
| `reentrancy-benign` | False positive under the current implementation | The function is protected by OpenZeppelin `nonReentrant`. The Nox protocol call occurs inside that guard, so a callback cannot enter another protected approval or settlement path. |
| `reentrancy-no-eth` | False positive under the current implementation | The firewall neither receives nor transfers ETH in this path. State changes after the Nox call remain inside the same `nonReentrant` critical section. |
| `reentrancy-events` | False positive under the current implementation | Event ordering follows the completed state transition. A callback cannot re-enter the protected function and create a second valid transition. |

The v1 contract remains in the repository for reproducibility. The live application uses v2.

## Accepted v2 findings

### `submitPrivateSignal` reentrancy findings

Slither reports two `reentrancy-no-eth` findings and one `reentrancy-benign` finding around the
Nox calls in `submitPrivateSignal`.

The function is protected by OpenZeppelin `nonReentrant`. It marks the reviewer as submitted
before calling Nox, rejects reused handles, and updates the request inside the same guarded
execution. A callback cannot submit a second signal, settle a request, or execute a payout
through this path. The function transfers no ETH or tokens.

This assessment depends on the deployed bytecode retaining the `nonReentrant` modifier. Any
change that removes the guard, introduces an unguarded state-mutating callback path, or moves
effects after an untrusted external call requires a new review rather than a baseline update.

### Recovery timestamp

Slither reports that `executeApproverRecovery` compares `block.timestamp` with `executeAfter`.

The timestamp is intentionally used for a seven-day governance delay. Normal validator timestamp
variation is tiny compared with that delay and cannot bypass candidate acceptance or the current
approver's veto. This would need reconsideration if the delay were shortened to a period close to
expected timestamp variation.

## Controls verified in tests

The Solidity suites cover:

- forged, expired, wrong-owner, and wrong-application Nox proofs;
- replayed handles and duplicate reviewer submissions;
- stale payout-wallet and reviewer-epoch settlement;
- out-of-range encrypted signals;
- unauthorized Safe module calls and disabled-module execution;
- native and ERC-20 payout failure while paused;
- two-party approver rotation;
- delayed recovery, early execution rejection, and veto;
- request-id parity between Solidity and TypeScript; and
- stateful invariants and fuzzed request lifecycles.

The local harness uses the `NoxCompute` bytecode supplied by
`@iexec-nox/nox-protocol-contracts`. Its local gateway uses a test signing key, while the live
Sepolia path depends on the iExec gateway and TEE trust model.

## Trust boundaries and residual risk

- Qeltrun trusts the Nox gateway signing key, protocol contracts, and TEE confidentiality model.
- Reviewer wallets express approval. They do not prove legal vendor identity or control of an
  off-chain account.
- The firewall owner can register vendors, change operational reviewers, pause the system, and
  schedule delayed approver recovery. It cannot directly set a vendor payout wallet.
- The Safe must enable the payout module and govern firewall ownership correctly.
- The current demonstration Safe is a temporary 1-of-1 Sepolia setup with an exposed test key.
- The contracts have not undergone independent review, formal verification, or production use.

## Commands

```bash
pnpm run audit:deps
pnpm run audit:slither:ci
pnpm run audit:slither:v2
pnpm run test:sol:deep
```

Only update a Slither baseline after reviewing every changed finding and updating this document
with the assessment.

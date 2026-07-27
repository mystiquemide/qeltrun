# iExec Nox feedback

Qeltrun uses iExec Nox to keep three reviewer decisions and their aggregate private while making
only the final approval verdict publicly decryptable. The integration uses
`@iexec-nox/handle`, `@iexec-nox/nox-confidential-contracts`, and
`@iexec-nox/nox-protocol-contracts`.

## What worked well

- The encrypted types map cleanly to Solidity types. Qeltrun uses private `uint16` reviewer
  signals, a private running total, and a public `bool` verdict.
- Application and owner binding make encrypted handles useful as authorization inputs. A handle
  minted for another contract or reviewer is rejected instead of being accepted as generic
  encrypted data.
- The proof format can be exercised locally with genuine `NoxCompute` bytecode. This made it
  possible to test invalid signatures, expired proofs, wrong owners, wrong applications, replayed
  handles, and the complete three-reviewer lifecycle.
- Public decryptability is explicit. Qeltrun can keep the individual signals and aggregate sealed
  while exposing only the decision needed by the transparent payout contract.
- Nox composes with existing Ethereum infrastructure. The confidential decision layer sits in
  front of an unmodified Safe rather than replacing treasury custody.

## What could improve

- Local development requires more setup than a standard Hardhat project. A maintained local
  gateway package, fixture, or one-command development network would make end-to-end testing much
  faster.
- The relationship between the handle bytes, encrypted type marker, chain binding, application
  binding, owner binding, gateway signature, ACL, and expiry is spread across several packages.
  One protocol-level reference page covering the complete proof lifecycle would reduce integration
  mistakes.
- Error messages and troubleshooting guidance could be more specific. Failures caused by an
  incorrect owner, application, chain, expired proof, or missing decrypt permission should be easy
  to distinguish during development.
- More complete production examples would help. A sample that covers several private inputs,
  private aggregation, selective decryption, replay protection, and a downstream protocol action
  would be more useful than a minimal encrypted counter.
- Package versions across the Nox contracts, confidential helpers, and handle utilities should be
  documented as a tested compatibility set.

## What we would keep

The strongest part of Nox is that private computation can authorize a normal public-chain action
without exposing the inputs. That is the core of Qeltrun: reviewers keep their individual
decisions private, while the Safe receives a public and enforceable answer about where it may pay.

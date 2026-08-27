# Contributing to Baraza Protocol

Anyone can contribute, whether we know you or not. The fastest way to help is to
implement the module interface for a chain you know.

## Open to contributors, closed to forkers

You are welcome to read the contracts, build on them, and open pull requests.
The license (see LICENSE) restricts using the code to run a competing service.
Forking to contribute is normal and encouraged; forking to compete is not
permitted. Contributors sign the CLA (see CLA.md) so their work can be merged
into the canonical project.

## Add a chain

1. Read `interface/SPEC.md` and the Stellar reference in `contracts/stellar`.
2. Read `interface/behavior-tests/README.md` for the required adapter checks.
3. Read `docs/adding-a-chain.md` for the contribution workflow.
4. Open an issue proposing the chain, to align scope and avoid duplicate work.
5. Branch: `chain/<name>`, for example `chain/celo`.
6. Implement the modules through the shared interface, native to your chain.
7. Pass the behavior tests in `interface/behavior-tests`.
8. Open a PR describing what works, what does not yet, and chain tradeoffs
   (fees, finality, wallet UX, fiat rails).

## Non-negotiable principles

Non-custodial. Never touch payments. The community holds any license. No loans
by default. An adapter that custodies funds or moves payments will not be merged.

## Two ways contribution happens

Unsolicited PRs from anyone, and funded work where a grant or partner sponsors a
priority chain. Both are welcome and follow the same process.

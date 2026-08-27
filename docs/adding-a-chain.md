# Adding a chain

Baraza is multichain by design. Each chain is an adapter implementing
`interface/SPEC.md`, not a rewrite of the product.

1. Read `interface/SPEC.md` and the Stellar reference (`contracts/stellar`).
2. Open an issue proposing the chain.
3. Branch `chain/<name>`.
4. Create `contracts/<name>/` and implement every operation in the spec, native
   to the chain's contract model and account/auth system.
5. Match the behavior tests in `interface/behavior-tests`. An adapter is done when
   it passes them all and behaves identically to the reference.
6. Open a PR. Document fees, finality, wallet UX, and fiat rails for the chain.

Good first chains: Celo, Base, Aptos. Sign the CLA so your work can be merged.

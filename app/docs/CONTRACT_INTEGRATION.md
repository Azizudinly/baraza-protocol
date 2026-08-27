# Baraza - Contract Integration Checklist

**Status:** Preview mode. Contract source is present for Solana and EVM; frontend write flows remain guarded until deployed addresses, IDLs, ABIs, and transaction builders are wired end-to-end.
**Programs:** `community_registry`, `membership`, `payment_attestation`, `governance`, `treasury_vault`
**Chains:** Stellar (reference), Solana, EVM (Ethereum, Base, Arbitrum, Polygon, Optimism)
**Ref:** See `CROSS_CHAIN_DEPLOYMENT_CHECKLIST.md` before any testnet or mainnet rollout.

## Latest Local Verification

- [x] Solana workspace builds with `cargo check` from repo root.
- [x] Solana Rust unit tests pass with `cargo test`.
- [x] Anchor CLI `0.30.1` is installed locally.
- [x] `cargo-build-sbf` is installed locally.
- [x] `anchor build` passes and generates SBF/IDL artifacts.
- [x] `anchor test --skip-local-validator --skip-build` deploys all five programs to a running local validator and passes the executable-program smoke test.
- [x] Local instruction-level path passes: create community, initialize payment/governance config, create tier, register member, attest/consume payment, activate member, create/activate proposal, cast vote, initialize treasury vault, deposit SOL, and record SPL deposit.
- [x] Local negative checks assert expected program errors for unauthorized payment attestations, mismatched attestation activation, inactive-member proposal creation, invalid proposal transitions, double voting, treasury release while withdrawals are disabled, treasury release from an unauthorized executor, and treasury release without an executed proposal.
- [x] Cross-program validation drift guards compare hard-coded program IDs, account discriminators, and mirrored account layouts against the source programs before the Anchor smoke flow runs.
- [x] Drift-only smoke mode passes without a validator: `npm run test:contracts:drift` from `app/`.
- [x] EVM contracts are cloned into `contracts/evm` and rebranded to Baraza.
- [x] EVM `forge build` passes.
- [x] EVM `forge test` passes: 209 passed, 0 failed.
- [x] Frontend env templates include all five Solana program IDs.
- [x] Frontend contract artifacts are present: all five Solana IDLs/types under `src/lib/programs/idl` and curated EVM ABIs under `src/lib/evm`.
- [x] Frontend read client instantiates all five Solana programs and exposes PDA/account readers for community, membership, payment attestation, governance, and treasury vault accounts.
- [x] Frontend persists local-to-chain mappings for Solana community and proposal accounts when on-chain writes succeed.
- [x] Frontend read/mapping unit tests cover local-to-chain mapping persistence and mapped treasury/proposal reads.
- [x] CI runs `npm run test:contracts:drift` so cross-program validation drift fails PRs without requiring a validator.

Notes:

- `cargo check` and `cargo test` emit Anchor/Rust cfg warnings from macro expansion, but finish successfully.
- `cargo install --locked anchor-cli --version 0.30.1` fails on old `time 0.3.29` with this Rust toolchain; the unlocked install produced a working `anchor-cli 0.30.1`.
- Anchor IDL generation is currently handled through a local patched `anchor-syn 0.30.1` under `third_party/anchor-syn-0.30.1`.
- Full local Anchor deploy/test currently requires a shell with `solana-test-validator` on `PATH`; the Windows shell used on 2026-05-22 has Anchor CLI but not the Solana CLI/test validator. Previous expanded negative-path verification ran through WSL Ubuntu 24.04 on a clean temporary validator at `http://127.0.0.1:8896`.
- `Anchor.toml` uses `node tests/anchor-smoke.mjs` as the post-deploy integration smoke test and only configures `[programs.localnet]` until devnet deployment is complete.
- From `app/`, `npm run test:contracts:smoke` runs the full localnet smoke flow and expects all five programs deployed/executable at the `[programs.localnet]` IDs.
- When Solana CLI is unavailable, run `npm run test:contracts:drift` from `app/` to validate cross-program IDs/discriminators/layout mirrors without contacting a validator. Direct usage is also available with `node tests/anchor-smoke.mjs --drift-only`, and automation may set `ANCHOR_SMOKE_DRIFT_ONLY=1`.
- The smoke test reuses an existing `payment_config` PDA only when the authority and trusted attester match the current payer; otherwise it fails with an explicit config mismatch.
- `membership` validates payment attestation accounts by owner, discriminator, and deserialization instead of importing the `payment_attestation` crate directly.
- `governance` validates membership accounts by owner, discriminator, and deserialization instead of importing the `membership` crate directly.
- `forge build` emits lint warnings for timestamp comparisons and unsafe casts, but compiles successfully.
- `npm run typecheck`, `npm run build`, and focused frontend tests for contract mapping/read wiring pass. Vite still emits existing wallet/dependency polyfill and chunk-size warnings.
- `useBarazaContract.ts` now reads treasury PDA balances and proposal vote tallies when given resolvable on-chain addresses; local community/proposal IDs resolve through `src/lib/chainMappings.ts` when mappings exist.
- EVM fork tests no-op locally unless `ETH_RPC_MAINNET` is set.

## Stage 0 - Repo Structure

- [x] Solana: confirm all five Anchor programs build cleanly with `cargo check` from repo root
- [ ] Stellar: add Soroban contract source or generated bindings to repo
- [x] EVM: Solidity contracts and Foundry artifacts are present in `contracts/evm`
- [x] Create `/contracts` directory with subdirs: `solana/`, `stellar/`, `evm/`
- [x] Add `.env.local.example` with required keys and no real secrets committed

## Stage 1 - Solana Deployment

- [x] Install Anchor CLI on the local machine
- [x] Install `cargo-build-sbf`
- [x] Resolve Anchor `0.30.1` IDL build compatibility with current `proc-macro2`
- [x] Run `anchor build` successfully for all five programs
- [x] Start/configure a local validator for Anchor deploy verification
- [x] Run local Anchor deploy smoke test for all five programs
- [x] Add instruction-level happy path test for community, payment attestation, membership activation, proposal creation, and voting
- [x] Add treasury-vault instruction-level integration tests for initialization, SOL deposits, SPL deposit audit recording, withdrawal toggle, and SOL release
- [x] Add negative-path Anchor integration tests for double voting and disabled treasury withdrawals
- [x] Add remaining negative-path Anchor integration tests for bad signers, mismatched attestation, inactive members, and invalid proposal transitions
- [x] Add smoke-test drift guards for manual cross-program validation constants and mirrored account layouts
- [x] Add drift-only smoke mode for validator-free cross-program validation checks
- [x] Add contract drift check to CI
- [x] Remove undeployed devnet program IDs from `Anchor.toml`; keep devnet IDs unset until real deploy
- [ ] Deploy `community_registry` to devnet; record program ID
- [ ] Deploy `membership` to devnet; record program ID
- [ ] Deploy `payment_attestation` to devnet; record program ID
- [ ] Deploy `governance` to devnet; record program ID
- [ ] Deploy `treasury_vault` to devnet; record program ID
- [ ] Call `payment_attestation.initialize_config`; set config PDA and trusted attester signer
- [x] Copy generated IDLs/types to `src/lib/programs/idl/`
- [x] Add env variables for all five program IDs
- [ ] Set deployed program IDs in `.env.local`
- [ ] HIGH RISK: Transfer program upgrade authority to Squads multisig after deploy

## Stage 2 - Stellar Deployment

- [ ] Add Soroban contract source or generated bindings to `contracts/stellar`
- [ ] Deploy Soroban contracts to Futurenet / testnet; record contract IDs
- [ ] Validate contract size is within Soroban limit
- [ ] Fund contract account with XLM for base reserves
- [ ] Record contract IDs in `.env.local`
- [ ] Add `src/lib/stellar.ts` client module for settlement, refunds, and payouts
- [ ] HIGH RISK: Confirm bridge (LayerZero / Wormhole) Stellar support before enabling cross-chain flows
- [ ] HIGH RISK: Confirm oracle strategy for Stellar (Pyth / DIA; Chainlink not available)

## Stage 3 - EVM Deployment

- [x] Add EVM contracts to `contracts/evm`
- [x] Confirm `forge build`
- [x] Confirm `forge test`
- [x] Export curated app-facing EVM ABIs from `src/lib/evm`
- [ ] Deploy governance contracts to each EVM testnet: Sepolia, Base Sepolia, and other supported networks
- [ ] Verify source on each block explorer
- [ ] Record addresses per network in `.env.local`
- [ ] Add `src/lib/evm.ts` client module
- [ ] HIGH RISK: Transfer ownership to Gnosis Safe on each chain immediately after deploy

## Stage 4 - `useBarazaContract.ts`: Remove Preview Guards

Replace mock data one flow at a time. Do not remove a guard until the program is deployed and the IDL is present.

### 4a - Read Flows

- [x] Add typed client readers and PDA helpers for all five Solana programs
- [x] Wire `fetchCommunity` to `community_registry` account read
- [x] Wire `fetchMembership` to `membership` account read (requires persisted chain mapping; member_id_hash is backend-supplied)
- [x] Wire `fetchProposal` to `governance` account read when passed a proposal PDA
- [x] Wire `fetchTreasury` to `treasury_vault` PDA balance read when community key/slug can be resolved
- [x] Persist on-chain community/proposal addresses so page-level local IDs resolve without fallback guesses
- [ ] Persist on-chain member addresses after real membership activation is wired
- [ ] Remove read-path mock data from `src/lib/constants.ts` after each flow is verified

### 4b - Join Flow

- [ ] Derive membership PDA for connected wallet
- [ ] Wire `joinCommunity` instruction via `membership` program
- [ ] Confirm consumed payment attestation is validated on-chain before activation
- [ ] HIGH RISK: Membership asset minting needs real mint CPI path; do not mark complete until minting works
- [ ] Remove preview guard in `useBarazaContract.ts` for join

### 4c - Vote Flow

```ts
const ix = await program.methods
  .castVote(proposalId, support)
  .accounts({ community, proposal, voter: publicKey })
  .instruction();
tx.add(ix);
```

- [ ] Import IDL and instantiate `Program` with `AnchorProvider`
- [ ] Derive `proposal` PDA from `proposalId`
- [ ] Derive `community` PDA from community slug / ID
- [ ] Wire `castVote` instruction as shown above
- [ ] HIGH RISK: Governance activation still uses admin-supplied eligibility snapshot; do not treat as fully decentralized until membership snapshot CPI is implemented
- [ ] Remove preview guard for vote

### 4d - Create Proposal Flow

- [ ] Derive new proposal PDA
- [ ] Wire `createProposal` instruction via `governance` program
- [ ] Validate proposer meets proposal threshold before submitting
- [ ] Remove preview guard for create

### 4e - Payment / Treasury Flow

- [ ] Wire payment attestation submission via `payment_attestation` program
- [ ] Confirm config PDA and trusted attester signer are present before any payment call
- [ ] HIGH RISK: Treasury withdrawals must stay disabled until the governance CPI dispatch is tested on devnet and the release authority is handed to a Squads vault PDA
- [ ] Wire `treasury_vault` withdrawal only after proposal execution validation is confirmed
- [ ] Remove preview guard for payment; withdrawal guard stays until treasury wiring is complete

## Stage 5 - Chain Enablement in `src/lib/chain.ts`

Enable chains one at a time, only after the UI can submit and confirm real transactions.

- [ ] Solana devnet: enable after Stage 4 read flows pass
- [ ] Solana mainnet-beta: enable after full audit and promote gate passed
- [ ] Stellar testnet: enable after `src/lib/stellar.ts` can submit and confirm real transactions
- [ ] Stellar mainnet: enable after audit and bridge/oracle strategy confirmed
- [ ] EVM testnets: enable after `src/lib/evm.ts` can submit and confirm real calls
- [ ] EVM mainnets: enable after audit and Gnosis Safe ownership confirmed on all chains

## Stage 6 - RPC Fallback (`src/lib/rpc.ts`)

- [ ] Confirm fallback order: `VITE_RPC_ENDPOINT` to `clusterApiUrl(VITE_SOLANA_NETWORK)`
- [ ] Add dedicated mainnet fallback endpoints before mainnet launch
- [ ] Test `withRpcFallback` by intentionally killing the primary endpoint
- [ ] Add alerting / logging when fallback is triggered

## Stage 7 - Page-by-page Frontend Verification

Check read, write, and guard removal in that order for each page.

### Home / Landing

- [ ] Community list reads from `community_registry`, not `constants.ts`
- [ ] No write flows on this page

### Community Page

- [ ] Community details read from `community_registry`
- [ ] Member count reads from `membership` program
- [ ] Treasury balance reads from `treasury_vault`
- [ ] Join button wired after Stage 4b is complete
- [ ] Join button disabled and labelled correctly if wallet not connected via `useWalletGuard`

### Proposal List Page

- [ ] Proposals read from `governance` program, not mock data
- [ ] Proposal status derived from on-chain state, not hardcoded

### Proposal Detail Page

- [ ] Proposal detail reads from `governance` PDA
- [ ] Vote counts read from on-chain tally
- [ ] Vote button wired after Stage 4c is complete
- [ ] Vote button gated by `useWalletGuard` and eligibility snapshot check
- [ ] HIGH RISK: Do not show vote button as enabled until eligibility is confirmed on-chain

### Create Proposal Page

- [ ] Form submits via `createProposal` instruction after Stage 4d is complete
- [ ] Proposal threshold validated client-side before allowing submission
- [ ] Success state shows on-chain proposal PDA address

### Treasury Page

- [ ] Balance reads from `treasury_vault`
- [ ] Withdrawal UI hidden until executed-proposal validation is wired
- [ ] Payment attestation flow visible only to eligible members

### Settings / Admin Page

- [ ] Governance parameter display reads from on-chain config
- [ ] HIGH RISK: Any admin write action must go through Squads multisig; no direct EOA admin calls

## Stage 8 - Cross-chain Wiring (LayerZero / Wormhole)

- [ ] Bridge choice finalized per chain pair
- [ ] Trusted remote / peer addresses set on every chain
- [ ] Replay protection confirmed with nonces / domain separators
- [ ] Relayer funded on all chains
- [ ] Cross-chain proposal execution tested end-to-end on testnet
- [ ] HIGH RISK: Stellar bridge support confirmed with LayerZero / Wormhole team before enabling

## Stage 9 - Promote Gate: Testnet to Mainnet

- [ ] All Stage 4-8 checks passed on testnet
- [ ] All five Anchor programs audited; critical / high findings remediated
- [ ] EVM and Stellar contracts audited
- [ ] Bug bounty program live
- [ ] Squads multisig signers tested a real proposal execution on devnet
- [ ] Gnosis Safe signers tested on each EVM testnet
- [ ] Emergency pause tested on all chains
- [ ] Rollback plan documented
- [ ] Monitoring configured: OpenZeppelin Defender / Tenderly for EVM; custom alerts for Solana
- [ ] Incident response runbook updated with all contract addresses

## Deployment Readiness Verdict

**NOT READY**

Blocking items:

1. External audit not started
2. Solana programs not deployed to devnet from this checkout
3. Write flows still behind preview guards
4. Membership mint CPI path not implemented
5. Treasury withdrawal guard not removable until proposal execution validation is wired
6. Stellar oracle and bridge support unconfirmed
7. Squads multisig not yet controlling program upgrade authority

> Product-layer document. Retained in this repo pending the public/private split; only framing corrections are in scope here.

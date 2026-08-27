# Governance Contract Roadmap

This roadmap evaluates what Baraza governance contracts need for communities,
stockvels, SACCOs, co-operatives, and chamas, and turns the work into staged
tasks with an explicit code-review gate at every stage.

## Community Needs

### Chamas and Stockvels

- Member registry with admin-approved joins, suspensions, exits, and re-entry.
- Contribution ledger for recurring dues, penalties, and voluntary top-ups.
- Simple proposal voting for payouts, purchases, emergency support, and rule changes.
- Treasury release controls that require proposal approval and multisig execution.
- Clear dispute/manual-review state for wrong payments, duplicate dues, and member appeals.

### SACCOs

- Stronger member identity and membership-number mapping.
- Share/deposit accounting separate from ordinary membership dues.
- Loan proposal and approval lifecycle with guarantor support.
- Audit trail for approvals, disbursements, repayments, write-offs, and reversals.
- Role separation for member, committee, treasurer, auditor, and admin.

### Co-operatives

- One-member-one-vote defaults, with optional share-weighted voting only when legally appropriate.
- Board/committee election flows and term limits.
- Procurement and supplier-payment proposals.
- Treasury policies that distinguish operating funds, reserves, and project funds.
- Exportable decision history for compliance and annual meetings.

### Community DAOs

- Wallet-linked membership credential plus off-chain recovery path.
- Proposal/vote receipts that can be indexed and shown on dashboards.
- Treasury execution queue with delay, veto/cancel, and emergency pause.
- Cross-chain metadata so the same community can choose Solana, Stellar, Base, Arbitrum, Optimism, or Celo without rewriting governance rules.

## Contract Requirements

- Community registry: create community, update metadata, assign admins, pause community.
- Membership: approve member, revoke/suspend member, bind wallet, emit membership credential event.
- Governance: create proposal, vote, close proposal, queue execution, cancel/veto, mark executed.
- Treasury: deposit receipt, proposal-authorized release, multisig executor check, emergency pause.
- Payments: consume payment attestation once, reject duplicate provider references, support refund/manual review states.
- Roles: admin, treasurer, auditor, member, proposer, executor.
- Safety: replay protection, proposal execution delay, quorum/threshold constraints, pausable write paths, indexed events.

## Chain Strategy

- Solana remains the primary membership credential and governance implementation.
- Stellar is enabled for XLM payment verification and settlement proof.
- Base, Arbitrum, Optimism, and Celo are now selectable review rails for EVM governance rollout planning.
- Ethereum, Polygon, and BNB remain disabled until there is a specific user, liquidity, or compliance reason to support them.

## Task Plan

### Stage 1: Rail Enablement and Metadata

- [x] Enable Base, Arbitrum, Optimism, and Celo in chain metadata.
- [x] Allow those rails in Supabase community chain constraints.
- [x] Add community filters for all enabled rails.
- [x] Update selector tests and chain persistence tests.
- [ ] Code review: verify disabled chains cannot be selected and enabled chains do not imply real contract execution.

### Stage 2: Governance Contract Spec

- [ ] Write Solana instruction spec for registry, membership, proposal, vote, treasury, and payment attestation flows.
- [ ] Write EVM interface spec for the same lifecycle on Base/Arbitrum/Optimism/Celo.
- [ ] Define event schema shared across Solana/EVM indexers.
- [ ] Define role model for chamas, stockvels, SACCOs, and co-operatives.
- [ ] Code review: inspect permissions, replay protection, pausing, duplicate payment handling, and upgrade assumptions.

### Stage 3: Community Registry

- [ ] Add canonical `CommunityRegistry` deployment config per chain.
- [ ] Persist per-chain contract addresses and deployment block/slot.
- [ ] Add read client for EVM community registry.
- [ ] Add tests for address validation and unsupported-chain fallbacks.
- [ ] Code review: verify chain IDs, address formats, and no private keys are exposed client-side.

### Stage 4: Membership and Payments

- [ ] Connect payment orders to member activation on the chosen rail.
- [ ] Add payment attestation consumption tests for duplicate/reused references.
- [ ] Add member status transitions: pending, active, suspended, exited.
- [ ] Add SACCO/member-number optional fields.
- [ ] Code review: verify activation secret checks, wallet binding, RLS, and duplicate prevention.

### Stage 5: Proposal and Voting

- [ ] Implement proposal creation for rule changes, payouts, procurement, and emergency support.
- [ ] Add voting modes: one-member-one-vote, committee approval, and optional weighted voting.
- [ ] Add quorum/threshold validation from community config.
- [ ] Add close/execute lifecycle tests.
- [ ] Code review: verify vote eligibility snapshots, quorum math, double-vote prevention, and proposal expiry.

### Stage 6: Treasury Execution

- [ ] Wire proposal-approved treasury releases.
- [ ] Add multisig/Squads path for Solana and Safe-style executor path for EVM.
- [ ] Add emergency pause and manual review queue.
- [ ] Add refund and failed-execution recovery.
- [ ] Code review: verify treasury authority, executor checks, timelocks, pause authority, and audit event coverage.

### Stage 7: Deployment and Review

- [ ] Deploy testnet/devnet contracts for Solana, Base Sepolia, Arbitrum Sepolia, Optimism Sepolia, and Celo Alfajores.
- [ ] Add Vercel env vars for contract addresses and RPC endpoints.
- [ ] Run end-to-end tests on each enabled rail.
- [ ] Publish reviewer notes with known limitations.
- [ ] Code review: compare deployed bytecode/IDL/ABI to source, verify env vars, and smoke test every rail.

## Review Checklist For Every Stage

- [ ] Threat model updated for the changed surface.
- [ ] Unit tests added or updated.
- [ ] Integration tests added where persistence or chain calls changed.
- [ ] RLS/database migration reviewed.
- [ ] User-facing copy does not overstate production readiness.
- [ ] Build, lint, typecheck, tests, and audit run.
- [ ] Reviewer signs off before deployment.

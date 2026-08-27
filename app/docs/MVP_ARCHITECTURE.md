# Baraza MVP Architecture

Status: MVP build plan
Date: 2026-05-13

## 1. MVP Goal

The MVP proves one complete Baraza loop:

```text
Create community
-> Join with phone and M-Pesa
-> Create or link Solana wallet
-> Reconcile payment
-> Mint membership
-> Show member dashboard
-> Create proposal
-> Vote
-> Show community activity
```

The MVP should not prove the full marketplace. It should prove that a phone-first user can become an on-chain community member and participate in governance without needing to understand wallets first.

## 2. Non-Negotiable Product Rules

- Payment success is not membership success.
- Mobile money is a payment instrument, not a wallet.
- Phone numbers, emails, KYC data, M-Pesa receipts, and support notes stay off-chain.
- A payment order can authorize at most one membership mint.
- Every webhook and mint job must be idempotent.
- User-facing final success requires payment confirmation, mint confirmation, and indexer/read-model confirmation.
- AI, Stellar settlement, cross-chain bridging, bounties, auctions, and growth markets are not MVP dependencies.

## 3. Integration Decisions

MVP:

| Layer | Integration | Purpose |
| --- | --- | --- |
| Chain execution | Stellar (reference) | Membership, governance, vote records, treasury authority through the reference implementation |
| Mobile money | Africa's Talking | Live sandbox M-Pesa checkout and payment webhook for demo; production credentials later |
| Adapter indexing | Chain-specific indexers | Webhooks and event indexing for proposals, votes, transfers, and treasury events |
| Wallet onboarding | Privy or equivalent embedded wallet provider | Create/link the chain account needed by the selected adapter for phone-first users |
| Crypto checkout | Adapter-native wallet checkout | Optional wallet-native membership payment |
| Metadata | IPFS or Arweave | Community profile, membership metadata, proposal content |
| Private state | Postgres or Supabase | Users, payment orders, webhooks, refunds, admin review |

MVP payment surface:

- Primary: M-Pesa through Africa's Talking live sandbox.
- Optional: wallet-native crypto checkout through Solana Pay or Solana Commerce Kit.
- Excluded: x402, credit/debit cards, cross-chain bridge checkout, and broad multi-method payment pickers.

Phase 2:

| Layer | Integration | Purpose |
| --- | --- | --- |
| Settlement | Stellar Anchor Platform / SEP rails | Fiat/stablecoin settlement and on/off-ramp workflows |
| Disbursements | Stellar Disbursement Platform | Bulk payouts, grants, contributors, refunds |
| Cross-chain USDC | Circle CCTP, Allbridge, Mayan, or LI.FI | Solana/Stellar/EVM stablecoin movement |
| Treasury multisig | Squads | Production multisig and program ownership controls |
| Swap routing | Jupiter | SPL-token-to-USDC routing |
| x402 | Pay-per-request APIs, agent services, gated content, or micro-access after membership checkout is stable |
| Card checkout | Credit/debit card membership payment after M-Pesa and wallet checkout are stable |
| AI | AI service plus attestations | Proposal summaries and bounty review support |

## 4. User Identity Model

Canonical user:

```text
user_id
verified_phone_hash
verified_email_hash optional
embedded_wallet_provider_id optional
primary_solana_wallet
linked_solana_wallets
stellar_account optional phase 2
mobile_money_instruments
created_at
updated_at
status
```

Rules:

- `user_id` is the product identity.
- Phone is the default login and payment handle.
- Email is recovery and backup identity.
- Solana wallet owns membership and signs on-chain actions.
- Mobile-money account pays but never signs.
- A user may later export or link a self-custody wallet.

## 5. Payment Order Model

Payment order states:

```text
CREATED
PAYMENT_REQUESTED
PAYMENT_PENDING
PAYMENT_CONFIRMED
MINT_QUEUED
MINT_SUBMITTED
MINT_CONFIRMED
INDEXER_CONFIRMED
RECONCILED
```

Failure and recovery states:

```text
PAYMENT_EXPIRED
PAYMENT_FAILED
AMOUNT_MISMATCH
MINT_FAILED_RETRYABLE
MINT_FAILED_FINAL
REFUND_QUEUED
REFUND_SUBMITTED
REFUND_CONFIRMED
MANUAL_REVIEW
```

Required fields:

```text
order_id
user_id
community_id
membership_tier_id
provider
provider_environment
provider_reference
amount_expected
amount_received
currency
phone_hash
status
expires_at
confirmed_at
mint_signature
refund_id
idempotency_key
created_at
updated_at
```

Phone storage:

- Store encrypted phone number only when the app needs to contact the user or call a provider.
- Store HMAC/peppered lookup hash for dedupe and lookup.
- Do not use an unsalted/plain hash for phone numbers because phone numbers are low-entropy.

Rules:

- `order_id` is generated before calling the payment provider.
- Provider webhooks must map to one internal `order_id`.
- Duplicate provider references must be safe no-ops.
- Duplicate webhooks are stored as payment events, not payment-order states.
- Amount mismatch moves to manual review or refund.
- Successful payment creates a mint job, not active membership.

## 6. Solana Account Model

MVP account families:

```text
CommunityAccount
CommunityConfigAccount
MembershipTierAccount
MemberAccount
PaymentAttestationAccount
ProposalAccount
VoteReceiptAccount
TreasuryVaultAccount
```

MVP programs:

1. `community_registry`
2. `membership`
3. `payment_attestation`
4. `governance`
5. `treasury_vault`

Deferred programs:

- `bounty_escrow`
- `reputation`
- `ai_attestation`
- `growth_score`
- `market`
- Stellar Soroban settlement/refund contracts

PDA strategy:

```text
community: ["community", community_slug_or_id]
membership_tier: ["membership_tier", community, tier_id]
member: ["member", community, member_id]
payment_attestation: ["payment", order_id_hash]
proposal: ["proposal", community, proposal_id]
vote_receipt: ["vote", proposal, voter_wallet]
treasury_vault: ["treasury", community]
```

Payment attestation requirements:

- Stores a hash of the internal order id.
- Stores community, tier, recipient wallet, amount, currency, provider environment, provider/reference hash, attestation signer, expiry, consumed status, and consumed timestamp.
- Can be created only by trusted Baraza payment signer.
- Can be consumed once by membership mint.
- Consumption must be atomic with membership minting.
- Prevents duplicate minting for one payment order.

## 6.1 Membership NFT Model

MVP membership NFTs are access credentials.

Required behavior:

- Mint to the user's primary Solana wallet.
- Link to `MemberAccount`.
- Store tier and status in program state.
- Store public metadata by CID.
- Treat token ownership and `MemberAccount` status together when checking voting/access rights.

Membership statuses:

```text
PENDING
ACTIVE
SUSPENDED
REVOKED
EXPIRED
MIGRATED
```

Transfer policy:

- Default MVP policy is a transferable display asset with member-bound governance rights.
- The app must check `MemberAccount` status and wallet binding before allowing governance actions.
- A transferred token alone must not grant voting rights unless a future community policy explicitly enables transferable membership and updates `MemberAccount`.

Metadata rules:

- Public metadata may include community name, community id, tier, image, join date, and public status.
- Public metadata must not include phone, email, M-Pesa receipt, legal name, KYC data, provider payloads, or admin notes.
- Metadata updates should be append-only or versioned where possible.

Recovery and migration:

- A user can migrate membership from embedded wallet to external wallet after verification.
- Migration requires phone/email verification and either current wallet signature, admin review, or a recovery policy.
- Migration writes an audit event and updates `MemberAccount`.

Tier changes:

- Upgrade requires a new payment order unless admin-comped.
- Downgrade does not automatically refund.
- Tier changes must update voting weight only after reconciliation and indexer confirmation.

Deferred implementation questions:

- Whether Token-2022 transfer hooks or non-transferable credentials are useful after wallet/indexer support is proven.
- Whether compressed NFTs are worth the extra indexer complexity after the first release.

Current implementation decision:

- Use a Metaplex NFT/Core-style asset for MVP membership wallet display.
- Enforce all real access and voting through `MemberAccount`, not token ownership alone.
- Do not use Token-2022 `NonTransferable` for MVP.
- Do not use compressed NFTs for governance membership in MVP because compressed ownership/proof/indexer dependencies add complexity.
- Do not mint payment receipts or vote receipts as NFTs.

Credential authority model:

```text
CommunityAccount
-> MembershipTierAccount
-> PaymentAttestationAccount
-> Membership mint authority PDA
-> MemberAccount
-> Membership credential mint/token account
```

Authority requirements:

- Mint authority is a PDA or controlled service signer.
- Metadata update authority is a PDA, multisig, or documented admin authority.
- Freeze/burn/revoke authority is documented before mainnet.
- Community collection or issuer verification is required before public launch.
- Treasury or founder wallets must not be able to mint arbitrary memberships outside the program policy.

Membership fields to add:

```text
member_id
community_id
user_id
wallet_address
membership_mint
membership_token_account
tier_id
status
voting_weight
joined_at
activated_at
expires_at optional
revoked_at optional
migrated_from optional
migrated_to optional
payment_order_id
metadata_uri
```

`member_id` must be stable across wallet migration. Do not derive the canonical member PDA only from wallet address.

Governance access check:

```text
has_token_or_credential == true
AND member_account.status == ACTIVE
AND member_account.wallet_address == signer
AND proposal_snapshot_allows_vote == true
```

Snapshot rule:

- Snapshot voting weight when a proposal becomes active.
- Tier upgrades, renewals, suspensions, or revocations after the snapshot must follow the proposal's configured voting policy.
- MVP should use a simple rule: only active members at proposal activation can vote.

Proposal fields required for snapshotting:

```text
proposal_id
community_id
creator_member_id
proposal_type
metadata_uri
status
created_at
activation_slot
snapshot_slot
voting_starts_at
voting_ends_at
quorum_threshold
approval_threshold
eligible_member_count
eligible_voting_weight
for_weight
against_weight
abstain_weight
execution_status
```

Expiry and renewal:

- If memberships are time-bound, store `expires_at`.
- Expired memberships cannot vote or create proposals.
- Renewal requires a new payment order and reconciliation.
- Renewal should update the existing `MemberAccount` rather than creating duplicate active memberships.

Spoof prevention:

- The UI must verify the mint/collection/issuer, not just token name or image.
- The program must verify the expected membership mint or tier account.
- Activity feed must mark unverified external assets as not official.

Treasury MVP policy:

- MVP uses a real Solana treasury vault/account for deposits and balance visibility.
- MVP may queue and authorize treasury actions through governance state.
- MVP withdrawals/execution remain disabled until audit, emergency pause, and multisig/Squads or equivalent operational control are in place.
- No unaudited production withdrawals may ship.

## 6.2 Proposal State Machine

`ProposalAccount.status` is one of nine states. Transitions are slot-driven (most) or signer-driven (cancel, veto).

States:

```text
Pending      on-chain, voting_starts_at_slot > current_slot
Active       voting_starts_at_slot <= current_slot < voting_ends_at_slot
Defeated     voting_ends_at_slot reached, quorum NOT met OR for_weight <= against_weight  [terminal]
Succeeded    voting_ends_at_slot reached, quorum met AND for_weight > against_weight
Queued       Succeeded + eta_slot set, awaiting timelock
Executed     eta_slot <= current_slot <= eta_slot + grace_period_slots, action ran        [terminal]
Expired      current_slot > eta_slot + grace_period_slots, never executed                 [terminal]
Canceled     proposer or admin_authority canceled before Queued                           [terminal]
Vetoed       vetoer_authority killed it in any pre-Executed state                         [terminal]
```

Allowed transitions:

```text
Pending      -> Active            slot reached, activate_proposal ix writes snapshot
Pending      -> Canceled          proposer or admin
Active       -> Defeated          slot reached, finalize_proposal ix
Active       -> Succeeded         slot reached, finalize_proposal ix
Active       -> Canceled          admin only (emergency)
Succeeded    -> Queued            queue_proposal ix
Queued       -> Executed          execute_proposal ix, within grace window
Queued       -> Expired           any caller, after grace window
pre-Executed -> Vetoed            vetoer_authority, if set
```

Finalization (`Active -> Defeated/Succeeded`) is permissionless. Any caller can invoke `finalize_proposal` after `voting_ends_at_slot`. This avoids relying on a privileged finalizer.

## 6.3 Governance Defaults

Initial values written to `CommunityConfigAccount` at community creation. Per-community overrides allowed within hard bounds enforced by the program.

Slot math assumes ~0.4s/slot mainnet target (~216,000 slots/day).

| Parameter | Default | Min | Max |
| --- | --- | --- | --- |
| `voting_delay_slots` | 54,000 (6h) | 0 | 432,000 (2d) |
| `voting_period_slots` | 648,000 (3d) | 108,000 (12h) | 6,480,000 (30d) |
| `timelock_delay_slots` | 216,000 (1d) | 0 | 1,512,000 (7d) |
| `grace_period_slots` | 1,512,000 (7d) | 216,000 (1d) | 6,480,000 (30d) |
| `quorum_bps` | 3,300 (33%) | 500 (5%) | 10,000 (100%) |
| `approval_threshold_bps` | 5,001 (>50%) | 5,001 | 10,000 |
| `proposal_threshold_weight` | 1 | 1 | u64::MAX |
| `vetoer_authority` | `None` | — | — |

Bounds enforce:

- Quorum is reachable (`quorum_bps <= 10_000`).
- Approval threshold is strict-majority floor (>50% rounds to 5,001 bps; abstain excluded from the denominator).
- Voting period has a 12h floor so members across timezones can participate.

`vetoer_authority` is opt-in per community and must be burnable (set to `None`) by a successful proposal.

## 6.4 Vote Receipt Schema

PDA seeds: `["vote", proposal_pubkey.as_ref(), voter_member_pubkey.as_ref()]`.

Existence of the account prevents double-voting; cast is atomic with account creation (Anchor `init` constraint).

Fields:

```text
proposal              Pubkey
voter_member          Pubkey  (MemberAccount PDA)
voter_wallet          Pubkey  (signer at cast time, recorded for audit across wallet migration)
support               u8      (0 = Against, 1 = For, 2 = Abstain)
weight                u64     (snapshot weight at proposal.snapshot_slot; not re-read at cast time)
cast_at_slot          u64
reason_uri            Option<String>  (IPFS CID for vote explanation, optional)
bump                  u8
```

Rules:

- Created exactly once per `(proposal, voter_member)`; PDA collision = double-vote attempt = revert.
- `weight` is read from `MemberAccount.voting_weight` at `proposal.snapshot_slot`. Later tier changes do not affect already-cast votes.
- `voter_wallet` records the wallet that signed. If the member later migrates wallets, the receipt still reflects who cast it at the time; this is the auditable record for §12 activity events.

## 7. Webhook Flow

```text
Africa's Talking webhook
-> verify source/signature where available
-> normalize payload
-> hash raw payload
-> find order_id
-> validate amount, currency, provider reference, environment
-> write payment_event
-> transition payment_order
-> enqueue mint_job
-> return provider success after durable write
```

Webhook rules:

- Never trust frontend payment status.
- Never mutate state before durable write.
- Never mint directly inside webhook handler.
- Provider retries must not create duplicate jobs.
- Unknown provider reference goes to manual review.

## 8. Mint Flow

```text
mint_job created
-> create payment attestation transaction
-> submit attestation
-> submit membership mint using attestation
-> mark attestation consumed
-> wait for confirmation
-> wait for Helius/indexer event
-> activate membership in database
-> write activity event
-> notify user
```

Mint retry rules:

- Retry retryable RPC/provider errors with exponential backoff.
- Do not retry after attestation is consumed unless membership state can be verified.
- If payment is confirmed and mint fails permanently, create refund queue item or manual review.

## 9. Refund Flow

MVP refund states:

```text
REFUND_QUEUED
REFUND_APPROVED
REFUND_SUBMITTED
REFUND_CONFIRMED
RECONCILED
```

Refund triggers:

- Payment after expiration
- Wrong amount
- Duplicate payment
- Tier sold out
- Permanent mint failure
- Fraud/compliance rejection

Rules:

- Refunds are explicit ledger actions.
- Refunds require admin approval in MVP unless provider supports safe automatic reversal.
- Refunds after successful mint require separate revocation/suspension policy.
- Refund records must link to original payment order and provider reference.

## 10. Admin And Reconciliation

Admin dashboard must show:

- Payment orders by status
- Duplicate webhooks
- Amount mismatches
- Mint jobs by status
- Failed RPC submissions
- Missing indexer confirmations
- Refund queue
- Manual review queue
- Provider payload hash
- Chain transaction signature
- Activity/audit trail

Admin actions:

- Retry mint job
- Mark provider event duplicate
- Approve refund
- Move to manual review
- Resolve manual review
- Reconcile order after chain proof
- Suspend membership

All admin actions must write audit events.

## 11. Database Tables

MVP tables:

```text
users
identities
wallets
communities
membership_tiers
memberships
payment_orders
payment_events
mint_jobs
refunds
proposals
votes
activity_events
audit_events
admin_reviews
```

Phase 2 tables:

```text
bounties
bounty_submissions
payouts
stellar_accounts
settlement_orders
ai_outputs
reputation_events
growth_scores
```

## 12. Activity Feed

MVP events:

- Community created
- Membership tier created
- Payment requested
- Payment confirmed
- Membership mint submitted
- Membership activated
- Proposal created
- Vote cast
- Proposal finalized
- Treasury action queued
- Refund queued
- Refund confirmed

Each activity event should include:

```text
activity_id
community_id
actor_user_id optional
event_type
entity_type
entity_id
public_summary
private_context optional
chain_signature optional
provider_reference optional
created_at
```

## 13. What Is Mocked For Demo

Allowed demo mocks:

- Africa's Talking webhook simulation is allowed only for local developer tests.
- Embedded wallet provider can be replaced by generated dev wallet in local demo.
- Helius event can be replaced by polling devnet signature status.
- Treasury withdrawals are disabled; vault deposits and balance visibility may be real.

Not allowed to fake:

- Payment order state transitions
- Duplicate webhook protection
- Payment attestation consumption
- Membership active only after mint confirmation
- Proposal/vote state

## 13.1 Current Repo Checkpoint

As of the latest repository review, the `app/` frontend is a prototype over mock data. It passes TypeScript typechecking and production build, with only existing Fast Refresh lint warnings in shared UI modules.

Current implementation realities:

- `app/src/hooks/useBarazaContract.ts` exposes join, create-community, and vote methods, but blocks those writes until Baraza program instructions, persistence, and reconciliation are wired.
- `app/src/pages/CommunityDashboard.tsx` does not activate membership unless `joinCommunity` returns success. The current hook returns failure for unwired writes, so the UI no longer treats no-op transactions as membership activation.
- `app/src/components/DecisionCard.tsx` performs optimistic vote updates. Final vote state must come from durable governance state or indexed chain state.
- `app/src/pages/CreateDecision.tsx` blocks fake proposal success and shows an explicit unwired-flow toast. MVP proposal creation still requires persistence and governance instruction wiring.

Completed prototype guardrails:

- `app/src/pages/CommunityDashboard.tsx` links to the registered proposal creation route: `/dashboard/:id/decisions/create`.
- Community lookup renders a not-found or invalid-community state for unknown IDs.
- New community success stores a created community ID for navigation, but real persistence still needs to return a durable community record.

Required next fixes before calling the app MVP-ready:

1. Replace no-op transaction builders with typed Baraza instructions from generated clients or block the actions behind developer-only simulation.
2. Add persistent community and proposal records before showing final success states.
3. Implement payment order creation and reconciliation before membership activation.
4. Add membership mint confirmation and indexer or polling confirmation before showing "active member".
5. Add durable vote receipts and double-vote prevention before vote tallies are user-facing.
6. Replace prototype created-community IDs with durable database/on-chain records.

## 14. Build Order

1. Database schema
2. Community creation UI and API
3. Phone identity flow
4. Payment order creation
5. Live Africa's Talking sandbox M-Pesa webhook
6. Solana community and membership accounts
7. Payment attestation
8. Membership mint
9. Indexer confirmation or devnet polling
10. Member dashboard
11. Proposal creation
12. Vote casting
13. Activity feed
14. Admin reconciliation dashboard

## 15. Definition Of Done

The MVP is done when:

- A new user can join with phone-first payment flow.
- Demo environment uses live Africa's Talking sandbox webhook; local simulation is allowed only for developer tests.
- A confirmed payment cannot mint twice.
- Membership does not activate until mint confirmation is observed.
- A failed mint creates a retry or refund path.
- A member can create and vote on a proposal.
- The community page shows members, proposals, and activity.
- Admin can see and resolve stuck orders.
- Private identifiers remain off-chain.

> Product-layer document. Retained in this repo pending the public/private split; only framing corrections are in scope here.

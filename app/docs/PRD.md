# Baraza Protocol PRD

Product Requirements Document
Version: 3.1
Status: MVP scope locked, implementation gaps tracked
Primary launch market: Kenya
Expansion markets: Ghana, Nigeria, Uganda, Tanzania, pan-African diaspora

## 1. Executive Summary

Baraza is a community operating system for African groups, businesses, contributors, and backers. It combines community governance, mobile-money access, AI-assisted operations, paid contribution markets, and transparent growth signals.

Long term, Baraza has three product pillars:

1. Community DAO platform
2. Mobile-money membership and treasury rail
3. AI-governed bounty and growth marketplace

The product must work for two very different users:

- Crypto-native users who already have a wallet.
- Phone-first users who only know M-Pesa, mobile money, WhatsApp, email, and SMS.

The core product principle is:

Phone numbers and emails identify people. Mobile money moves fiat. Blockchain wallets own assets and sign transactions. Baraza links them into one user account without confusing them.

## 2. Product Vision

Baraza lets a community launch, admit members, collect funds, vote on decisions, pay contributors, track reputation, and expose growth signals to supporters.

The long-term product is not just a DAO launcher. It is a stack for real-world communities:

- A community can form.
- Members can join with a phone or wallet.
- Membership can be represented by NFTs or attestations.
- Decisions can be proposed and voted on.
- Treasuries can be funded and spent transparently.
- Contributors can complete work and get paid.
- AI can help summarize, score, monitor, and explain.
- Backers can discover communities with real activity.

## 3. Goals

### 3.1 MVP Goals

- Create a community in under 10 minutes.
- Support both wallet-native and phone-first onboarding.
- Let users pay with M-Pesa first and optional wallet-native crypto checkout after the core mobile-money path works.
- Mint membership NFTs after confirmed payment and reconciliation.
- Support weighted governance based on membership tier and rules.
- Provide treasury visibility and proposal-based spending.
- Keep private user, payment, KYC, and support data off public chains.
- Make every externally triggered state transition idempotent and auditable.

### 3.2 Roadmap Goals

- Support bounty creation, submission, AI-assisted review, DAO ratification, and payout.
- Produce public growth and health signals for communities.
- Add Stellar settlement, contributor disbursements, and cross-chain stablecoin movement.
- Add AI summaries, risk notes, and bounty rubric support without making AI a signer or final approver.

## 4. Non-Goals

- Do not put phone numbers, emails, raw M-Pesa receipts, KYC documents, or private admin notes on-chain.
- Do not treat mobile money as a blockchain wallet.
- Do not make AI the final signer for treasury movement or bounty payout.
- Do not activate investment-like growth tokens without legal review.
- Do not mark membership active at payment confirmation alone.
- Do not build irreversible flows without retry, refund, and manual review paths.

## 5. Product Pillars

### 5.0 MVP Scope Lock

The first Baraza release must prove one complete loop:

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

MVP includes:

- Community creation
- Phone-first identity
- Live Africa's Talking sandbox M-Pesa payment order and webhook flow
- Embedded or linked Solana wallet
- Payment reconciliation
- Membership minting
- Member dashboard
- Proposal creation
- Vote casting
- Activity feed
- Admin order review

MVP excludes:

- Growth marketplace
- Investment products
- Community tokens
- Bonding curves
- Cross-chain swaps
- Stellar settlement contracts
- Bounty escrow
- AI bounty scoring
- Mobile app
- Auctions

These exclusions are product sequencing, not permanent rejection.

### 5.0.1 Current Implementation Guardrails

The current repository contains a Vite React prototype with mock community, proposal, member, and treasury data. That prototype is useful for UX validation, but it is not allowed to present placeholder transactions or local UI state as completed MVP behavior.

Prototype behavior must be labeled or gated until the matching backend, payment, and Solana flows exist.

Completed prototype guardrails:

- The dashboard "New Decision" CTA must route to the registered proposal creation route.
- Unknown community IDs must not silently fall back to another community.
- Created communities must navigate to their real created record, not a fixed mock dashboard.

Remaining before demo readiness:

- Community creation must persist to the application database and, when required by the flow, create the Solana community accounts.
- Proposal creation must persist a proposal record and submit or prepare the matching governance instruction.
- Vote casting must create a durable `VoteReceiptAccount` or indexed vote record and prevent double voting.
- Join flow must create a payment order, reconcile payment, mint membership, confirm indexer state, and only then activate membership.
- Placeholder or no-op Solana transactions must be blocked from production/demo flows or shown as developer-only simulations.

Acceptance language in this PRD refers to real durable state, not optimistic React state.

### 5.1 Community DAO Platform

The community platform is the core Baraza experience.

Required capabilities:

- Community creation wizard
- Community profile
- Membership tiers
- Member dashboard
- Proposal creation
- Weighted voting
- Treasury view
- Community activity feed
- Admin configuration
- Invite links and QR codes
- Wallet and phone onboarding

Required proposal types:

- Funding request
- Policy change
- Project launch
- Signal vote
- Treasury action

Roadmap proposal types:

- Bounty approval
- AI parameter update
- Settlement or payout approval
- Growth profile update

### 5.1.1 Membership NFT Policy

MVP membership NFTs are credentials, not collectibles.

Purpose:

- Prove community membership.
- Gate proposal creation, voting, member dashboards, and community access.
- Represent membership tier.
- Anchor public membership state to Solana.

MVP rules:

- Mint one active membership NFT per user per community unless the community explicitly allows multiple seats.
- Membership NFT minting requires a consumed payment attestation or approved admin comp flow.
- Membership NFT metadata must not contain phone numbers, emails, legal names, M-Pesa receipt data, KYC data, or support notes.
- Membership NFTs should use a Metaplex NFT/Core-style asset for MVP wallet visibility.
- Token transfer must not automatically transfer governance, access, or compliance rights.
- Governance and compliance rules must define a separate `MemberAccount` migration or rebinding flow before rights move to another wallet.
- Member status must live in a `MemberAccount` so a membership can be active, suspended, revoked, expired, or migrated without relying only on token ownership.
- Revocation, suspension, refund, and transfer are separate flows.
- Refund after mint requires membership revocation or suspension policy before funds move.
- Tier upgrade should mint a new tier credential or update member tier state only after payment reconciliation.
- Wallet recovery must allow membership migration from an embedded wallet to a user-controlled wallet after phone/email verification plus admin or signature approval.

Metadata:

- Store public metadata by CID.
- Include community name, community id, tier, image, join date, and public status.
- Keep sensitive identity and payment information in the private database only.

Implementation choice:

- MVP decision: use a Metaplex NFT/Core asset for wallet visibility.
- Enforce voting and access through `MemberAccount`, not token ownership alone.
- Do not use Token-2022 `NonTransferable` for MVP.
- Do not use compressed NFTs for MVP membership unless scale or cost makes it necessary.
- Re-evaluate Token-2022 transfer hooks or non-transferable credentials after wallet, indexer, recovery, and compliance flows are proven.
- Do not use marketplaces, royalties, or speculative NFT mechanics for MVP membership.

Asset decision matrix:

| Asset type | Phase | Recommended model | Transfer policy |
| --- | --- | --- | --- |
| Membership credential | MVP | Metaplex NFT/Core asset plus `MemberAccount` gate | Asset can move for display, but governance rights do not move automatically |
| Membership tier | MVP | Program state plus membership credential metadata | Changes require reconciliation |
| Payment receipt | MVP | Private database receipt plus optional public hash attestation | Do not mint as NFT |
| Vote receipt | MVP | `VoteReceiptAccount` | Do not mint as NFT |
| Event ticket | Phase 2 | NFT or compressed NFT | Community-defined |
| Contributor badge | Phase 2 | Non-transferable badge or attestation | Non-transferable |
| Reputation | Phase 2 | Attestation first, NFT only if useful | Non-transferable |
| Community art collectible | Phase 2 | Collectible NFT | Transferable if community wants |

Authority rules:

- Mint authority must be a program PDA or controlled operational signer, not a personal founder wallet.
- Metadata update authority must be controlled by a program, multisig, or documented admin policy.
- Each community should have a verified collection or issuer reference to prevent fake membership assets.
- Burning, revocation, suspension, and migration must be explicit program/admin actions.
- Wallet recovery should burn/reissue or mark the old member record migrated; it should not rely on token transfer.
- If transferable governance is introduced later, governance must define whether voting rights follow the asset, the verified user, or both.

Governance rules:

- Voting eligibility is `MemberAccount.status == ACTIVE` plus the configured membership/tier rule.
- NFT ownership alone is not enough for governance.
- Voting weight must be snapshotted or derived at proposal activation to avoid mid-vote tier/payment changes.
- Revoked, suspended, expired, or migrated memberships cannot create proposals or vote.

Privacy rules:

- Public NFT ownership can reveal that a wallet belongs to a community member.
- The app must not publicly link that wallet to phone, email, M-Pesa, legal name, or KYC.
- User display names should be optional and changeable.
- Communities that need private membership should use private database membership plus minimal on-chain attestation, not public NFT display.

### 5.2 Mobile-Money Membership And Treasury Rail

The payment rail makes Baraza usable by people who do not already use crypto.

Required capabilities:

- M-Pesa membership purchase
- Crypto membership purchase
- Treasury top-up
- Mobile-money refund
- Contributor payout
- Payment order tracking
- Provider webhook handling
- Rate locks
- Reconciliation
- Admin review for stuck payments

Payment success is not the final product state. Payment success only unlocks the next step.

Membership activates only after:

1. Payment is confirmed.
2. Payment order is reconciled.
3. Mint authorization is consumed exactly once.
4. Membership NFT is minted.
5. Indexer confirms the on-chain mint.
6. Membership record is active in the application database.

### 5.3 AI-Governed Bounty And Growth Marketplace

The AI layer helps communities operate, but it does not replace governance.

Required capabilities:

- Proposal summary
- Discussion summary
- Proposal contradiction flags
- Bounty submission scoring
- DAO health reports
- Growth score explanation
- Stalled proposal alerts
- Low participation alerts
- Contributor reputation summaries

DAO members must be able to ratify, override, dispute, or ignore AI recommendations.

## 6. Platform Architecture

Baraza should not force one chain or provider to do everything. Use each platform where it is strongest.

### 6.1 Stellar reference + adapters

Stellar is the reference implementation for settlement and contract behavior, while other chains are supported through adapters that match the same interface.

Reference implementation responsibilities:

- Community registry
- Membership tier configuration
- Membership NFT minting
- Member status
- Proposal creation
- Vote casting
- Vote snapshots
- Treasury record, vault authority, or read model

Adapter roadmap scope:

- Production treasury vault execution
- Crypto bounty escrow
- Escrow release after DAO approval
- Contributor reputation attestations
- Growth score attestations
- Community token logic, if legally approved
- Bonding curve logic, if legally approved

Why adapters matter:

- Low transaction cost
- Fast confirmation
- Strong token primitives
- Good fit for frequent votes, mints, and escrow actions

### 6.2 Stellar

Stellar is the fiat, stablecoin, settlement, and off-ramp layer.

Put on Stellar or Stellar-compatible payment infrastructure:

- Fiat-to-stablecoin settlement
- Stablecoin treasury deposits
- Cross-border contributor payouts
- Mobile-money or bank-linked on/off-ramp settlement
- Refund payouts
- Payment partner or anchor integration
- Quote and exchange workflows

Why Stellar:

- Strong asset and payment model
- Anchor and SEP ecosystem
- Good fit for regulated fiat/stablecoin movement
- Useful for cross-border African payment flows

### 6.3 Celo

Celo is optional but strategically relevant for mobile-first stablecoin payments.

Use Celo for:

- Mobile stablecoin payments
- Local stablecoin experiments
- Low-friction contributor payouts
- Future regional payment expansion

### 6.4 Base Or Other EVM L2

EVM L2 support is optional and should come after the Solana-first product works.

Use EVM L2s for:

- Diaspora investor liquidity
- Wrapped growth tokens
- EVM community import or mirror features
- Liquidity pool integrations
- External DAO ecosystem compatibility

### 6.5 IPFS Or Arweave

Use decentralized storage for public, content-heavy artifacts.

Store:

- Membership metadata
- Public proposal attachments
- Public bounty briefs
- Public AI report artifacts
- Community profile assets
- Public deliverables

### 6.6 Application Database

Use Postgres or Supabase for private and operational state.

Store:

- Users
- Encrypted phone numbers where operationally required
- HMAC/peppered phone lookup hashes
- Email hashes
- Auth sessions
- Payment orders
- Provider receipts
- Webhook logs
- Refund records
- Admin notes
- Support tickets
- Fraud review
- AI prompts
- AI internal traces
- Reconciliation status
- KYC provider references

### 6.7 Final Integration Decisions

MVP integrations:

| Need | Decision | Role |
| --- | --- | --- |
| Core chain | Solana | Membership, governance, treasury authority, public activity state |
| Mobile-money payment | Africa's Talking | M-Pesa checkout, payment webhook, payout/refund support where available |
| Solana indexing | Helius | Mint, transfer, proposal, vote, and treasury event webhooks |
| Phone-first wallet | Privy or equivalent embedded wallet provider | Create or link Solana wallets for users who start with phone/email |
| Crypto payment | Solana Pay or Solana Commerce Kit | Optional wallet-native membership checkout |
| Treasury controls | Real Solana treasury vault with withdrawals disabled until controls are audited | MVP can accept/display deposits and queue authorized actions; no unaudited production withdrawals; Squads becomes the production multisig/admin layer |
| Public metadata | IPFS or Arweave | Community, membership, proposal, and activity artifacts |
| Private operations | Application database | Payment orders, user identifiers, webhook payloads, refunds, support notes |

Phase 2 integrations:

| Need | Decision | Role |
| --- | --- | --- |
| Settlement and off-ramp | Stellar Anchor Platform / SEP rails | Fiat, stablecoin, bank, and mobile-money linked settlement |
| Contributor payouts | Stellar Disbursement Platform | Bulk payouts, grants, bounty rewards, diaspora payments |
| Cross-chain stablecoin movement | Circle CCTP, Allbridge, Mayan, or LI.FI | Solana to Stellar/EVM USDC movement after MVP |
| Solana swaps | Jupiter | Optional SPL-token-to-USDC routing after core payment flow works |
| x402 payment | x402-compatible Solana payment flow | Pay-per-request APIs, agent services, gated content, or micro-access; not membership checkout MVP |
| Card checkout | Payment processor or mobile-money/card partner | Credit/debit card membership checkout after M-Pesa and wallet checkout are stable |
| Advanced treasury | Squads | Multisig, policy controls, program ownership, emergency actions |
| AI assistance | AI service plus on-chain/off-chain attestations | Proposal summaries, rubric checks, risk notes; never final treasury authority |

Decision rules:

- Do not add a cross-chain dependency to MVP.
- Do not make Stellar required for first membership minting.
- Do not make AI a signer, payer, or final approver.
- Do not add x402, credit/debit card checkout, bridge checkout, or a broad payment-method picker to MVP.
- Do not expose payment provider credentials to client code.
- Keep every integration behind a provider adapter so the rail can change without rewriting product logic.
- Treat `app/docs/MVP_ARCHITECTURE.md` as the canonical MVP build specification.

## 7. Identity, Wallet, And Mobile-Money Model

### 7.1 Canonical User Record

Every Baraza user has one canonical `user_id`.

Linked identifiers:

- Verified phone number hash
- Optional verified email hash
- Linked Solana wallet addresses
- Linked Stellar account addresses
- Embedded wallet provider id
- External wallet addresses
- Mobile-money instruments
- KYC provider customer id, if required

Private identifiers must remain off-chain.

### 7.2 Account Options

Option A: External blockchain wallet

- User connects Phantom, Solflare, Backpack, or another supported wallet.
- Best for crypto-native users.
- User signs directly.
- Baraza does not custody assets.

Option B: Phone OTP plus embedded wallet

- User signs in with phone number.
- Baraza creates an embedded wallet.
- Best default for non-crypto users.
- User does not handle seed phrases at onboarding.
- Must support export or migration later.

Option C: Email plus embedded wallet

- User signs in with email OTP or magic link.
- Better recovery than phone-only login.
- Useful for desktop users and business admins.

Option D: Phone plus email plus embedded wallet

- Recommended for higher-value users.
- Phone supports mobile-money UX.
- Email improves recovery.
- Passkey can be added later.

Option E: Custodial wallet

- Baraza or regulated partner controls signing.
- Best for USSD, SMS, or very low-friction accounts.
- Highest compliance and operational burden.
- Must have balance limits, withdrawal rules, and clear terms.

Option F: Server wallet

- Backend-controlled wallet for automation.
- Used for relayers, fee sponsorship, scheduled jobs, AI attestations, and mint workers.
- Must not silently custody user assets unless the user agreed to custody.

Option G: Mobile-money-only account

- User can pay with M-Pesa, Airtel Money, or MTN MoMo.
- Mobile money is a payment instrument, not a signing wallet.
- System must create or link a blockchain wallet before minting membership.

Option H: Stellar anchor or payment account

- User interacts through an anchor or payment partner.
- Useful for deposits, withdrawals, refunds, KYC, and stablecoin settlement.
- Must link back to the same Baraza `user_id`.

### 7.3 Recommended Kenya MVP Identity Flow

Default phone-first flow:

1. User enters phone number.
2. User verifies OTP.
3. User optionally adds email for recovery.
4. Baraza creates embedded Solana wallet.
5. User selects community membership tier.
6. User pays with M-Pesa.
7. Baraza reconciles payment.
8. Membership NFT mints to embedded wallet.
9. User can later link Phantom or Solflare.
10. User can later export or migrate wallet if provider supports it.

Crypto-native flow:

1. User connects Solana wallet.
2. User optionally verifies phone for mobile-money features.
3. User pays with crypto or M-Pesa.
4. Membership NFT mints to connected wallet.

Admin and contributor flow:

1. Require phone and email.
2. Require wallet signature or strong embedded-wallet recovery.
3. Add passkey or MFA before payouts, treasury execution, or admin actions.

### 7.4 Phone And Mobile-Money Rules

- Normalize phone numbers to E.164 format.
- Store encrypted phone numbers only where operationally necessary.
- Store HMAC/peppered phone lookup hashes for lookup and dedupe.
- Do not put phone numbers on-chain.
- One phone number should map to one primary user unless manually reviewed.
- Recycled phone numbers require recovery safeguards.
- SIM-swap risk must be treated as account takeover risk.
- M-Pesa confirmation authorizes a payment order, not direct on-chain action.
- Payment order id must be consumed exactly once.

### 7.5 Recovery Rules

- Phone-only recovery is acceptable for low-value accounts.
- High-value accounts require at least two factors.
- Treasury admins require stronger recovery than ordinary members.
- Phone number change requires wallet signature, email verification, or manual review.
- Custodial accounts need a clear asset export or withdrawal path.

## 8. User Personas

### 8.1 Founder

Wants to launch and manage a community with governance, treasury, membership, and contributor workflows in one place.

### 8.2 Business Owner

Wants to build a customer or staff community without requiring crypto knowledge on day one.

### 8.3 Community Member

Wants simple phone-first access, membership proof, voting rights, and participation history.

### 8.4 Contributor

Wants to find paid work, submit deliverables, build reputation, and receive payouts.

### 8.5 Backer

Wants to discover high-growth communities and support them through transparent metrics and compliant products.

## 9. Key User Flows

### 9.1 Create Community

1. Founder enters name, category, region, description, logo, and invite text.
2. Founder configures membership tiers.
3. Founder configures voting rules.
4. Founder configures treasury signers and permissions.
5. System creates community record.
6. System initializes required Solana accounts.
7. System creates public profile.
8. System creates invite link and QR code.
9. System writes community activity event.

### 9.2 Join With M-Pesa

1. User opens community invite link.
2. User selects membership tier.
3. User verifies phone number.
4. System creates or links wallet.
5. System creates payment order.
6. System locks exchange rate or price.
7. User receives M-Pesa prompt.
8. User confirms payment.
9. Provider sends webhook.
10. System validates webhook.
11. System queues mint.
12. Solana mint transaction is submitted.
13. Indexer confirms mint.
14. Membership becomes active.

### 9.3 Join With Wallet

1. User connects Solana wallet.
2. User selects membership tier.
3. User reviews payment and rights.
4. User signs transaction.
5. Membership NFT is minted.
6. Membership becomes active after confirmation.

### 9.4 Create And Vote On Proposal

1. Eligible member opens proposal form.
2. Member selects proposal type.
3. Member fills structured fields.
4. Optional AI summary preview is generated.
5. Member submits proposal.
6. Members vote.
7. Vote tally updates from indexed chain state.
8. Proposal finalizes.
9. Approved executable proposals move to execution or timelock.

### 9.5 Bounty Flow

Roadmap, not MVP.

1. Community creates bounty brief, deadline, reward, and rubric.
2. Funds are locked in escrow.
3. Contributors submit work.
4. AI scores submissions against published rubric.
5. DAO reviews leaderboard.
6. DAO ratifies winner or overrides AI.
7. Escrow releases funds.
8. Contributor reputation updates.
9. Contributor can keep crypto or request fiat payout.

### 9.6 Growth Market Flow

Roadmap, not MVP.

1. Backer browses communities by growth score, region, category, and activity.
2. Backer opens growth profile.
3. Backer reviews treasury, proposals, bounties, membership growth, and risks.
4. Backer supports the community through approved product.
5. System records support and updates metrics.

## 10. Payment Order State Machine

Payment orders are durable ledger records. Every transition must be idempotent.

Primary path:

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

Rules:

- A payment order has one canonical `order_id`.
- Provider callbacks must include a provider reference or idempotency key.
- Duplicate webhooks are event classifications, not payment-order states.
- Duplicate webhooks must not create duplicate mints or refunds.
- Payment success does not activate membership.
- Failed mint after successful payment retries before refund.
- Final mint failure creates refund or manual review.
- Refund after successful mint is blocked unless a separate revocation flow exists.

Roadmap settlement states:

```text
RATE_LOCKED
CONVERSION_PENDING
CONVERSION_CONFIRMED
SETTLEMENT_PENDING
SETTLEMENT_CONFIRMED
```

## 11. Webhook Requirements

Webhook handler must:

- Verify provider signature.
- Validate order id.
- Validate amount.
- Validate currency.
- Validate provider receipt.
- Reject unknown orders.
- Store raw payload in restricted storage.
- Store normalized event in database.
- Treat duplicate events as safe no-ops.
- Emit reconciliation job.
- Return success only after durable write.

Retry policy:

- Webhook processing is idempotent.
- Mint jobs retry with exponential backoff.
- Stuck orders appear in admin tools.
- Provider retry count is logged.
- Repeated mismatches trigger manual review.

### 11.1 Africa's Talking Integration Requirements

Africa's Talking should be treated as a payment and communications provider, not as Baraza's source of truth.

Authentication:

- Store Africa's Talking username and API key as server-side secrets only.
- Never expose the API key in frontend code, mobile apps, logs, screenshots, or public repositories.
- Use the sandbox username `sandbox` for sandbox testing.
- Use a separate live application username and live API key for production.
- Keep sandbox and production credentials in separate environment variables.
- Rotate the API key immediately if it appears in logs or source control.

Environment separation:

- Sandbox endpoints must be used only for development and automated tests.
- Live endpoints must be enabled only through an explicit production configuration.
- The app must reject mixed configurations, such as sandbox username with live payment endpoint.

Payments endpoints to support:

- Online checkout request
- B2C payout request
- B2B payout request, if needed for merchant or partner settlement

Operational rules:

- Every Africa's Talking request must include an internal `payment_order_id`.
- Every Africa's Talking response must be stored with provider reference, request payload hash, response payload hash, and timestamp.
- Webhook handlers must be idempotent by provider reference and internal order id.
- Africa's Talking confirmation is not enough to activate membership; Baraza must still complete mint submission, mint confirmation, indexer confirmation, and reconciliation.
- Failed or ambiguous provider responses must move the order into retry or manual review, not final failure by default.

## 12. Refund Requirements

Refunds are explicit ledger actions.

Refund triggers:

- User paid after order expiration.
- User paid wrong amount.
- Membership tier sold out before mint.
- Mint failed permanently.
- Compliance review rejected activation.
- Fraud review rejected activation.
- Provider confirms duplicate payment.

Refund path:

```text
REFUND_QUEUED
REFUND_SUBMITTED
REFUND_CONFIRMED
RECONCILED
```

Refund records must include:

- Original order id
- Provider receipt id
- Refund provider reference
- Amount
- Currency
- Reason
- Initiator
- Approval status
- Timestamps

## 13. Solana Program Requirements

Solana is the primary execution layer for Baraza ownership, membership, governance, and treasury authority. Roadmap Solana programs may add bounty escrow, reputation, AI attestations, and public growth signals after the MVP loop works.

Implementation rules:

- Model persistent state as Solana accounts.
- Keep programs stateless; mutable state must live in data accounts passed to instructions.
- Use Program Derived Addresses for deterministic community, membership tier, member, proposal, vote, treasury, bounty, payment attestation, reputation, AI attestation, and growth score accounts.
- Use PDAs as program-controlled authorities for minting, escrow, treasury, and attestation actions.
- Use Cross Program Invocation for SPL token minting, token transfers, associated token account creation, and treasury escrow movement.
- Keep account data compact. Store public long descriptions, images, proposal bodies, bounty briefs, AI summaries, and public evidence bundles as off-chain metadata CIDs. Store private receipts and provider payloads in the application database.
- Use SPL Token or Token-2022 mints for fungible assets where wallet support and compliance requirements allow; use the MVP membership asset decision in Section 5.1 for membership credentials.
- Use associated token accounts for user-owned token balances.
- Treat Solana transactions as atomic. If one instruction in a transaction fails, the whole transaction fails, but fees may still be charged.
- Keep M-Pesa, card, bank, KYC, and support workflows off-chain. Only write minimal payment attestations and reconciliation references on-chain.
- Use confirmed/finalized chain status plus indexer confirmation before user-facing final success.
- Use devnet for MVP testing, then mainnet-beta for production launch.

MVP Solana account families:

- `CommunityAccount`
- `CommunityConfigAccount`
- `MembershipTierAccount`
- `MemberAccount`
- `ProposalAccount`
- `VoteReceiptAccount`
- `TreasuryVaultAccount`
- `PaymentAttestationAccount`

Roadmap Solana account families:

- `BountyAccount`
- `BountySubmissionAccount`
- `ReputationAccount`
- `AiAttestationAccount`
- `GrowthScoreAccount`
- `MarketConfigAccount`

### 13.1 Community Registry Program

Purpose:

- Create and manage community identity.

Responsibilities:

- Community creation
- Community metadata CID
- Founder/admin authority
- Region and category
- Active or suspended status
- Upgrade or migration references

Instructions:

- `create_community`
- `update_community`
- `suspend_community`
- `transfer_admin`

### 13.2 Membership Program

Purpose:

- Manage tiers, member records, and membership NFTs.

Responsibilities:

- Membership tier setup
- Tier price reference
- Supply cap
- Voting weight
- Membership mint
- Membership revocation
- Member status

Instructions:

- `create_membership_tier`
- `update_membership_tier`
- `mint_membership`
- `revoke_membership`
- `set_member_status`

### 13.3 Governance Program

Purpose:

- Manage proposals and votes.

Responsibilities:

- Proposal creation
- Voting period
- Quorum
- Approval threshold
- Weighted voting
- Double-vote prevention
- Finalization
- Execution authorization

Instructions:

- `create_proposal`
- `cast_vote`
- `finalize_proposal`
- `execute_proposal`
- `cancel_proposal`

### 13.4 Treasury Vault Program

Purpose:

- Hold and release community funds.

Responsibilities:

- Treasury PDA or vault
- Deposits
- Proposal-approved withdrawals
- Spend limits
- Multisig or admin controls
- Emergency pause

Instructions:

- `create_treasury`
- `deposit`
- `queue_withdrawal`
- `execute_withdrawal`
- `pause_treasury`
- `unpause_treasury`

### 13.5 Payment Attestation Program

Purpose:

- Link off-chain payment confirmation to on-chain mint authorization.

Responsibilities:

- Store consumed payment order ids.
- Validate trusted payment signer.
- Prevent duplicate minting for one order.
- Authorize membership mint.

Instructions:

- `attest_payment`
- `consume_payment_for_mint`
- `void_payment_attestation`

### 13.6 Bounty Escrow Program

Roadmap, not MVP.

Purpose:

- Lock bounty funds and release after DAO approval.

Responsibilities:

- Create bounty
- Fund escrow
- Attach brief CID
- Register submission references
- Ratify winner
- Release funds
- Refund to treasury if canceled or expired

Instructions:

- `create_bounty`
- `fund_bounty`
- `submit_bounty_work`
- `ratify_winner`
- `release_bounty_escrow`
- `refund_bounty`

### 13.7 Reputation Program

Roadmap, not MVP.

Purpose:

- Store contributor reputation attestations.

Responsibilities:

- Completed bounty count
- Contribution score
- DAO-specific reputation
- Portable contributor profile references
- Dispute or correction events

Instructions:

- `attest_reputation`
- `update_reputation`
- `dispute_reputation`

### 13.8 AI Attestation Program

Roadmap, not MVP.

Purpose:

- Store hashes and provenance for AI outputs.

Responsibilities:

- Proposal summary hash
- Bounty score hash
- Rubric version
- Model version
- Input context hash
- Override or dispute references

Instructions:

- `attest_ai_output`
- `record_ai_override`
- `record_ai_dispute`

### 13.9 Growth Score Program

Roadmap, not MVP.

Purpose:

- Store public community growth metrics.

Responsibilities:

- Member growth score
- Proposal participation score
- Bounty completion score
- Treasury activity score
- Score versioning
- Oracle or admin signer

Instructions:

- `attest_growth_score`
- `update_growth_score`
- `invalidate_growth_score`

### 13.10 Community Token And Market Programs

Roadmap, not MVP. Requires legal review before implementation.

Purpose:

- Support growth market products when legally approved.

Responsibilities:

- Community token mint
- Allocation rules
- Transfer controls
- Bonding curve
- Reserve management
- Protocol fees
- Slippage limits
- Emergency pause

Instructions:

- `initialize_community_token`
- `buy_token`
- `sell_token`
- `pause_market`
- `unpause_market`

## 14. Stellar Settlement Requirements

Stellar or a Stellar-compatible partner should support:

- Deposit quote
- Withdrawal quote
- Customer KYC status
- Payment order creation
- Payment confirmation webhook
- Refund payout
- Stablecoin treasury deposit
- Cross-border payout
- Reconciliation export

Baraza must keep a provider abstraction so payment partners can be replaced without changing product logic.

Optional Soroban contracts:

- Settlement escrow contract
- Refund registry contract
- Cross-border payout contract

## 15. AI Requirements

Roadmap, not MVP.

AI features:

- Proposal summarization
- Discussion summarization
- Proposal contradiction detection
- Weekly community health report
- Bounty scoring
- Growth score explanation
- Risk flagging

AI controls:

- Every score stores rubric version.
- Every recommendation stores model version.
- Input context hash is stored.
- Public AI outputs can be stored by CID.
- DAO can override AI bounty recommendation.
- Contributor can dispute AI score.
- AI cannot directly move treasury funds.

## 16. Growth Market Requirements

Roadmap, not MVP. Growth products must not ship before legal review and real activity data exist.

Growth markets remain in scope but should be phased.

Roadmap phase 1:

- Public growth score
- Community leaderboard
- Growth score explanation
- Backer watchlist

Roadmap phase 2:

- Community support products
- Stablecoin purchase flow
- Backer dashboard
- Legal-reviewed token products

Roadmap phase 3:

- Bonding curves
- Secondary liquidity
- Cross-chain liquidity
- Advanced risk disclosures

## 17. Admin And Operations

Admin tools must support:

- User search
- Community search
- Payment order search
- Webhook event logs
- Mint retry
- Refund queue
- Manual review queue
- Fraud flags
- Community suspension
- Tier supply override
- Provider reconciliation report
- AI dispute review
- Support notes
- Admin audit log

## 18. Security And Compliance

Security requirements:

- Smart contract audits before mainnet.
- Multisig control for upgrade authority.
- Emergency pause for treasury, mint, and market flows.
- Rate limits on payment order creation.
- Webhook signature verification.
- Reconciliation job monitoring.
- Role-based admin permissions.
- Complete audit log for admin actions.
- Test coverage for every state transition.

Compliance requirements:

- KYC/AML handled by payment or escrow partner where possible.
- Securities review before growth token launch.
- Country-by-country payment rail review.
- Clear disclosures for custody, refunds, and token risks.
- Private data remains off-chain.
- Custodial wallet flows require explicit user terms.

### 18.1 Kenya Regulatory Compliance

**SASRA (Sacco Societies Regulatory Authority):**

Applies to all community types with value `sacco`. The compliance module must include:

- Member register (names, ID numbers, share capital)
- Loan book report (outstanding loans, repayment status, defaults)
- Share capital summary
- Annual returns filing support
- Deposit Guarantee Fund hook (SACCO Amendment Bill 2025 — build compliance hook, do not activate until bill passes)

**Cooperative Societies Act (Kenya):**

Applies to community types `cooperative` and `supply_chain`. Compliance path is separate from the SACCO Act:

- Registered society number field on community profile
- Annual general meeting (AGM) vote record
- Audited accounts attachment support

**Kenya VASP Act 2025 (Virtual Asset Service Providers Act):**

- TODO: VASP registration required before BRZA token issuance on mainnet. The Act is live as of 2025. Consult legal counsel before token launch.
- All BRZA issuance, distribution, and treasury operations on Stellar mainnet may require VASP license.
- Do not launch BRZA on mainnet without completing this registration.

### 18.2 Governance Architecture

**Two-track governance (Membranic Governance Spaces pattern):**

*Community track:*

- 1 member 1 vote — egalitarian by design
- All active members in good standing may vote
- Voting options: For / Against / Abstain (Abstain enables participation for USSD-only members who cannot read a long proposal)
- Quorum default: 51% of active members
- Approval default: 66% of votes cast
- Voting period default: 7 days

*Protocol track:*

- BRZA-weighted voting
- Eligible voters: community admins with verified membership and minimum BRZA stake
- Scope: fee parameter changes, reserve policy, Baraza protocol upgrades
- Quorum: 10% of circulating BRZA supply
- Approval: 66% of votes cast
- Voting period: 14 days

**Governance roles (adapted from BAD DAO framework):**

| Role | Voting weight | Can propose | Treasury access |
|---|---|---|---|
| Protocol steward (admin) | BRZA-weighted | Yes | Up to 1% without full vote |
| Community admin | 1 vote (community track) | Yes | Proposal-only |
| Member | 1 vote | Yes (funded proposals require stake) | No |
| Delegate | Accumulated from delegators | Yes | No |
| AI agent (Akili) | Non-voting — advise and flag only | Draft only | No |

**Proposal lifecycle:**

1. Draft — member creates proposal (on-chain or off-chain pre-submission)
2. Discussion — anonymous chat board active (IPFS/Arweave); structured dialogue before vote opens
3. Active — voting period open
4. Succeeded / Defeated / Expired — based on quorum + threshold
5. Queued — timelock period for treasury actions
6. Executed — CPI dispatch to treasury vault
7. Canceled / Vetoed — admin emergency action

**Anonymous proposal chat board:**

- Per-proposal discussion space with randomized display names
- Stored on IPFS or Arweave (not Supabase — censorship resistant)
- Opens when proposal moves to Active; closes when voting ends
- Research finding: proposals without prior structured dialogue are 90% more likely to fail (source: governance research synthesis, 2026-06-08)

**AI governance agent capabilities (Akili):**

- Proposal Analyzer: flag duplicate, overspend, personal benefit, unmeasurable criteria, irreversible actions
- Voting Recommendation: generate rationale based on community treasury health and past proposals
- Treasury Oversight: monitor community treasury balance and flag anomalous movements
- Constraints: Akili never votes, never signs, never holds keys. Advisory only.

## 19. Success Metrics

Acquisition:

- Communities created
- Business communities created
- Members joined
- New wallets created
- External wallets linked

Payments:

- M-Pesa orders started
- M-Pesa orders completed
- Payment success rate
- Mint success rate
- Refund rate
- Average reconciliation time
- Stuck order count

Governance:

- Proposals created
- Votes cast
- Average voter participation
- Proposal completion rate
- Treasury actions executed

Roadmap marketplace:

- Bounties posted
- Submissions received
- Bounties completed
- Payout success rate
- Contributor repeat rate

Roadmap AI:

- Proposal summary usage
- Health report open rate
- DAO agreement with AI scoring
- Dispute rate
- Override rate

Roadmap growth:

- Growth profile views
- Watchlisted communities
- Backer conversion rate
- Growth score correlation with actual activity

## 20. Acceptance Criteria

Launch readiness requires:

- User can create a community end to end.
- User can join with wallet payment.
- User can join with live Africa's Talking sandbox M-Pesa flow in demo.
- Local simulation is allowed only for developer tests; demo readiness requires sandbox credentials, webhook verification, and reconciliation runbook.
- Membership NFT mints after payment confirmation, payment reconciliation, and mint authorization.
- Duplicate webhook cannot mint twice.
- Failed mint after payment retries automatically.
- Permanent mint failure creates refund queue item.
- Admin can resolve a stuck order.
- Member can create proposal.
- Members can vote with correct weight.
- Proposal tally is indexer-confirmed.
- Treasury balance is visible.
- Public community profile shows members, proposals, treasury, and activity.

Phase 2 readiness requires:

- Community can post bounty.
- Contributor can submit bounty work.
- Escrow can release or refund after DAO approval.
- AI can summarize proposals with visible source context.
- AI can score bounty submissions with visible rubric.
- DAO can ratify or override AI recommendation.
- Stellar settlement can process contributor payout or refund.
- Cross-chain stablecoin route is available only after reconciliation and legal review.

## 21. Lessons From Mature DAO Products

Long-running DAO products accumulate most of their work around reliability, indexing, transaction clarity, proposal UX, wallet state, mobile usability, and data migration.

Baraza must budget time for:

- Event indexing and delayed chain-state reconciliation
- Proposal metadata changes over time
- Mobile-first proposal creation and review
- Clear disabled states and error reasons before transaction submission
- Wallet reconnect and wrong-network recovery
- Transaction previews before signing
- Multi-action proposal queues
- Treasury asset filtering and display
- Public activity feeds
- Search, favorites, and discovery preferences
- Accessibility, focus states, responsive layouts, and theme consistency
- Metadata parsing hardening for malformed or older records
- Admin tooling for stuck or partially completed operations
- Test coverage for edge cases, not only happy paths

Reference behavior to preserve:

- Simulate or validate transactions before submission where possible.
- Wait for chain or indexer confirmation before showing final success.
- Store user-facing metadata separately from executable transaction data.
- Make every externally triggered state change idempotent.
- Keep a durable feed of community actions.
- Avoid irreversible user-facing claims until reconciliation completes.

For Baraza, the M-Pesa membership flow must not show "membership active" at payment confirmation. It should show "payment received, activating membership" until mint and indexer confirmation are complete.

## 22. Official Solana References

The Solana implementation plan should stay aligned with the official documentation:

- Solana Documentation: https://solana.com/docs
- Accounts: https://solana.com/docs/core/accounts
- Programs: https://solana.com/docs/core/programs
- Program Derived Addresses: https://solana.com/docs/core/pda
- Transactions: https://solana.com/docs/core/transactions
- Cross Program Invocation: https://solana.com/docs/core/cpi
- Fees: https://solana.com/docs/core/fees
- Tokens on Solana: https://solana.com/docs/tokens
- Quick Installation: https://solana.com/docs/intro/installation
- Quick Start: https://solana.com/docs/intro/quick-start
- Developer Templates: https://solana.com/developers/templates

Key product implications:

- Baraza programs should not hold mutable state inside executable program accounts.
- Every on-chain Baraza object should have a clear account model and deterministic address strategy.
- Token ownership should use Solana token accounts and associated token accounts.
- Membership minting must be protected by payment attestation consumption so one payment cannot mint twice.
- Refund and failed-payment behavior cannot rely only on transaction atomicity because mobile-money payment confirmation happens outside Solana.

SDK and tooling direction:

- Use Rust for on-chain Solana programs.
- Use Anchor for the first production programs unless a specific high-performance path requires lower-level Rust.
- Use `@solana/kit` for new TypeScript client work.
- Use `@solana/client` for low-level client calls when needed.
- Use `@solana/react-hooks` for React wallet and Solana UI integration where it fits the app.
- Treat `@solana/web3.js` as legacy or compatibility-only for dependencies that still require it.
- Prefer generated typed clients from program IDLs over hand-built instruction payloads.
- Use local validators and devnet before mainnet-beta deployment.

Implementation checklist from the official docs:

1. Install and verify Rust, Solana CLI, Anchor CLI, Surfpool, Node.js, and Yarn.
2. Create a dev wallet and fund it only with devnet SOL for development.
3. Build the smallest deployable Solana program before starting Baraza-specific logic.
4. Define account layouts before writing instructions.
5. Define PDA seeds for every deterministic Baraza account.
6. Add account-size and rent calculations before account creation.
7. Add instruction handlers only after account constraints are clear.
8. Use CPI for token minting, token transfers, associated token account creation, and escrow movement.
9. Add transaction simulation and clear preflight errors in the app UI.
10. Confirm transactions and then reconcile through an indexer before final user success.
11. Test against a local validator or Surfpool before devnet.
12. Test on devnet before mainnet-beta.
13. Keep mainnet upgrade authority, admin authority, and emergency pause controls documented.

Devnet funding options:

- Browser faucet: https://faucet.solana.com/
- CLI airdrop: `solana airdrop 2 <WALLET_ADDRESS> --url devnet`
- Local validator: `solana-test-validator`, then `solana airdrop 100 <WALLET_ADDRESS> --url localhost`
- Proof-of-work faucet: `cargo install devnet-pow`, then use `devnet-pow` when the public faucet is rate-limited.

Development rule:

- Do not use mainnet SOL for development or tests.
- Treat public faucet limits as an external dependency and keep local validator tests working without faucet access.

Official template baseline:

- Current Baraza web app: use the `react-vite-anchor` template as the closest reference because the repo already uses React and Vite.
- Program examples: use the Anchor vault template patterns for PDA vaults, generated clients, build scripts, and test layout.
- Type-safe clients: use Codama-generated clients from Anchor IDLs where possible.
- Future Next.js dashboard or admin app: use `nextjs-anchor` as the reference.
- Future mobile app: use the Phantom Embedded React Native starter as the reference for embedded wallet login without a browser extension.
- Auth research: review the Supabase Auth template only for wallet-auth patterns; do not make Supabase a product dependency without a separate architecture decision.

`nextjs-anchor` requirements to copy into any future Baraza dashboard:

- Next.js, React, TypeScript, and Tailwind app structure.
- `@solana/kit` for Solana client work.
- Wallet-standard connection and wallet auto-discovery.
- Cluster switching for localnet, devnet, testnet, and mainnet.
- Wallet balance display and non-mainnet airdrop support.
- Toast notifications with explorer links for transactions.
- Human-readable parsing for common Solana and program errors.
- Generated program client from the Anchor IDL.
- Shared transaction send pipeline with loading, signing, sending, confirmation, and error states.
- Local validator workflow using `solana-test-validator`.
- Local deployment workflow using `solana config set --url localhost`, `anchor build`, `anchor deploy`, and client regeneration.
- LiteSVM tests for program behavior before devnet deployment.

Template commands to preserve for implementation planning:

- `npx -y create-solana-dapp@latest -t solana-foundation/templates/kit/react-vite-anchor`
- `npx -y create-solana-dapp@latest -t solana-foundation/templates/kit/nextjs-anchor`

## 23. Solana Learning References

Non-official implementation playlist:

- Solana Crash Course 2026 by bri: https://www.youtube.com/watch?v=4mKS99k-bMo&list=PLfmLaK4JnnhIzz7d-CKjeMlQ-aI688x9s

Playlist videos:

1. How I'd Learn Solana Development in 2026
2. How to Set Up Your Solana Development Environment
3. Build & Deploy a Solana App in 5 Minutes
4. How to Build an On-Chain Voting Program
5. Solana Escrow Program Tutorial
6. How to Store and Manage Data on a Blockchain

Baraza should use this playlist as a build-sequence guide:

- Start with local Solana and Anchor environment setup.
- Build the smallest deployable Solana program.
- Implement the Governance Program after the voting tutorial concepts.
- Implement the Bounty Escrow Program only after the MVP membership and governance loop works.
- Implement community, proposal, member, payment attestation, and reputation accounts after the data-storage tutorial concepts.
- Keep official Solana docs as the source of truth when tutorial shortcuts conflict with production requirements.

## 24. Hackathon Execution References

Non-official hackathon reference:

- 5 Pro-Tips to Win The Solana Hackathon by Superteam Podcast: https://www.youtube.com/watch?v=SSYKC8RPoRE

Baraza hackathon execution guidance:

- Demo one complete user journey instead of many partial features.
- Make the Kenya phone-first membership flow the hero story.
- Show the Solana transaction path clearly: payment attestation, membership mint, proposal or bounty action, and explorer confirmation.
- Keep the demo resilient with localnet/devnet fallback data.
- Make the problem obvious in the first 30 seconds: communities already organize and collect money, but they lack transparent, programmable trust.
- Show what is live on-chain and what is mocked or pending partner integration.
- Prepare judge-facing proof: deployed program IDs, transaction links, screenshots, architecture diagram, and a short risk/compliance note.
- Avoid pitching a broad marketplace before proving the core loop: join, fund, govern, contribute, pay.
- Treat mobile-money integration as the wedge, not a side feature.
- Keep the final pitch focused on why Baraza can bring real-world African communities onto Solana without requiring users to understand wallets first.

## 25. Repository Tooling

GitHub CLI should be the default terminal tool for GitHub workflows.

Reference:

- GitHub CLI: https://cli.github.com/

Required local checks:

- `gh --version`
- `gh auth status`

Core commands:

- Clone repositories: `gh repo clone <owner>/<repo>`
- Inspect repository metadata: `gh repo view`
- Check pull request status: `gh pr status`
- Check out pull requests locally: `gh pr checkout <number>`
- Create pull requests: `gh pr create`
- Inspect CI checks: `gh pr checks`
- View issues: `gh issue list`

Baraza workflow rules:

- Use `gh` for GitHub operations when possible.
- Keep generated or cloned reference repositories out of production commits unless intentionally vendored.
- Before opening a PR, include PRD/doc changes, program changes, generated clients, and tests in separate, reviewable commits where practical.
- PR descriptions should include the user flow affected, on-chain programs touched, payment states touched, test evidence, and any mocked integrations.

> Product-layer document. Retained in this repo pending the public/private split; only framing corrections are in scope here.

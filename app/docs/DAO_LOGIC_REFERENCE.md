# DAO Logic Reference For Baraza

Date: 2026-05-12
Status: Brand-neutral roadmap/reference logic extraction

This document keeps reusable product, governance, treasury, escrow, activity-feed, and legal logic for Baraza. It is reference material, not the MVP build spec. Use `MVP_ARCHITECTURE.md` as the canonical MVP implementation source.

## Core Product Promise

Baraza should make it possible for a real-world community to:

- Start with a community purpose.
- Create a governed community space.
- Admit members by phone, wallet, or both.
- Collect funds through mobile money or crypto.
- Represent membership on-chain.
- Govern decisions transparently.
- Pay contributors through accountable proposals and bounties.
- Preserve a public activity trail.

## Public App Surface

Baraza should expose these major surfaces:

- Create community
- Explore communities
- Member dashboard
- Treasury view
- Proposal center
- Bounty center
- Membership purchase flow
- Payment status and receipts
- Artwork, logo, or community media preview
- Activity feed
- Legal, privacy, and risk pages
- Developer documentation
- Community support links

## Empty-State Discipline

Every gated or empty surface should explain the next action clearly.

Required empty states:

- Wallet not connected
- Phone not verified
- Email not verified
- Payment pending
- Membership activating
- Mint pending
- No communities yet
- No active proposals
- No active bounties
- No treasury activity
- No refunds
- No reconciliation issues

Each empty state should include:

- Plain-language reason
- Next action
- Whether the issue is user action, provider delay, chain delay, or admin review

## Community Creation Model

Baraza community creation should happen in clear stages:

1. Draft community profile.
2. Configure membership tiers.
3. Configure governance rules.
4. Configure treasury and payout policy.
5. Configure mobile-money and crypto payment policy.
6. Upload public metadata and media.
7. Preview the community.
8. Deploy or activate the on-chain community state.
9. Open membership sales or invitations.

Important rule:

- Founders may configure freely before activation.
- After activation, sensitive changes must go through governance, admin review, or an explicit migration authority.

## Core On-Chain Components

Baraza should model the platform as modular programs/accounts:

- Community registry
- Community configuration
- Membership tiers
- Member records
- Payment attestations
- Treasury vault
- Proposal records
- Vote receipts
- Bounty escrow
- Bounty submissions
- Reputation attestations
- AI attestations
- Growth score attestations

## Membership Funding Logic

Membership purchases should support:

- Mobile-money checkout
- Crypto checkout
- Manual admin comping where permitted
- Bulk membership import
- Membership tier supply caps
- Membership price references
- Payment expiration
- Retry and refund paths

Membership must not become active until:

1. Payment is confirmed.
2. Payment is reconciled against the internal order.
3. Mint authorization is created.
4. Mint transaction is submitted.
5. Mint transaction is confirmed.
6. Indexer or read model confirms membership.
7. Internal membership state is marked active.

## Auction And Competitive Sale Logic

If Baraza later supports auctions or competitive funding rounds, it should include:

- Reserve price or minimum contribution
- Minimum bid increment
- Auction end time
- Extension buffer for late bids
- Highest bidder tracking
- Refund path for displaced bidders
- Settlement path for winner
- Treasury deposit path
- Failed settlement recovery

Mobile-money auctions require extra care:

- Mobile-money payments are not atomic with chain state.
- Failed or displaced bids need explicit refund orders.
- Provider confirmation cannot be treated as final chain settlement.
- Every bid/payment/order must be idempotent.

## Governance Model

Governance should support:

- Proposal threshold
- Quorum threshold
- Voting delay
- Voting period
- Execution delay
- Execution grace period
- Optional early-stage veto or emergency pause
- Delegation where appropriate
- Weighted voting by membership tier, token, reputation, or rule set

Proposal states:

- Draft
- Submitted
- Pending
- Active
- Canceled
- Defeated
- Succeeded
- Queued
- Executable
- Expired
- Executed
- Vetoed
- Failed execution

## Proposal Template

Every treasury-moving proposal should include:

- Title
- Summary
- Context
- Requested action
- Mission alignment
- Budget
- Timeline
- Success metrics
- Update commitment
- Treasury impact
- Recipient details
- Conflicts of interest
- Prior funding history
- Authors
- Tax or reporting responsibility
- Payout rail
- Dispute path
- AI summary
- AI risk notes

## Escrow And Bounty Logic

Bounty and grant escrows should support:

- Recipient or winner
- Safety valve or refund deadline
- Single milestone or multiple milestones
- Deliverable description
- Evidence uploads
- Completion dates
- Funds per milestone
- Reviewer or release authority
- Arbitration or dispute path
- Release transaction
- Refund transaction
- Off-chain payout reconciliation

Important rule:

- Releasing on-chain escrow and completing an off-chain payout are separate events when mobile money, bank, or external settlement rails are involved.

## Activity Feed Logic

Baraza should build a public and personalized activity feed.

Event types:

- Community created
- Community activated
- Member joined
- Payment received
- Payment failed
- Payment refunded
- Membership minted
- Proposal created
- Vote cast
- Proposal queued
- Proposal executed
- Bounty created
- Bounty funded
- Submission received
- AI review posted
- Winner ratified
- Payout submitted
- Payout confirmed
- Reconciliation completed
- Admin review opened
- Admin review resolved

Feed cards should include:

- Community
- Event type
- Short human description
- Timestamp
- Actor where public
- Related proposal, bounty, payment, or membership
- Chain transaction link where applicable
- Provider receipt status where applicable
- Contextual action button

## Dashboard Logic

The member dashboard should include:

- Profile row
- Phone verification status
- Wallet status
- Memberships
- Active proposals
- Pending votes
- Active bounties
- Payment orders
- Refunds
- Treasury actions
- Quick actions

Quick actions:

- Create community
- Join community
- Create proposal
- Vote
- Create bounty
- Submit work
- Check payment status
- Request support

## Rewards And Revenue Logic

Baraza revenue should be explicit and disclosed before payment.

Possible fee surfaces:

- Membership purchase fee
- Bounty payout fee
- Settlement/off-ramp fee
- Community onboarding partner referral fee
- Premium analytics or admin tools

Rules:

- No hidden spread.
- Show protocol fee separately from provider fee.
- Show estimated settlement amount before payment.
- Keep fee changes auditable.

## Bulk Minting And Imports

Bulk membership or reputation operations should support:

- CSV upload
- Manual entry
- Preview
- Validation before submission
- Batch limits
- Duplicate detection
- Invalid phone/email/wallet detection
- Total cost preview
- Confirmation step
- Audit log

Rules:

- Executed mints cannot be silently undone.
- Revocation, suspension, and refund must be separate flows.
- Newly minted membership may not count for governance until the configured activation or delegation rule is satisfied.

## Legal And Risk Logic

Baraza needs clear separation between:

- Hosted interface
- On-chain protocol
- Mobile-money provider
- Settlement provider
- Wallet provider
- DAO/community operator
- Contributor or bounty recipient

Required legal/risk pages:

- Terms of service
- Privacy policy
- Payment and refund policy
- Community operator responsibilities
- Contributor payout responsibilities
- Sanctions and prohibited-use policy
- Third-party provider disclaimer
- No legal or financial advice disclaimer
- Growth market legal review notice

## Developer Platform Logic

Baraza should plan reusable internal packages around:

- Solana program clients
- Payment provider adapters
- Identity linking
- Phone verification
- Membership hooks
- Governance hooks
- Bounty hooks
- Reconciliation jobs
- UI components
- Shared types
- Metadata and file upload utilities
- Analytics events
- Admin operations

## Reference Build Priorities

MVP priorities:

1. Community creation wizard
2. Membership tier configuration
3. Phone-first checkout
4. Payment order state machine
5. Payment attestation and mint reconciliation
6. Member dashboard
7. Proposal template and lifecycle
8. Voting flow
9. Treasury view
10. Public activity feed
11. Admin review and refund dashboard
12. Legal/payment policy pages

Roadmap priorities:

- Bounty escrow flow
- Reputation attestations
- AI proposal and bounty support
- Stellar settlement and disbursements
- Growth profiles

## Do Not Copy Blindly

Baraza should not assume:

- Wallet-only onboarding
- Auction-first membership
- One chain as the only settlement environment
- Crypto-only treasuries
- Bridge-first funding
- Investment-like market features without legal review
- Payment success equals membership success
- On-chain state replaces private operational records

## Baraza-Specific North Star

The winning Baraza loop is:

1. A community creates a governed space.
2. A member joins with phone-first payment.
3. Baraza reconciles payment and mints membership.
4. Members vote on a real proposal.
5. Treasury or bounty funds move only after governance approval.
6. Contributors are paid with a visible audit trail.
7. The community's activity becomes discoverable and trustworthy.

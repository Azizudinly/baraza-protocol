
# Baraza Protocol — Exhaustive Backend Scope of Work (SOW)

**Document Version:** 2.0 (Master Execution Release)  
**Lead System Architect & Backend Engineer:** Simon Wandera  
**Date:** August 25, 2026  
**Governing Documents & Source Hierarchy:**
1. `Baraza-Protocol-HOLY-GRAIL.md` (Rev 2: Developer Brief, Addenda 2–3, Master Doc, Akili Doc)
2. `Baraza-Launch-Direction-Memo-3.pdf` (BuildAfrica DAO Launch Memo, Aug 25, 2026)
3. `Baraza Protocol SAD.md` (Software Architecture Document v1.0, Simon Wandera)
4. `Baraza-Protocol-Master-Architecture-Compendium.md`
5. `BACKEND_CODE_MAP.md` (Repository Structural Ledger)

---

## Table of Contents
1. [Governance Tagging & Alignment Methodology](#1-governance-tagging--alignment-methodology)
2. [Section A: Smart Contracts & On-Chain Settlement Subsystem](#section-a-smart-contracts--on-chain-settlement-subsystem)
3. [Section B: Zero-Trust Payment Ingress, Partner Rails & Fee Engine](#section-b-zero-trust-payment-ingress-partner-rails--fee-engine)
4. [Section C: Double-Entry Ledger & Financial Accounting Model](#section-c-double-entry-ledger--financial-accounting-model)
5. [Section D: SASRA & Regulatory Compliance Subsystem (Class G)](#section-d-sasra--regulatory-compliance-subsystem-class-g)
6. [Section E: Conversational Bot Engine & WhatsApp Gateway (ADR-007)](#section-e-conversational-bot-engine--whatsapp-gateway-adr-007)
7. [Section F: Background Reconciliation & Durable Crons (ADR-004)](#section-f-background-reconciliation--durable-crons-adr-004)
8. [Section G: Standard Production SaaS & Quality-of-Life Endpoints](#section-g-standard-production-saas--quality-of-life-endpoints)
9. [Section H: System Architect Strategic Proposals for Scale & Resilience](#section-h-system-architect-strategic-proposals-for-scale--resilience)
10. [Master Traceability, Gap Analysis & Execution Timeline](#10-master-traceability-gap-analysis--execution-timeline)

---

## 1. Governance Tagging & Alignment Methodology

Every task and subsystem in this document is rigorously evaluated against the governing architecture and classified:
- **`[SAD-ALIGNED]`**: Explicitly mandated by the Software Architecture Document (SAD v1.0), Holy Grail Document (HGD Rev 2), or Launch Direction Memo 3. The citation, section number, governing invariant, or ADR is explicitly stated.
- **`[PROPOSED]`**: An essential engineering addition or standard production SaaS requirement not explicitly mentioned in legacy briefs. A detailed engineering justification is provided for why it is mandatory for production.

---

## Section A: Smart Contracts & On-Chain Settlement Subsystem

### A.1 Soroban Rust Contract Suite — Mainnet Migration & Auditing
- **Classification:** `[SAD-ALIGNED]` (SAD §1.1, ADR-002, Launch Memo 3 §2, Roadmap M8)
- **Current Completion:** **90%** (All 5 contracts written, compiled to WASM, and covered with 100% snapshot unit tests).
- **Why it Aligns:** Stellar Soroban is the sole canonical launch chain (ADR-002). Canonical truth lives on-chain; PostgreSQL is only a read cache (ADR-003).
- **Target Files (from Code Map):** `contracts/stellar/{community_registry, membership, governance, treasury_vault, payment_attestation}/src/lib.rs`
- **Pending Scope of Work:**
  1. Compile all contracts with `cargo build --target wasm32-unknown-unknown --release` against Soroban SDK v20+.
  2. Optimize WASM binary size using `soroban contract optimize` to minimize ledger footprint.
  3. Deploy to Stellar Mainnet and update `contracts/stellar/addresses/mainnet.json` and `app/src/lib/programs/stellarAddresses.ts`.
  4. Perform testnet-to-mainnet drift smoke tests via `npm run test:contracts:drift`.

### A.2 Multi-Sig Payment Attestation Service Writer Authorization
- **Classification:** `[SAD-ALIGNED]` (SAD §5.4, ADR-009, Red Team Finding #2)
- **Current Completion:** **70%** (`payment_attestation` contract requires admin authorization; single-signer server client written in `stellar-mint.ts`).
- **Why it Aligns:** Prevents a single compromised Vercel server key from forging on-chain fiat payment receipts.
- **Target Files (from Code Map):** `contracts/stellar/payment_attestation/src/lib.rs`, `app/api/cron/_lib/stellar-mint.ts`
- **Pending Scope of Work:**
  1. Upgrade `PaymentAttestationContract` to store an authorized signers list `Vec<Address>` and require 2 distinct cryptographic signatures for `attest()`.
  2. Refactor `app/api/cron/_lib/stellar-mint.ts` to coordinate dual-signing across two independent key custody sources.

### A.3 Base EVM / Aragon OSx Adapter Isolation
- **Classification:** `[SAD-ALIGNED]` (SAD §2, ADR-001, Roadmap M7)
- **Current Completion:** **75%** (`Manager.sol`, `Gov.sol`, and `Token.sol` deployed at well-known addresses; `evmClient.ts` has JSON-RPC read methods).
- **Why it Aligns:** Tier 4 corporate DAOs utilize Base EVM. Must remain strictly isolated from Stellar communities (ADR-001 single-chain rule).
- **Target Files (from Code Map):** `contracts/evm/src/manager/Manager.sol`, `app/src/lib/programs/evmClient.ts`
- **Pending Scope of Work:**
  1. Add wallet write capabilities (`createDao()`, `castVote()`) to `evmClient.ts` using `viem` / `ethers`.

---

## Section B: Zero-Trust Payment Ingress, Partner Rails & Fee Engine

### B.1 Dynamic Activation Pricing & Calculation Engine
- **Classification:** `[SAD-ALIGNED]` (Launch Memo 3 §4, Holy Grail §14)
- **Current Completion:** **40%** (Currently hardcoded to 500 KES in UI and API intent generators).
- **Why it Aligns:** Launch Memo 3 states: *"Account activation is a flexible, configurable, currently one-time fee. Don't hardcode a figure — the fee logic should be built so it can change without a rewrite."*
- **Target Files (from Code Map):** `app/api/stellar/create-payment-intent.ts`, `supabase/migrations/`
- **Pending Scope of Work:**
  1. Create migration `024_communities_dynamic_activation_fee.sql` adding `activation_fee_minor BIGINT DEFAULT 0` and `fee_type TEXT DEFAULT 'one_time'`.
  2. Refactor `create-payment-intent.ts` to query `communities.activation_fee_minor` and compute:
     $$\text{TotalExpected} = \text{ActivationFee} + \text{PlatformFee}(2.0\%) + \text{ProviderFee}(0.5\% \text{ capped at 200 KES})$$
  3. Validate that zero-fee / free communities bypass payment gates gracefully.

### B.2 Partner-Licensed Mobile Money Rails (Kotani Pay & Minisend)
- **Classification:** `[SAD-ALIGNED]` (Launch Memo 3 §3, Addendum 2, HGD §13)
- **Current Completion:** **60%** (`payments/kotani.ts` and `payments/minisend.ts` proxy routes created; live checkout call sites need wiring).
- **Why it Aligns:** Launch Memo 3 explicitly mandates: *"We're not applying for our own Daraja production account for launch. Payments route through providers who already hold the licences — Kotani, Minisend, Qardi and others."*
- **Target Files (from Code Map):** `app/api/payments/kotani.ts`, `app/api/payments/minisend.ts`, `app/api/webhooks/kotani.ts`
- **Pending Scope of Work:**
  1. Implement live STK Push trigger in `payments/kotani.ts` calling `/v1/onramp/stellar`.
  2. Connect `webhooks/kotani.ts` to verify `KOTANI_WEBHOOK_SECRET` signature, match order by reference, and transition status to `ATTESTATION_SUBMITTED`.
  3. Implement Minisend off-ramp caller in `payments/minisend.ts` for automated treasury payouts.

### B.3 Dual-Layer Webhook Ingress Security
- **Classification:** `[SAD-ALIGNED]` (SAD §5.2, Invariant I3a, Red Team Finding #1)
- **Current Completion:** **100%** (Implemented in `status-result.ts` with `hasPathSecret` and CIDR bitwise allowlist `196.201.214.0/24`).
- **Why it Aligns:** Guarantees zero-trust ingress from untrusted mobile money carrier networks.

---

## Section C: Double-Entry Ledger & Financial Accounting Model

### C.1 Mathematical Conservation & Ledger Invariants
- **Classification:** `[SAD-ALIGNED]` (SAD §3.5 Class A, Invariants I1/I2)
- **Current Completion:** **50%** (Database schema designed in SAD; runtime insertion trigger pending).
- **Why it Aligns:** Guarantees mathematical conservation across all transactions:
  $$\sum \text{Debit} \equiv \sum \text{Credit}$$
- **Target Files (from Code Map):** `supabase/migrations/002_payment_orders.sql`, `app/api/membership/activate.ts`
- **Pending Scope of Work:**
  1. Create database migration `025_double_entry_ledger.sql` with table `ledger_entries (id, order_id, account_id, debit_amount, credit_amount, currency, created_at)`.
  2. Create atomic stored procedure `record_double_entry_split()` to record member contribution credit, treasury vault debit, and 2% platform fee allocation in a single ACID transaction.

---

## Section D: SASRA & Regulatory Compliance Subsystem (Class G)

### D.1 SASRA SACCO License Verification Gate
- **Classification:** `[SAD-ALIGNED]` (Launch Memo 3 §6, SAD §3.6 Class G, HGD §9a, ADR-006)
- **Current Completion:** **20%** (Principle documented; endpoints and database constraints pending).
- **Why it Aligns:** Launch Memo 3 states: *"Baraza doesn't obtain a SASRA licence. A SACCO-type community obtains its own and provides proof before that community type activates."*
- **Target Files (from Code Map):** `app/api/compliance/sacco-license.ts`, `supabase/migrations/`
- **Pending Scope of Work:**
  1. **Database Migration:** Add `sacco_license_status` (`UNLICENSED`, `PENDING_REVIEW`, `VERIFIED`, `REJECTED`), `sacco_license_number`, and `sacco_cert_url` to `communities`.
  2. **New Endpoint:** `POST /api/compliance/sacco-license-submit` (receives license details and certificate document URL).
  3. **New Endpoint:** `POST /api/compliance/sacco-license-verify` (Admin-authenticated review transition).
  4. **Feature Gate Enforcement:** Intercept loan and capital mobilization API routes to throw `403 Forbidden` unless `sacco_license_status === 'VERIFIED'`.

### D.2 Behavioral Deposit Monitoring & Threshold Alerts
- **Classification:** `[SAD-ALIGNED]` (SAD §3.6 Class G, Red Team Finding #4)
- **Current Completion:** **10%** (SQL query drafted in architecture docs).
- **Why it Aligns:** SASRA Non-Deposit-Taking Regulations 2020 trigger oversight when digital deposits cross KES 100M.
- **Pending Scope of Work:**
  1. Create daily background query in `app/api/cron/monitor-compliance.ts` flagging groups exceeding KES 100M.

### D.3 ODPC Personal Data Inventory for BAD DAO AFRICA LIMITED
- **Classification:** `[SAD-ALIGNED]` (Launch Memo 3 §5, SAD §3.6, Kenya DPA 2019 §18)
- **Current Completion:** **90%** (Code hashes phone numbers with `PAYMENT_PHONE_HASH_PEPPER`; filing inventory document pending).
- **Pending Scope of Work:**
  1. Complete formal personal data filing statement for `BAD DAO AFRICA LIMITED` covering HMAC phone hashes, Privy MPC wallet metadata, and session tokens.

---

## Section E: Conversational Bot Engine & WhatsApp Gateway (ADR-007)

### E.1 Natural Language Sheng, Swahili & English Slot Parser
- **Classification:** `[SAD-ALIGNED]` (SAD §7.3, ADR-007, HGD §17)
- **Current Completion:** **70%** (Pure `processTurn()` FSM engine written; conversational dictionary needs Sheng slot expansion).
- **Why it Aligns:** Members access Baraza via WhatsApp without Web3 jargon.
- **Target Files (from Code Map):** `app/src/lib/bot/fsm.ts`, `evolution-api/src/webhook.ts`
- **Pending Scope of Work:**
  1. Add Sheng slang affirmative tokens (`"rada"`, `"ni poa"`, `"wazi"`, `"chapa"`, `"soo tano"`) to `fsm.ts`.
  2. Wire fallback ladder: Turn 1–2 (Clarification) $\to$ Turn 3 (Stateless LLM Rephrase) $\to$ Turn 4 (Human Admin Alert).

---

## Section F: Background Reconciliation & Durable Crons (ADR-004)

### F.1 Durable Vercel Cron Reconciler & Backoff Scheduler
- **Classification:** `[SAD-ALIGNED]` (SAD §5.3, ADR-004, Invariant I2)
- **Current Completion:** **75%** (`promote-orders.ts` processes happy path; backoff escalation needs retry counter).
- **Why it Aligns:** Eliminates brittle synchronous wait loops; reconciles dropped network callbacks reliably.
- **Target Files (from Code Map):** `app/api/cron/promote-orders.ts`
- **Pending Scope of Work:**
  1. Add exponential backoff retry intervals ($30\text{s} \to 2\text{m} \to 8\text{m} \to 32\text{m} \to \text{hourly}$) up to 24 hours.
  2. Implement automatic status transition to `REFUND_REQUESTED` if unverified after 24 hours.

---

## Section G: Standard Production SaaS & Quality-of-Life Endpoints

### G.1 Member Profile, Preferences & Identity Continuity
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Essential for production SaaS account management, allowing members to manage profiles, language preferences (English/Swahili/Sheng), and notification routing without exposing raw on-chain data. Replaces scattered localStorage stubs in `Profile.tsx` and `phoneAuth.ts`.
- **Target Files (from Code Map):** `app/api/user/profile.ts`, `app/api/user/memberships.ts`, `supabase/migrations/`
- **Pending Scope of Work:**
  1. `GET /api/user/profile` — Fetch current user profile, linked wallets, verified phone status, and notification preferences.
  2. `PATCH /api/user/profile` — Update display name, avatar URL, bio, preferred locale (`en` | `sw` | `sheng`), country (`KE`, `UG`, `TZ`, `RW`), and default currency.
  3. `GET /api/user/memberships` — Return all active community memberships, officer roles, dues status, and voting power for the authenticated user.
  4. `POST /api/user/avatar-upload` — Generate presigned upload URL for member avatars in Supabase Storage (`avatars` bucket).

### G.2 Push Notifications & Multi-Channel Messaging Subscriptions
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Community governance, voting deadlines, and dues collection rely heavily on timely member nudges. Members in emerging markets switch between Web Push, SMS, and WhatsApp based on connectivity.
- **Target Files (from Code Map):** `app/api/user/notifications/`, `app/src/lib/notifications/`
- **Pending Scope of Work:**
  1. `POST /api/user/notifications/push-subscribe` — Register Web Push / FCM browser push subscription tokens for real-time mobile and desktop alerts.
  2. `GET/PATCH /api/user/notifications/preferences` — Granular channel toggle matrix (`sms`, `whatsapp`, `push`, `email`) for:
     - New proposal created in joined community
     - Voting deadline reminder (24h before proposal closes)
     - Dues cycle payment reminder (3 days before monthly due date)
     - Dues payment confirmation & on-chain receipt notification
     - Treasury multisig payout signature requests for elected officers
  3. `POST /api/notifications/dispatch` — Internal queue worker delivering scheduled alerts via Africa's Talking SMS, Evolution WhatsApp API, and Web Push.

### G.3 Community Workspace Features (Roadmaps, Suggestions & Bounties)
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Replaces frontend `localStorage` mock implementations in `CommunityRoadmap.tsx`, `CommunitySuggestions.tsx`, and `BountyBoard.tsx` with durable, multi-user database persistence.
- **Target Files (from Code Map):** `app/api/communities/[id]/`, `supabase/migrations/`
- **Pending Scope of Work:**
  1. `GET/POST /api/communities/[id]/roadmap` — List and create community roadmap milestones (`title`, `description`, `target_date`, `status`, `funding_goal_kes`).
  2. `PATCH/DELETE /api/communities/[id]/roadmap/[milestoneId]` — Update or delete milestone (Admin/Officer only).
  3. `GET/POST /api/communities/[id]/suggestions` — Member suggestion box for bottom-up community proposals and feedback.
  4. `POST /api/communities/[id]/suggestions/[suggestionId]/vote` — Upvote/downvote suggestions.
  5. `GET/POST /api/communities/[id]/bounties` — Community task and micro-bounty board management.
  6. `POST /api/bounties/[id]/apply` & `POST /api/bounties/[id]/submit` — Member application and work submission for community bounties.

### G.4 Community Management, Invitations & Access Control
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Group founders and admins need tools to manage membership rosters, track invite links, and assign leadership roles.
- **Target Files (from Code Map):** `app/api/communities/[id]/`
- **Pending Scope of Work:**
  1. `GET/PATCH /api/communities/[id]/settings` — Update community metadata (description, logo, rules, privacy mode: `public` vs `private_invite_only`).
  2. `POST /api/communities/[id]/invites` — Generate trackable member referral/invite link with expiration and max uses.
  3. `GET /api/communities/[id]/members` — Search and filter member roster (by `active`, `overdue_dues`, `role`), with pagination and CSV export.
  4. `POST /api/communities/[id]/officers` — Assign and revoke group officer roles (Chairperson, Treasurer, Secretary).

### G.5 Accounting Statements, Tax Receipts & Financial Exports
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Group treasurers, SACCO committee members, and auditors require downloadable accounting statements for local tax and statutory record-keeping.
- **Pending Scope of Work:**
  1. `GET /api/communities/[id]/statement` — Export community double-entry ledger entries to CSV or PDF for custom date ranges.
  2. `GET /api/user/receipt/[orderId]` — Generate downloadable PDF payment receipt for member dues contributions.

### G.6 Disputes, Refund Requests & Audit Logs
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Provides operational resolution paths for payment mismatches (`payment_orders.status = 'MANUAL_REVIEW'`) and immutable regulatory audit trails.
- **Pending Scope of Work:**
  1. `POST /api/payment-orders/[id]/dispute` — Member submits dispute reason / proof for stalled or mismatched payments.
  2. `GET /api/communities/[id]/audit-log` — Tamper-evident, append-only audit trail of officer and admin actions (mandated for SASRA/ODPC compliance).
  3. `POST /api/support/ticket` — Submit support ticket with automated Akili AI diagnostics and human escalation.

### G.7 Health, Readiness & Observability Endpoints
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Mandatory for production uptime monitoring (Better Uptime, Datadog, Vercel synthetic checks) and zero-downtime deployments.
- **Pending Scope of Work:**
  1. `GET /api/health/live` — Lightweight liveness probe returning HTTP 200 `{ status: "ok" }`.
  2. `GET /api/health/ready` — Deep readiness probe validating database connectivity, Horizon RPC responsiveness, and partner payment gateway health.
  3. `GET /api/health/metrics` — Metrics probe returning queue depth, attestation latency, and error counts.

### G.8 Token-Bucket Rate Limiting & Abuse Prevention Middleware
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Protects paid third-party APIs (Privy, Anthropic, Africa's Talking) and serverless compute from abuse.
- **Pending Scope of Work:**
  1. Implement Upstash Redis / Vercel KV token-bucket rate limiting on `/api/stellar/create-payment-intent`, `/api/agent/chat`, and `/api/identity/*`.

---

## Section H: System Architect Strategic Proposals for Scale & Resilience

### H.1 Automated Soroban Contract Event Indexer (Decoupled Worker)
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Prevents cache drift between Supabase and Stellar if an HTTP connection drops during contract invocation (ADR-003).
- **Proposal:** Deploy a lightweight background worker consuming Stellar RPC ingestion streams to automatically sync contract events into Supabase asynchronously.

### H.2 Intelligent Multi-Provider Payment Fallback Router
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Mitigates carrier downtime by automatically routing payments:
  $$\text{Primary: Kotani Pay} \xrightarrow{\text{Failover}} \text{Minisend} \xrightarrow{\text{Failover}} \text{Direct Daraja} \xrightarrow{\text{Fallback}} \text{Crypto Deposit}$$

### H.3 Hardware-Backed Key Management (Cloud KMS)
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Enhances Tier 3 custody security by replacing environment variable private keys with AWS KMS / GCP Cloud KMS HSM-backed signing.

---

## 10. Master Traceability, Gap Analysis & Execution Timeline

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   MASTER SCOPE OF WORK EXECUTION PHASES                                │
├─────────┬──────────────────────────────────────────┬────────────────┬───────────────┬──────────────────┤
│ Phase   │ Feature / Subsystem                      │ Classification │ Current State │ Target Timeline  │
├─────────┼──────────────────────────────────────────┼────────────────┼───────────────┼──────────────────┤
│ **P1**  │ Dynamic Fee Engine + Kotani/Minisend     │ `[SAD-ALIGNED]`│ 40% Complete  │ Sprint 1 (Days 1-5)│
│ **P2**  │ SASRA Sacco License Verification Gate    │ `[SAD-ALIGNED]`│ 20% Complete  │ Sprint 1 (Days 3-7)│
│ **P3**  │ Soroban Mainnet Deploy + 2-of-N Attest   │ `[SAD-ALIGNED]`│ 90% Complete  │ Sprint 2 (Days 8-12│
│ **P4**  │ Double-Entry Ledger + Cron Reconciler    │ `[SAD-ALIGNED]`│ 60% Complete  │ Sprint 2 (Days 10-14│
│ **P5**  │ Core SaaS: Profile, Push, Settings       │ `[PROPOSED]`   │ 30% Complete  │ Sprint 3 (Days 15-18│
│ **P6**  │ Workspace: Roadmap, Suggestions, Bounties│ `[PROPOSED]`   │ 20% Complete  │ Sprint 3 (Days 17-20│
│ **P7**  │ Health, Observability, Rate Limiting     │ `[PROPOSED]`   │ 25% Complete  │ Sprint 4 (Days 20-22│
│ **P8**  │ Event Indexer + KMS HSM Key Custody      │ `[PROPOSED]`   │ 10% Complete  │ Sprint 4 (Days 22-25│
└─────────┴──────────────────────────────────────────┴────────────────┴───────────────┴──────────────────┘
```

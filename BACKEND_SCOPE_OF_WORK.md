# Baraza Protocol — Exhaustive Backend Scope of Work (SOW)

**Document Version:** 2.0 (Master Execution Release)  
**Lead System Architect & Backend Engineer:** Simon Wandera  
**Date:** August 25, 2026  
**Governing Documents:**
- `Baraza-Protocol-HOLY-GRAIL.md` (Rev 2: Developer Brief, Addenda 2–3, Master Doc, Akili Doc)
- `Baraza-Launch-Direction-Memo-3.pdf` (BuildAfrica DAO Launch Memo, Aug 25, 2026)
- `Baraza Protocol SAD.md` (Software Architecture Document v1.0, Simon Wandera)
- `Baraza-Protocol-Master-Architecture-Compendium.md`

---

## Table of Contents
1. [Scope Classification & Alignment Methodology](#1-scope-classification--alignment-methodology)
2. [Section A: Smart Contracts & On-Chain Settlement (Soroban & EVM)](#section-a-smart-contracts--on-chain-settlement-soroban--evm)
3. [Section B: Payment Pipeline, Partner Rails & Fee Engine](#section-b-payment-pipeline-partner-rails--fee-engine)
4. [Section C: SASRA & Regulatory Compliance Gates (Class G)](#section-c-sasra--regulatory-compliance-gates-class-g)
5. [Section D: Conversational Gateway & Bot FSM (ADR-007)](#section-d-conversational-gateway--bot-fsm-adr-007)
6. [Section E: Background Reconciliation & Durable Crons (ADR-004)](#section-e-background-reconciliation--durable-crons-adr-004)
7. [Section F: Standard Production SaaS & Quality-of-Life Endpoints](#section-f-standard-production-saas--quality-of-life-endpoints)
8. [Section G: System Architect Proposals for Protocol Resilience & Scale](#section-g-system-architect-proposals-for-protocol-resilience--scale)
9. [Traceability & Execution Priority Matrix](#9-traceability--execution-priority-matrix)

---

## 1. Scope Classification & Alignment Methodology

Every task in this document is classified under a strict governance tag:
- **`[SAD-ALIGNED]`**: Explicitly mandated by the Software Architecture Document (SAD v1.0), Holy Grail Document, or Launch Direction Memo 3. The citation, section, and governing invariant/ADR are stated.
- **`[PROPOSED]`**: An essential engineering addition or SaaS quality-of-life requirement not explicitly stated in historical docs. A detailed engineering rationale is provided for why it is necessary.

---

## Section A: Smart Contracts & On-Chain Settlement (Soroban & EVM)

### A.1 Soroban Contract Audit & Mainnet Migration
- **Classification:** `[SAD-ALIGNED]` (SAD §1.1, ADR-002, Launch Memo 3 §2, Roadmap M8)
- **Why it Aligns:** Stellar Soroban is the sole canonical launch chain. Canonical truth lives on-chain; PostgreSQL is only a read cache (ADR-003).
- **Deliverables:**
  1. Audit and compile all 5 Soroban Rust contracts (`community_registry`, `membership`, `governance`, `treasury_vault`, `payment_attestation`) against Soroban SDK v20+.
  2. Implement `treasury_vault.init()` threshold validator ensuring $1 \le M \le N$ signers (ADR-005).
  3. Deploy contracts to Stellar Mainnet and update `contracts/stellar/addresses/mainnet.json`.

### A.2 Multi-Sig Payment Attestation Writer Key Management
- **Classification:** `[SAD-ALIGNED]` (SAD §5.4, ADR-009, Red Team Finding #2)
- **Why it Aligns:** Prevents a single compromised server key from forging on-chain fiat payment receipts.
- **Deliverables:**
  1. Configure `payment_attestation` contract to require 2-of-N authorized service signatures before recording an attestation.
  2. Implement server-side multi-signature transaction builder in `app/api/cron/_lib/stellar-mint.ts`.

### A.3 Base EVM Aragon OSx Adapter Isolation
- **Classification:** `[SAD-ALIGNED]` (SAD §2, ADR-001, Roadmap M7)
- **Why it Aligns:** Tier 4 corporate DAOs utilize Base EVM pre-deployed `Manager.sol` (`0x3ac0e64fe2931f8e082c6bb29283540de9b5371c`). Must remain strictly isolated from Stellar communities (ADR-001 single-chain rule).
- **Deliverables:**
  1. Complete `BaseAdapter.ts` implementation for `createCommunity()` and `castVote()`.

---

## Section B: Payment Pipeline, Partner Rails & Fee Engine

### B.1 Dynamic Activation Pricing & Calculation Engine
- **Classification:** `[SAD-ALIGNED]` (Launch Memo 3 §4, Holy Grail §14)
- **Why it Aligns:** BuildAfrica DAO Memo 3 explicitly mandates: *"Account activation is a flexible, configurable, currently one-time fee. Don't hardcode a figure — the fee logic should be built so it can change without a rewrite."*
- **Deliverables:**
  1. Add `activation_fee_minor` (BIGINT in KES cents) and `fee_type` (`one_time`, `recurring_monthly`, `free`) to `communities` table in database migration 024.
  2. Refactor `api/stellar/create-payment-intent.ts` to read the community's dynamic fee configuration rather than hardcoded 500 KES.
  3. Implement mathematical fee split calculator:
     $$\text{TotalPaid} = \text{ActivationFee} + \text{PlatformFee}(2.0\%) + \text{ProviderCost}(0.5\% \text{ capped at 200 KES})$$

### B.2 Partner-Licensed Mobile Money Rails (Kotani Pay & Minisend)
- **Classification:** `[SAD-ALIGNED]` (Launch Memo 3 §3, Addendum 2, HGD §13)
- **Why it Aligns:** Launch Memo 3 states: *"We're not applying for our own Daraja production account for launch. Payments route through providers who already hold the licences — Kotani, Minisend, Qardi and others."*
- **Deliverables:**
  1. Refactor `app/api/payments/kotani.ts` to implement full STK initiation and webhook signature verification using `KOTANI_WEBHOOK_SECRET`.
  2. Build Minisend off-ramp client in `app/api/payments/minisend.ts` for automated USDC to M-Pesa liquidation.
  3. Ensure partner rail payments trigger the same zero-trust status verification and advance `payment_orders` into `ATTESTATION_SUBMITTED`.

### B.3 Double-Entry Ledger Writes for All Ingress Transactions
- **Classification:** `[SAD-ALIGNED]` (SAD §3.5 Class A, Invariants I1/I2)
- **Why it Aligns:** Guarantees complete mathematical conservation ($\sum \text{Debit} \equiv \sum \text{Credit}$) across member balances, community vaults, and Baraza fee revenue accounts.
- **Deliverables:**
  1. Create database helper `record_double_entry_transaction()` in `app/src/lib/payments/ledger.ts`.
  2. Write debit/credit rows to `ledger_entries` whenever an order transitions to `MEMBERSHIP_ACTIVE`.

---

## Section C: SASRA & Regulatory Compliance Gates (Class G)

### C.1 SASRA Sacco License Verification Gate
- **Classification:** `[SAD-ALIGNED]` (Launch Memo 3 §6, SAD §3.6 Class G, HGD §9a, ADR-006)
- **Why it Aligns:** Launch Memo 3 states: *"Baraza doesn't obtain a SASRA licence. A SACCO-type community obtains its own and provides proof before that community type activates."*
- **Deliverables:**
  1. **New Endpoint:** `POST /api/compliance/sacco-license-submit`
     - Receives statutory license number, issuing authority (SASRA / Ministry of Co-operatives), and document storage URL.
     - Sets `communities.sacco_license_status = 'PENDING_REVIEW'`.
  2. **New Endpoint:** `POST /api/compliance/sacco-license-verify`
     - Authenticated via Admin Role.
     - Transitions status to `'VERIFIED'` or `'REJECTED'`.
  3. **Feature Gate Enforcement:** Gating loan disbursements and capital mobilization endpoints so they throw `403 Forbidden: SACCO license verification required` if `sacco_license_status !== 'VERIFIED'`.

### C.2 Behavioral Deposit Monitoring & Threshold Alerts
- **Classification:** `[SAD-ALIGNED]` (SAD §3.6 Class G, Red Team Finding #4)
- **Why it Aligns:** SASRA Non-Deposit-Taking SACCO Regulations 2020 trigger regulatory oversight when digital capital mobilization exceeds KES 100M.
- **Deliverables:**
  1. Build daily SQL monitoring query flagging communities where $\sum \text{Deposits} \ge \text{KES } 100,000,000$.
  2. Dispatch automated compliance alert to `compliance@barazaprotocol.com`.

### C.3 ODPC Personal Data Inventory & Hashing
- **Classification:** `[SAD-ALIGNED]` (Launch Memo 3 §5, SAD §3.6, Kenya DPA 2019 §18)
- **Why it Aligns:** Required for immediate filing under `BAD DAO AFRICA LIMITED` on `odpc.go.ke`.
- **Deliverables:**
  1. Audit all PII touchpoints; confirm phone numbers are strictly stored as `HMAC-SHA256(phone, PAYMENT_PHONE_HASH_PEPPER)`.
  2. Generate official Personal Data Flow Architecture document for ODPC submission.

---

## Section D: Conversational Gateway & Bot FSM (ADR-007)

### D.1 Multi-Lingual Sheng & Swahili Natural Language Parser
- **Classification:** `[SAD-ALIGNED]` (SAD §7.3, ADR-007, HGD §17)
- **Why it Aligns:** Sovereign WhatsApp and USSD interfaces must support conversational slot-filling in Kenyan English, Swahili, and Sheng without breaking state totality.
- **Deliverables:**
  1. Refactor `app/src/lib/bot/fsm.ts` pure function `processTurn()` to support Sheng affirmative terms (`"rada"`, `"ni poa"`, `"wazi"`) and monetary terms (`"soo tano"`, `"punch"`, `"chapa"`).
  2. Wire fallback ladder: Turn 1–2 (Re-prompt) → Turn 3 (Ask Akili stateless Claude rephrase) → Turn 4 (Human admin escalation).

### D.2 Evolution WhatsApp Gateway UI Proxy Hardening
- **Classification:** `[SAD-ALIGNED]` (SAD §11.1, Compendium §7)
- **Why it Aligns:** Decouples the external WhatsApp Docker container from internal backend services.
- **Deliverables:**
  1. Implement `POST /api/webhooks/whatsapp` authenticated with `DASHBOARD_ADMIN_TOKEN`.
  2. Connect webhook dispatcher to invoke `processTurn()` and issue payment intents.

---

## Section E: Background Reconciliation & Durable Crons (ADR-004)

### E.1 Vercel Scheduled Cron Reconciler
- **Classification:** `[SAD-ALIGNED]` (SAD §5.3, ADR-004, Invariant I2)
- **Why it Aligns:** Replaces fragile synchronous wait loops with exponential backoff reconciliation ($30\text{s} \to 2\text{m} \to 8\text{m} \to 32\text{m} \to \text{hourly}$) up to 24 hours.
- **Deliverables:**
  1. Refactor `app/api/cron/promote-orders.ts` to poll stalled orders in `STATUS_QUERY_SENT` and query the provider status.
  2. Advance successfully verified orders into `ATTESTATION_SUBMITTED` and trigger `stellar-mint.ts`.
  3. Mark orders exceeding 24 hours as `REFUND_REQUESTED`.

---

## Section F: Standard Production SaaS & Quality-of-Life Endpoints

### F.1 Member Profile & Preferences Endpoints
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Required for standard SaaS account management, allowing members to update display preferences, language (English/Swahili), and notification channels (SMS vs WhatsApp) without touching on-chain identity.
- **Deliverables:**
  1. `GET /api/user/profile` — Fetch current user profile, linked wallets, and notification settings.
  2. `PATCH /api/user/profile` — Update display name, avatar URL, preferred locale (`en` | `sw` | `sheng`), and default notification channel.
  3. `GET /api/user/memberships` — Return all active community memberships, roles, dues status, and voting weight for the authenticated user.

### F.2 Export & Financial Reporting Endpoints
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Community group treasurers, SACCO auditors, and individual members require downloadable accounting statements for local tax and statutory record-keeping.
- **Deliverables:**
  1. `GET /api/communities/[id]/statement` — Export community double-entry ledger entries to CSV or PDF for a given date range.
  2. `GET /api/user/tax-receipt/[orderId]` — Generate downloadable PDF payment receipt for member dues contributions.

### F.3 Health, Readiness & Observability Endpoints
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Mandatory for production uptime monitoring (Datadog / Better Uptime / Vercel synthetic checks) and zero-downtime deployments.
- **Deliverables:**
  1. `GET /api/health/live` — Lightweight liveness probe returning HTTP 200 `{ status: "ok" }`.
  2. `GET /api/health/ready` — Deep readiness probe checking connectivity to Supabase PostgreSQL, Stellar Horizon RPC, and partner payment gateways.
  3. `GET /api/health/metrics` — Internal metrics endpoint returning pending order queue depth, attestation latency, and error counts.

### F.4 Rate Limiting & Abuse Prevention Middleware
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Protects serverless functions and paid external APIs (Privy, Anthropic, Africa's Talking) from denial-of-service and credit depletion attacks.
- **Deliverables:**
  1. Implement IP-based and user-based token bucket rate limiting (via Upstash Redis / Vercel Edge KV) on `/api/stellar/create-payment-intent`, `/api/agent/chat`, and `/api/identity/*`.

---

## Section G: System Architect Proposals for Protocol Resilience & Scale

### G.1 Automated Contract Event Indexer (Decoupled Sync Worker)
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Currently, PostgreSQL is updated synchronously when API calls complete. If a transaction succeeds on Stellar but the serverless HTTP connection drops before DB write, PostgreSQL cache drifts from on-chain truth (violating ADR-003).
- **Proposal:** Build a dedicated Stellar Soroban event listener using Stellar RPC ingestion that listens to `community_registry`, `governance`, and `treasury_vault` contract events and updates Supabase asynchronously.

### G.2 Multi-Provider Payment Fallback Router
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Mobile money outages are frequent in East Africa (e.g. Safaricom scheduled maintenance). A payment intent should automatically failover between partner rails.
- **Proposal:** Implement an intelligent payment router in `api/stellar/create-payment-intent` that checks partner gateway health:
  $$\text{Primary: Kotani Pay} \xrightarrow{\text{Failover}} \text{Minisend} \xrightarrow{\text{Failover}} \text{Direct Daraja} \xrightarrow{\text{Fallback}} \text{Crypto Deposit}$$

### G.3 Sovereign Key Management Service (Cloud KMS) Integration
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Currently, 2-of-N attestation writer keys and treasury service credentials rely on environment variables.
- **Proposal:** Migrate Tier 3 custody secrets to AWS KMS / GCP Cloud KMS with hardware-backed HSM signing and strict IAM access logging.

---

## 9. Traceability & Execution Priority Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        BACKEND SCOPE OF WORK EXECUTION PHASES                          │
├─────────┬──────────────────────────────────────────┬────────────────┬──────────────────┤
│ Phase   │ Description                              │ Classification │ Target Timeline  │
├─────────┼──────────────────────────────────────────┼────────────────┼──────────────────┤
│ **P1**  │ Dynamic Fee Engine + Kotani/Minisend     │ `[SAD-ALIGNED]`│ Sprint 1 (Days 1–5)│
│ **P2**  │ SASRA Sacco License Verification Gate    │ `[SAD-ALIGNED]`│ Sprint 1 (Days 3–7)│
│ **P3**  │ Soroban Mainnet Deploy + 2-of-N Attest   │ `[SAD-ALIGNED]`│ Sprint 2 (Days 8–12│
│ **P4**  │ Double-Entry Ledger + Cron Reconciler    │ `[SAD-ALIGNED]`│ Sprint 2 (Days 10-14│
│ **P5**  │ Standard SaaS Endpoints (Profile/Health) │ `[PROPOSED]`   │ Sprint 3 (Days 15-18│
│ **P6**  │ Event Indexer + KMS Custody Hardening    │ `[PROPOSED]`   │ Sprint 3 (Days 18-21│
└─────────┴──────────────────────────────────────────┴────────────────┴──────────────────┘
```

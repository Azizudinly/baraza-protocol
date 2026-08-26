# Baraza Protocol — Master Backend Scope of Work & Implementation Blueprint

**Master Reference, Recursive Research Wall & Complete Execution Roadmap**  
**Document Version:** 3.0 (Unified Master Execution Release)  
**Lead System Architect & Backend Engineer:** Simon Wandera  
**Date:** August 26, 2026  
**Governing Documents & Source Hierarchy:**
1. `Baraza-Launch-Direction-Memo-3.pdf` (BuildAfrica DAO Launch Memo, Aug 25, 2026)
2. `DevOps Request: Live Validation & Infrastructure Requirements for Baraza Protocol.pdf` (August 23, 2026)
3. `Baraza Protocol — Documentation Index (Development Mode).pdf` (Development Index)
4. `Baraza-Protocol-HOLY-GRAIL.md` (Rev 2: Developer Brief, Addenda 2–3, Master Doc, Akili Doc)
5. `Baraza Protocol  SAD.md` (Software Architecture Document v1.0, Simon Wandera)
6. `Baraza-Protocol-Master-Architecture-Compendium.md`
7. `Baraza-Protocol-Phase1-Specification.md` (Main-1 through Main-5)
8. `03-M3-Activation-and-Billing.md` (Milestone 3 Specification)
9. `BACKEND_CODE_MAP.md` (Repository Structural Ledger)

---

## Table of Contents
1. [Master Governance Tagging & Alignment Rules](#1-master-governance-tagging--alignment-rules)
2. [Recursive Research Wall: Verbatim Citations Across All Project Documents & PDFs](#2-recursive-research-wall-verbatim-citations-across-all-project-documents--pdfs)
   - [2.1 Launch Direction & Partner-Licensed Rails (`Baraza-Launch-Direction-Memo-3.pdf`)](#21-launch-direction--partner-licensed-rails-baraza-launch-direction-memo-3pdf)
   - [2.2 Live Validation & DevOps Constraints (`DevOps Request PDF`)](#22-live-validation--devops-constraints-devops-request-pdf)
   - [2.3 Dynamic Activation Pricing & Dues Fee Calculation](#23-dynamic-activation-pricing--dues-fee-calculation)
   - [2.4 Zero-Trust Ingress Security & Invariant I2b](#24-zero-trust-ingress-security--invariant-i2b)
   - [2.5 SASRA SACCO Regulatory Compliance Gates (Class G)](#25-sasra-sacco-regulatory-compliance-gates-class-g)
   - [2.6 Double-Entry Ledger & Financial Accounting Model (Class A)](#26-double-entry-ledger--financial-accounting-model-class-a)
3. [Mathematical Formulations & Economic Invariants](#3-mathematical-formulations--economic-invariants)
4. [Master Scope of Work by Subsystem (Sections A through H)](#4-master-scope-of-work-by-subsystem-sections-a-through-h)
   - [Section A: Smart Contracts & On-Chain Settlement Subsystem](#section-a-smart-contracts--on-chain-settlement-subsystem)
   - [Section B: Zero-Trust Payment Ingress, Partner Rails & Fee Engine](#section-b-zero-trust-payment-ingress-partner-rails--fee-engine)
   - [Section C: Double-Entry Ledger & Financial Accounting Model](#section-c-double-entry-ledger--financial-accounting-model)
   - [Section D: SASRA & Regulatory Compliance Subsystem (Class G)](#section-d-sasra--regulatory-compliance-subsystem-class-g)
   - [Section E: Conversational Bot Engine & WhatsApp Gateway (ADR-007)](#section-e-conversational-bot-engine--whatsapp-gateway-adr-007)
   - [Section F: Background Reconciliation & Durable Crons (ADR-004)](#section-f-background-reconciliation--durable-crons-adr-004)
   - [Section G: Standard Production SaaS & Quality-of-Life Endpoints](#section-g-standard-production-saas--quality-of-life-endpoints)
   - [Section H: System Architect Strategic Proposals for Scale & Resilience](#section-h-system-architect-strategic-proposals-for-scale--resilience)
5. [Step-by-Step Technical Implementation Plan (Phased Sprints P1–P8)](#5-step-by-step-technical-implementation-plan-phased-sprints-p1p8)
6. [Verification Plan & Acceptance Test Scenarios](#6-verification-plan--acceptance-test-scenarios)

---

## 1. Master Governance Tagging & Alignment Rules

Every task and architectural decision in this document is classified against the governing engineering baseline:
- **`[SAD-ALIGNED]`**: Explicitly mandated by the Software Architecture Document (SAD v1.0), Holy Grail Document (HGD Rev 2), or Launch Direction Memo 3. The citation, section number, governing invariant, or ADR is explicitly referenced.
- **`[PROPOSED]`**: An essential engineering addition or standard production SaaS requirement not explicitly mentioned in legacy briefs. A detailed engineering justification is provided for why it is mandatory for production.

---

## 2. Recursive Research Wall: Verbatim Citations Across All Project Documents & PDFs

### 2.1 Launch Direction & Partner-Licensed Rails (`Baraza-Launch-Direction-Memo-3.pdf`)

#### Full Verbatim Citations:
> **Section 2 — What we're launching:**  
> *"A working product: a community can onboard members, take payment to activate an account, activate its treasury, and run proposals. That's the bar for launch."*
> 
> **Section 3 — Payments: partner rails, not our own licence:**  
> *"We're not applying for our own Daraja production account for launch. Payments route through providers who already hold the licences — **Kotani, Minisend, Qardi and others.** Not one provider, several. Crypto deposit stays as a secondary path; traditional rails are the default."*
> 
> **Section 4 — Pricing:**  
> *"Account activation is a flexible, configurable, currently one-time fee. Don't hardcode a figure — the fee logic should be built so it can change without a rewrite."*
> 
> **Section 5 — ODPC:**  
> *"Registration is at odpc.go.ke, filed under **BAD DAO AFRICA LIMITED**. Admin is ready to file, but we want this done as one complete task rather than started and left half-finished, so we're holding until we have your data description in hand: what personal data the system actually touches — phone hashes, what Privy holds, anything else. Once that's in, admin files the same day."*
> 
> **Section 6 — SASRA:**  
> *"Direction: Baraza doesn't obtain a SASRA licence. A SACCO-type community obtains its own and provides proof before that community type activates. What's missing is the mechanism — who checks the proof, what counts as valid, what blocks activation without it. That's what's needed from you."*
> 
> **Section 9 — How decisions run from here:**  
> *"Anything that changes scope, adds a dependency, or introduces a new service gets raised before it's built. Sequence is **ask, agree, build.**"*

---

### 2.2 Live Validation & DevOps Constraints (`DevOps Request PDF`)

#### Full Verbatim Citations:
> **Core Architectural Invariant (Why this is required):**  
> *"This is not a generic 'more env vars' request. It is required because the project brief and the SAD v1 set hard rules for how the live payment and governance flow must behave.*  
> 
> **The critical rules are:**
> 1. *Do not trust inbound webhook/callback events as truth.*
> 2. *Do not advance payment state without a server-side independent confirmation.*
> 3. *Never expose real secrets via `VITE_` variables.*
> 4. *Keep production behavior behind actual live credentials and deployment controls."*
> 
> **Production Simulator Gating Policy:**  
> *"The simulator must not be reachable in production; the production environment must block simulator execution even if a caller attempts to use it; any dev/test path must remain isolated from live production traffic."*
> 
> **Exact Payment & Status Verification Sequence:**  
> *"1. Create a real payment order.*  
> *2. Initiate a Daraja STK request.*  
> *3. Receive a real callback or confirmation signal.*  
> *4. Call the independent Daraja Transaction Status Query.*  
> *5. Confirm the order is not advanced without the independent verification result.*  
> *6. Confirm the order only advances when the status result is successful."*

---

### 2.3 Dynamic Activation Pricing & Dues Fee Calculation

#### A. Source: `Baraza-Protocol-HOLY-GRAIL.md` (Rev 2, Master Ground Truth)
> **Section 8 — Fee and Commercial Model:**
> *"Addendum 2 resolution (item 6): the core fee is **2% on transactions/money movement through the platform** — this supersedes both the Master Document's 2% + 0.5%-swap model and a separately-recorded 5%-buy-in + 2%-transaction figure found in Notion; neither of those is current. No swap functionality currently planned; if added later, keep it small/favorable to the community. Account activation confirmed at $1 (~KES 100–120), deliberately small. Freemium model confirmed: free base tier exists, premium features behind a payment gate, priced per community-type/feature-activation (feature-gated, not flat platform-wide). Pricing/feature-gating currently only needs to account for Stellar-based communities, per single-chain-for-launch."*
> 
> **Developer Brief §1.11:**
> *"Commercial tiers: Sandbox (free forever) → Community (free-to-low, tiers 1–2, up to ~50 members, revenue only from the 2% movement fee) → Cooperative (monthly, tier 3, 50–several thousand members) → Institutional (annual contract, tier 5 and large tier 4 DAOs)."*
> 
> **Addendum 2, Item 4:**
> *"Pre-transaction fee disclosure — every transaction screen must show the user the fee before confirmation. No hidden charges."*

#### B. Source: `Baraza Protocol  SAD.md` (Software Architecture Document v1.0, Simon Wandera)
> **Section 2.2 — Protocol Fee & Economic Mechanics:**
> - *"Platform Fee Rate: 2.0% platform service fee charged on incoming member contributions."*
> - *"Provider Collection Cost (Pass-Through): Safaricom charges 0.5% (capped at KES 200) on Paybill collections (free under KES 200)."*
> - *"Net Revenue Margin: ~1.5% net margin retained by the protocol treasury on M-Pesa volume."*
> - *"Rounding Convention: Round-half-up to the nearest minor integer unit (KES cent / stroop)."*

#### C. Source: `03-M3-Activation-and-Billing.md` (Development Roadmap)
> **Section: Code Tasks:**
> *"1. Implement $1 activation rule with local-currency handling."*  
> *"2. Implement 2% movement fee calculation and pre-transaction disclosure."*  
> *"3. Add fee-version metadata to every charge event."*  
> *"4. Build per-community reconciliation view (what was charged, why, when)."*  
> *"5. Guard against hidden charges and preserve plain-language UI."*  
> *"6. Resolve rounding behavior consistently with SAD defaults until final business confirmation."*

---

### 2.4 Zero-Trust Ingress Security & Invariant I2b

#### A. Source: `Baraza Protocol  SAD.md` (Class A & ADR-008)
> **Section 3.5 — Webhook Authenticity & Fix for Red Team Finding #1:**
> *"Daraja and mobile carrier callbacks carry **no cryptographic signature**. Anyone who learns the callback URL can POST a fabricated confirmation shaped exactly like a real one...*
> 
> **Design Fix (Required for Live Money Movement):**
> 1. *Never treat the inbound webhook as sufficient on its own. On receiving a callback, the API layer must make an independent, server-initiated call to the Transaction Status API to confirm the payment before advancing past `PROVIDER_CONFIRMED`.*
> 2. *IP allowlisting at the infrastructure layer (Safaricom callback ranges: `196.201.214.0/24`, `196.201.213.0/24`, `196.13.100.0/24`).*
> 3. *URL-path secret — callback path carries a random per-deployment token.*
> 
> **Invariant I2b (Webhook is not truth):** *No transition past `PROVIDER_CONFIRMED` occurs without an independent Transaction-Status-API confirmation call succeeding."*

#### B. Source: `Baraza-Protocol-Phase1-Specification.md` (Main-4 Specification)
> **Task 4.2 — Real Callback Handling:**
> *"The Transaction Status API is itself asynchronous — the initial call only acknowledges receipt; the actual verified status arrives later as a second callback to the ResultURL. The state machine transitions: `PROVIDER_CONFIRMED → STATUS_QUERY_SENT → [second callback received] → ATTESTATION_SUBMITTED`."*

---

### 2.5 SASRA SACCO Regulatory Compliance Gates (Class G)

#### A. Source: `Baraza-Launch-Direction-Memo-3.pdf` (§6)
> *"Baraza doesn't obtain a SASRA licence. A SACCO-type community obtains its own and provides proof before that community type activates. What's missing is the mechanism — who checks the proof, what counts as valid, what blocks activation without it. That's what's needed from you."*

#### B. Source: `Baraza Protocol  SAD.md` (§3.6 Class G)
> **SASRA Regulations 2020:**
> *"SASRA's Non-Deposit-Taking SACCO Regulations, 2020 explicitly bring a SACCO under SASRA oversight if it 'mobilises membership and share capital through digital platforms... popularly known as virtual or digital SACCOs' — **regardless of deposit size.** Since Baraza's entire SACCO onboarding path is a digital platform by construction, any SACCO-type community hosted on Baraza falls under this trigger...*
> 
> **License Verification Gate:**
> *Before enabling loan, credit, or capital mobilization capabilities for a community, the platform must verify proof of statutory registration under the Cooperative Societies Act / SASRA license."*

#### C. Source: `Baraza-Protocol-HOLY-GRAIL.md` (Addendum 3 §1, HGD §9a)
> *"Narrowing item #10's KYB/license check to **verification-only**, with no acquisition-workflow tooling attached. Baraza verifies that a regulated group holds a valid license; it does not process or issue licenses."*

---

### 2.6 Double-Entry Ledger & Financial Accounting Model (Class A)

#### A. Source: `Baraza Protocol  SAD.md` (§3.5 Class A)
> **Ledger Data Model (Double-Entry):**
> ```sql
> CREATE TABLE ledger_entries (
>     id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
>     community_id    UUID NOT NULL REFERENCES communities(id),
>     entry_type      TEXT NOT NULL CHECK (entry_type IN ('contribution','disbursement','fee','loan_movement')),
>     debit_account   TEXT NOT NULL,   -- e.g. 'member:<id>', 'treasury:<community_id>', 'baraza:fee_revenue'
>     credit_account  TEXT NOT NULL,
>     amount_minor    BIGINT NOT NULL CHECK (amount_minor > 0),  -- integer minor units
>     currency        TEXT NOT NULL,
>     chain_tx_ref    TEXT,             -- Soroban tx hash once settled; NULL while pending
>     idempotency_key TEXT NOT NULL UNIQUE,
>     created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
>     settled_at      TIMESTAMPTZ
> );
> -- Invariant: for every community_id, SUM(debit) == SUM(credit) at settled_at IS NOT NULL rows.
> ```
> *"Double-entry modeling and the debit=credit invariant are a named, standard accounting-correctness pattern; `amount_minor` as integer is directly required by mobile money validation (no decimals)."*

---

## 3. Mathematical Formulations & Economic Invariants

### 3.1 Total Expected Inbound Dues Formula
For any dues or activation payment of base amount $A_{\text{base}}$ (in minor units, e.g. cents/cents):

$$\text{PlatformFee} = \text{RoundHalfUp}\left(A_{\text{base}} \times 0.020\right)$$

$$\text{CarrierCost} = \begin{cases} 0 & \text{if } A_{\text{base}} < 20000 \text{ (under 200 KES)} \\ \min\left(\text{RoundHalfUp}(A_{\text{base}} \times 0.005), 20000\right) & \text{if } A_{\text{base}} \ge 20000 \text{ (capped at 200 KES)} \end{cases}$$

$$\text{TotalExpected} = A_{\text{base}} + \text{PlatformFee} + \text{CarrierCost}$$

### 3.2 Double-Entry Split Conservation
On successful settlement of $\text{TotalExpected}$:
1. **Member Credit:** Credit $\text{member}:\langle\text{user\_id}\rangle$ with $A_{\text{base}}$
2. **Community Treasury Vault Debit:** Debit $\text{treasury}:\langle\text{community\_id}\rangle$ with $A_{\text{base}}$
3. **Platform Fee Revenue Debit:** Debit $\text{baraza}:\text{fee\_revenue}$ with $\text{PlatformFee}$
4. **Carrier Settlement Debit:** Debit $\text{carrier}:\text{collection\_cost}$ with $\text{CarrierCost}$

$$\sum \text{Debits} = A_{\text{base}} + \text{PlatformFee} + \text{CarrierCost} \equiv \text{TotalExpected} = \sum \text{Credits}$$

---

## 4. Master Scope of Work by Subsystem (Sections A through H)

### Section A: Smart Contracts & On-Chain Settlement Subsystem

#### A.1 Soroban Rust Contract Suite — Mainnet Migration & Auditing
- **Classification:** `[SAD-ALIGNED]` (SAD §1.1, ADR-002, Launch Memo 3 §2, Roadmap M8)
- **Current Completion:** **90%** (All 5 contracts written, compiled to WASM, and covered with 100% snapshot unit tests).
- **Why it Aligns:** Stellar Soroban is the sole canonical launch chain (ADR-002). Canonical truth lives on-chain; PostgreSQL is only a read cache (ADR-003).
- **Target Files (from Code Map):** `contracts/stellar/{community_registry, membership, governance, treasury_vault, payment_attestation}/src/lib.rs`
- **Pending Scope of Work:**
  1. Compile all contracts with `cargo build --target wasm32-unknown-unknown --release` against Soroban SDK v20+.
  2. Optimize WASM binary size using `soroban contract optimize` to minimize ledger footprint.
  3. Deploy to Stellar Mainnet and update `contracts/stellar/addresses/mainnet.json` and `app/src/lib/programs/stellarAddresses.ts`.
  4. Perform testnet-to-mainnet drift smoke tests via `npm run test:contracts:drift`.

#### A.2 Multi-Sig Payment Attestation Service Writer Authorization
- **Classification:** `[SAD-ALIGNED]` (SAD §5.4, ADR-009, Red Team Finding #2)
- **Current Completion:** **70%** (`payment_attestation` contract requires admin authorization; single-signer server client written in `stellar-mint.ts`).
- **Why it Aligns:** Prevents a single compromised Vercel server key from forging on-chain fiat payment receipts.
- **Target Files (from Code Map):** `contracts/stellar/payment_attestation/src/lib.rs`, `app/api/cron/_lib/stellar-mint.ts`
- **Pending Scope of Work:**
  1. Upgrade `PaymentAttestationContract` to store an authorized signers list `Vec<Address>` and require 2 distinct cryptographic signatures for `attest()`.
  2. Refactor `app/api/cron/_lib/stellar-mint.ts` to coordinate dual-signing across two independent key custody sources.

#### A.3 Base EVM / Aragon OSx Adapter Isolation
- **Classification:** `[SAD-ALIGNED]` (SAD §2, ADR-001, Roadmap M7)
- **Current Completion:** **75%** (`Manager.sol`, `Gov.sol`, and `Token.sol` deployed at well-known addresses; `evmClient.ts` has JSON-RPC read methods).
- **Why it Aligns:** Tier 4 corporate DAOs utilize Base EVM. Must remain strictly isolated from Stellar communities (ADR-001 single-chain rule).
- **Target Files (from Code Map):** `contracts/evm/src/manager/Manager.sol`, `app/src/lib/programs/evmClient.ts`
- **Pending Scope of Work:**
  1. Add wallet write capabilities (`createDao()`, `castVote()`) to `evmClient.ts` using `viem` / `ethers`.

---

### Section B: Zero-Trust Payment Ingress, Partner Rails & Fee Engine

#### B.1 Dynamic Activation Pricing & Calculation Engine
- **Classification:** `[SAD-ALIGNED]` (Launch Memo 3 §4, Holy Grail §14)
- **Current Completion:** **40%** (Currently hardcoded to 500 KES in UI and API intent generators).
- **Why it Aligns:** Launch Memo 3 states: *"Account activation is a flexible, configurable, currently one-time fee. Don't hardcode a figure — the fee logic should be built so it can change without a rewrite."*
- **Target Files (from Code Map):** `app/api/stellar/create-payment-intent.ts`, `supabase/migrations/`
- **Pending Scope of Work:**
  1. Create migration `024_communities_dynamic_activation_fee.sql` adding `activation_fee_minor BIGINT DEFAULT 0` and `fee_type TEXT DEFAULT 'one_time'`.
  2. Refactor `create-payment-intent.ts` to query `communities.activation_fee_minor` and compute:
     $$\text{TotalExpected} = \text{ActivationFee} + \text{PlatformFee}(2.0\%) + \text{ProviderFee}(0.5\% \text{ capped at 200 KES})$$
  3. Validate that zero-fee / free communities bypass payment gates gracefully.

#### B.2 Partner-Licensed Mobile Money Rails (Kotani Pay & Minisend)
- **Classification:** `[SAD-ALIGNED]` (Launch Memo 3 §3, Addendum 2, HGD §13)
- **Current Completion:** **60%** (`payments/kotani.ts` and `payments/minisend.ts` proxy routes created; live checkout call sites need wiring).
- **Why it Aligns:** Launch Memo 3 explicitly mandates: *"We're not applying for our own Daraja production account for launch. Payments route through providers who already hold the licences — Kotani, Minisend, Qardi and others."*
- **Target Files (from Code Map):** `app/api/payments/kotani.ts`, `app/api/payments/minisend.ts`, `app/api/webhooks/kotani.ts`
- **Pending Scope of Work:**
  1. Implement live STK Push trigger in `payments/kotani.ts` calling `/v1/onramp/stellar`.
  2. Connect `webhooks/kotani.ts` to verify `KOTANI_WEBHOOK_SECRET` signature, match order by reference, and transition status to `ATTESTATION_SUBMITTED`.
  3. Implement Minisend off-ramp caller in `payments/minisend.ts` for automated treasury payouts.

#### B.3 Dual-Layer Webhook Ingress Security
- **Classification:** `[SAD-ALIGNED]` (SAD §5.2, Invariant I3a, Red Team Finding #1)
- **Current Completion:** **100%** (Implemented in `status-result.ts` with `hasPathSecret` and CIDR bitwise allowlist `196.201.214.0/24`).
- **Why it Aligns:** Guarantees zero-trust ingress from untrusted mobile money carrier networks.

---

### Section C: Double-Entry Ledger & Financial Accounting Model

#### C.1 Mathematical Conservation & Ledger Invariants
- **Classification:** `[SAD-ALIGNED]` (SAD §3.5 Class A, Invariants I1/I2)
- **Current Completion:** **50%** (Database schema designed in SAD; runtime insertion trigger pending).
- **Why it Aligns:** Guarantees mathematical conservation across all transactions:
  $$\sum \text{Debit} \equiv \sum \text{Credit}$$
- **Target Files (from Code Map):** `supabase/migrations/002_payment_orders.sql`, `app/api/membership/activate.ts`
- **Pending Scope of Work:**
  1. Create database migration `025_double_entry_ledger.sql` with table `ledger_entries (id, order_id, account_id, debit_amount, credit_amount, currency, created_at)`.
  2. Create atomic stored procedure `record_double_entry_split()` to record member contribution credit, treasury vault debit, and 2% platform fee allocation in a single ACID transaction.

---

### Section D: SASRA & Regulatory Compliance Subsystem (Class G)

#### D.1 SASRA SACCO License Verification Gate
- **Classification:** `[SAD-ALIGNED]` (Launch Memo 3 §6, SAD §3.6 Class G, HGD §9a, ADR-006)
- **Current Completion:** **20%** (Principle documented; endpoints and database constraints pending).
- **Why it Aligns:** Launch Memo 3 states: *"Baraza doesn't obtain a SASRA licence. A SACCO-type community obtains its own and provides proof before that community type activates."*
- **Target Files (from Code Map):** `app/api/compliance/sacco-license.ts`, `supabase/migrations/`
- **Pending Scope of Work:**
  1. **Database Migration:** Add `sacco_license_status` (`UNLICENSED`, `PENDING_REVIEW`, `VERIFIED`, `REJECTED`), `sacco_license_number`, and `sacco_cert_url` to `communities`.
  2. **New Endpoint:** `POST /api/compliance/sacco-license-submit` (receives license details and certificate document URL).
  3. **New Endpoint:** `POST /api/compliance/sacco-license-verify` (Admin-authenticated review transition).
  4. **Feature Gate Enforcement:** Intercept loan and capital mobilization API routes to throw `403 Forbidden` unless `sacco_license_status === 'VERIFIED'`.

#### D.2 Behavioral Deposit Monitoring & Threshold Alerts
- **Classification:** `[SAD-ALIGNED]` (SAD §3.6 Class G, Red Team Finding #4)
- **Current Completion:** **10%** (SQL query drafted in architecture docs).
- **Why it Aligns:** SASRA Non-Deposit-Taking Regulations 2020 trigger oversight when digital deposits cross KES 100M.
- **Pending Scope of Work:**
  1. Create daily background query in `app/api/cron/monitor-compliance.ts` flagging groups exceeding KES 100M.

#### D.3 ODPC Personal Data Inventory for BAD DAO AFRICA LIMITED
- **Classification:** `[SAD-ALIGNED]` (Launch Memo 3 §5, SAD §3.6, Kenya DPA 2019 §18)
- **Current Completion:** **90%** (Code hashes phone numbers with `PAYMENT_PHONE_HASH_PEPPER`; filing inventory document pending).
- **Pending Scope of Work:**
  1. Complete formal personal data filing statement for `BAD DAO AFRICA LIMITED` covering HMAC phone hashes, Privy MPC wallet metadata, and session tokens.

---

### Section E: Conversational Bot Engine & WhatsApp Gateway (ADR-007)

#### E.1 Natural Language Sheng, Swahili & English Slot Parser
- **Classification:** `[SAD-ALIGNED]` (SAD §7.3, ADR-007, HGD §17)
- **Current Completion:** **70%** (Pure `processTurn()` FSM engine written; conversational dictionary needs Sheng slot expansion).
- **Why it Aligns:** Members access Baraza via WhatsApp without Web3 jargon.
- **Target Files (from Code Map):** `app/src/lib/bot/fsm.ts`, `evolution-api/src/webhook.ts`
- **Pending Scope of Work:**
  1. Add Sheng slang affirmative tokens (`"rada"`, `"ni poa"`, `"wazi"`, `"chapa"`, `"soo tano"`) to `fsm.ts`.
  2. Wire fallback ladder: Turn 1–2 (Clarification) $\to$ Turn 3 (Stateless LLM Rephrase) $\to$ Turn 4 (Human Admin Alert).

---

### Section F: Background Reconciliation & Durable Crons (ADR-004)

#### F.1 Durable Vercel Cron Reconciler & Backoff Scheduler
- **Classification:** `[SAD-ALIGNED]` (SAD §5.3, ADR-004, Invariant I2)
- **Current Completion:** **75%** (`promote-orders.ts` processes happy path; backoff escalation needs retry counter).
- **Why it Aligns:** Eliminates brittle synchronous wait loops; reconciles dropped network callbacks reliably.
- **Target Files (from Code Map):** `app/api/cron/promote-orders.ts`
- **Pending Scope of Work:**
  1. Add exponential backoff retry intervals ($30\text{s} \to 2\text{m} \to 8\text{m} \to 32\text{m} \to \text{hourly}$) up to 24 hours.
  2. Implement automatic status transition to `REFUND_REQUESTED` if unverified after 24 hours.

---

### Section G: Standard Production SaaS & Quality-of-Life Endpoints

#### G.1 Member Profile, Preferences & Identity Continuity
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Essential for production SaaS account management, allowing members to manage profiles, language preferences (English/Swahili/Sheng), and notification routing without exposing raw on-chain data. Replaces scattered localStorage stubs in `Profile.tsx` and `phoneAuth.ts`.
- **Target Files (from Code Map):** `app/api/user/profile.ts`, `app/api/user/memberships.ts`, `supabase/migrations/`
- **Pending Scope of Work:**
  1. `GET /api/user/profile` — Fetch current user profile, linked wallets, verified phone status, and notification preferences.
  2. `PATCH /api/user/profile` — Update display name, avatar URL, bio, preferred locale (`en` | `sw` | `sheng`), country (`KE`, `UG`, `TZ`, `RW`), and default currency.
  3. `GET /api/user/memberships` — Return all active community memberships, officer roles, dues status, and voting power for the authenticated user.
  4. `POST /api/user/avatar-upload` — Generate presigned upload URL for member avatars in Supabase Storage (`avatars` bucket).

#### G.2 Push Notifications & Multi-Channel Messaging Subscriptions
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

#### G.3 Community Workspace Features (Roadmaps, Suggestions & Bounties)
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

#### G.4 Community Management, Invitations & Access Control
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Group founders and admins need tools to manage membership rosters, track invite links, and assign leadership roles.
- **Target Files (from Code Map):** `app/api/communities/[id]/`
- **Pending Scope of Work:**
  1. `GET/PATCH /api/communities/[id]/settings` — Update community metadata (description, logo, rules, privacy mode: `public` vs `private_invite_only`).
  2. `POST /api/communities/[id]/invites` — Generate trackable member referral/invite link with expiration and max uses.
  3. `GET /api/communities/[id]/members` — Search and filter member roster (by `active`, `overdue_dues`, `role`), with pagination and CSV export.
  4. `POST /api/communities/[id]/officers` — Assign and revoke group officer roles (Chairperson, Treasurer, Secretary).

#### G.5 Accounting Statements, Tax Receipts & Financial Exports
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Group treasurers, SACCO committee members, and auditors require downloadable accounting statements for local tax and statutory record-keeping.
- **Pending Scope of Work:**
  1. `GET /api/communities/[id]/statement` — Export community double-entry ledger entries to CSV or PDF for custom date ranges.
  2. `GET /api/user/receipt/[orderId]` — Generate downloadable PDF payment receipt for member dues contributions.

#### G.6 Disputes, Refund Requests & Audit Logs
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Provides operational resolution paths for payment mismatches (`payment_orders.status = 'MANUAL_REVIEW'`) and immutable regulatory audit trails.
- **Pending Scope of Work:**
  1. `POST /api/payment-orders/[id]/dispute` — Member submits dispute reason / proof for stalled or mismatched payments.
  2. `GET /api/communities/[id]/audit-log` — Tamper-evident, append-only audit trail of officer and admin actions (mandated for SASRA/ODPC compliance).
  3. `POST /api/support/ticket` — Submit support ticket with automated Akili AI diagnostics and human escalation.

#### G.7 Health, Readiness & Observability Endpoints
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Mandatory for production uptime monitoring (Better Uptime, Datadog, Vercel synthetic checks) and zero-downtime deployments.
- **Pending Scope of Work:**
  1. `GET /api/health/live` — Lightweight liveness probe returning HTTP 200 `{ status: "ok" }`.
  2. `GET /api/health/ready` — Deep readiness probe validating database connectivity, Horizon RPC responsiveness, and partner payment gateway health.
  3. `GET /api/health/metrics` — Metrics probe returning queue depth, attestation latency, and error counts.

#### G.8 Token-Bucket Rate Limiting & Abuse Prevention Middleware
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Protects paid third-party APIs (Privy, Anthropic, Africa's Talking) and serverless compute from abuse.
- **Pending Scope of Work:**
  1. Implement Upstash Redis / Vercel KV token-bucket rate limiting on `/api/stellar/create-payment-intent`, `/api/agent/chat`, and `/api/identity/*`.

---

### Section H: System Architect Strategic Proposals for Scale & Resilience

#### H.1 Automated Soroban Contract Event Indexer (Decoupled Worker)
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Prevents cache drift between Supabase and Stellar if an HTTP connection drops during contract invocation (ADR-003).
- **Proposal:** Deploy a lightweight background worker consuming Stellar RPC ingestion streams to automatically sync contract events into Supabase asynchronously.

#### H.2 Intelligent Multi-Provider Payment Fallback Router
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Mitigates carrier downtime by automatically routing payments:
  $$\text{Primary: Kotani Pay} \xrightarrow{\text{Failover}} \text{Minisend} \xrightarrow{\text{Failover}} \text{Direct Daraja} \xrightarrow{\text{Fallback}} \text{Crypto Deposit}$$

#### H.3 Hardware-Backed Key Management (Cloud KMS)
- **Classification:** `[PROPOSED]`
- **Engineering Rationale:** Enhances Tier 3 custody security by replacing environment variable private keys with AWS KMS / GCP Cloud KMS HSM-backed signing.

---

## 5. Step-by-Step Technical Implementation Plan (Phased Sprints P1–P8)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   MASTER SCOPE OF WORK EXECUTION PHASES                                │
├─────────┬──────────────────────────────────────────┬────────────────┬───────────────┬──────────────────┤
│ Phase   │ Feature / Subsystem                      │ Classification │ Current State │ Target Timeline  │
├─────────┼──────────────────────────────────────────┼────────────────┼───────────────┼──────────────────┤
│ **P1**  │ Dynamic Fee Engine + Kotani/Minisend     │ `[SAD-ALIGNED]`│ 40% Complete  │ Sprint 1 (Days 1-5│
│ **P2**  │ SASRA Sacco License Verification Gate    │ `[SAD-ALIGNED]`│ 20% Complete  │ Sprint 1 (Days 3-7│
│ **P3**  │ Soroban Mainnet Deploy + 2-of-N Attest   │ `[SAD-ALIGNED]`│ 90% Complete  │ Sprint 2 (Days 8-12│
│ **P4**  │ Double-Entry Ledger + Cron Reconciler    │ `[SAD-ALIGNED]`│ 60% Complete  │ Sprint 2 (Days 10-14│
│ **P5**  │ Core SaaS: Profile, Push, Settings       │ `[PROPOSED]`   │ 30% Complete  │ Sprint 3 (Days 15-18│
│ **P6**  │ Workspace: Roadmap, Suggestions, Bounties│ `[PROPOSED]`   │ 20% Complete  │ Sprint 3 (Days 17-20│
│ **P7**  │ Health, Observability, Rate Limiting     │ `[PROPOSED]`   │ 25% Complete  │ Sprint 4 (Days 20-22│
│ **P8**  │ Event Indexer + KMS HSM Key Custody      │ `[PROPOSED]`   │ 10% Complete  │ Sprint 4 (Days 22-25│
└─────────┴──────────────────────────────────────────┴────────────────┴───────────────┴──────────────────┘
```

### Phase P1 Immediate Tasks:
1. **Migration `024_communities_dynamic_activation_fee.sql`:**
   - `activation_fee_minor BIGINT NOT NULL DEFAULT 0`
   - `fee_type TEXT NOT NULL DEFAULT 'one_time' CHECK (fee_type IN ('one_time', 'recurring_monthly', 'free'))`
   - `carrier_pass_through BOOLEAN NOT NULL DEFAULT true`
2. **Centralized Fee Utility (`app/src/lib/payments/feeEngine.ts`):**
   - Pure, deterministic calculation of 2% platform fee, carrier pass-through, and zero-fee bypass.
3. **Intent Generator (`app/api/stellar/create-payment-intent.ts`):**
   - Dynamic fee breakdown & HMAC signature binding.
4. **Partner Rail Checkout Wiring (`app/api/payments/kotani.ts` & `app/api/webhooks/kotani.ts`):**
   - Live on-ramp STK prompt caller and webhook signature verifier.
5. **Frontend Pre-Transaction Disclosure (`JoinDao.tsx`, `CreateCommunity.tsx`):**
   - Transparent itemized fee breakdown before payment prompt.

---

## 6. Verification Plan & Acceptance Test Scenarios

### Automated Tests (`app/src/lib/__tests__/feeEngine.test.ts`)
1. **Zero-Fee Communities:** Base 0 KES $\to$ Total 0 KES, bypasses STK push.
2. **Standard Community (KES 500 = 50,000 cents):**
   - Base = 50,000
   - Platform Fee (2%) = 1,000 (KES 10)
   - Carrier Cost (0.5%) = 250 (KES 2.50)
   - Total = 51,250 cents (KES 512.50)
3. **Large Enterprise SACCO Contribution (KES 100,000 = 10,000,000 cents):**
   - Base = 10,000,000
   - Platform Fee (2%) = 200,000 (KES 2,000)
   - Carrier Cost (0.5% capped at KES 200) = 20,000 (KES 200)
   - Total = 10,220,000 cents (KES 102,200)
4. **Rounding Precision Check:** Verifies integer math never introduces fractional cents.

### Live Integration Tests
- Verify Kotani Pay sandbox on-ramp request succeeds with mock phone `254708374149`.
- Verify webhook transitions order status idempotently without double-charging.

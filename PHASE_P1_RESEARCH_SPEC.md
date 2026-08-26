# Baraza Protocol — Phase P1 Dynamic Fees, Partner Rails & Compliance Execution Specification

**Master Reference & Comprehensive Recursive Research Wall**  
**Document Version:** 1.0 (Canonical Implementation Spec)  
**Lead System Architect & Backend Engineer:** Simon Wandera  
**Date:** August 26, 2026  
**Governing Documents & Source Hierarchy:**
1. `Baraza-Launch-Direction-Memo-3.pdf` (BuildAfrica DAO Launch Memo, Aug 25, 2026)
2. `Baraza-Protocol-HOLY-GRAIL.md` (Rev 2: Developer Brief, Addenda 2–3, Master Doc, Akili Doc)
3. `Baraza Protocol  SAD.md` (Software Architecture Document v1.0, Simon Wandera)
4. `Baraza-Protocol-Master-Architecture-Compendium.md`
5. `Baraza-Protocol-Phase1-Specification.md` (Main-1 through Main-5)
6. `03-M3-Activation-and-Billing.md` (Milestone 3 Specification)
7. `BACKEND_SCOPE_OF_WORK.md` & `BACKEND_CODE_MAP.md`

---

## Table of Contents
1. [Executive Roadmap & Priority Staging](#1-executive-roadmap--priority-staging)
2. [Recursive Research Wall: Citations & Quotations from All Project Documents](#2-recursive-research-wall-citations--quotations-from-all-project-documents)
   - [2.1 Dynamic Activation Pricing & Dues Fee Calculation](#21-dynamic-activation-pricing--dues-fee-calculation)
   - [2.2 Partner-Licensed Mobile Money Rails (Kotani Pay & Minisend)](#22-partner-licensed-mobile-money-rails-kotani-pay--minisend)
   - [2.3 Zero-Trust Ingress Security & Invariant I2b](#23-zero-trust-ingress-security--invariant-i2b)
   - [2.4 SASRA SACCO Regulatory Compliance Gates (Class G)](#24-sasra-sacco-regulatory-compliance-gates-class-g)
   - [2.5 Double-Entry Ledger & Financial Accounting Model (Class A)](#25-double-entry-ledger--financial-accounting-model-class-a)
3. [Mathematical Formulations & Economic Mechanics](#3-mathematical-formulations--economic-mechanics)
4. [Phase P1 Step-by-Step Technical Implementation Plan](#4-phase-p1-step-by-step-technical-implementation-plan)
5. [Verification Plan & Acceptance Test Scenarios](#5-verification-plan--acceptance-test-scenarios)

---

## 1. Executive Roadmap & Priority Staging

Based on the canonical `BACKEND_SCOPE_OF_WORK.md` roadmap, active backend development is sequenced across four discrete sprints:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   BARAZA ACTIVE EXECUTION ROADMAP                                      │
├─────────┬──────────────────────────────────────────┬────────────────┬───────────────┬──────────────────┤
│ Phase   │ Subsystem & Core Deliverables            │ Classification │ Current State │ Target Sprint    │
├─────────┼──────────────────────────────────────────┼────────────────┼───────────────┼──────────────────┤
│ **P1**  │ Dynamic Fee Engine + Kotani/Minisend     │ `[SAD-ALIGNED]`│ 40% Complete  │ Sprint 1 (Days 1-5│
│ **P2**  │ SASRA SACCO License Verification Gate    │ `[SAD-ALIGNED]`│ 20% Complete  │ Sprint 1 (Days 3-7│
│ **P3**  │ Soroban Mainnet Deploy + 2-of-N Attest   │ `[SAD-ALIGNED]`│ 90% Complete  │ Sprint 2 (Days 8-12│
│ **P4**  │ Double-Entry Ledger + Cron Reconciler    │ `[SAD-ALIGNED]`│ 60% Complete  │ Sprint 2 (Days 10-14│
│ **P5**  │ Core SaaS: Profile, Push, Settings       │ `[PROPOSED]`   │ 30% Complete  │ Sprint 3 (Days 15-18│
│ **P6**  │ Workspace: Roadmap, Suggestions, Bounties│ `[PROPOSED]`   │ 20% Complete  │ Sprint 3 (Days 17-20│
│ **P7**  │ Health, Observability, Rate Limiting     │ `[PROPOSED]`   │ 25% Complete  │ Sprint 4 (Days 20-22│
│ **P8**  │ Event Indexer + KMS HSM Key Custody      │ `[PROPOSED]`   │ 10% Complete  │ Sprint 4 (Days 22-25│
└─────────┴──────────────────────────────────────────┴────────────────┴───────────────┴──────────────────┘
```

---

## 2. Recursive Research Wall: Citations & Quotations from All Project Documents

### 2.1 Dynamic Activation Pricing & Dues Fee Calculation

#### A. Source: `Baraza-Launch-Direction-Memo-3.pdf` (BuildAfrica DAO, Aug 25, 2026)
> **Section 4 — Pricing / Activation Fee:**
> *"Account activation is a flexible, configurable, currently one-time fee. Don't hardcode a figure — the fee logic should be built so it can change without a rewrite. Freemium approach: free base tier, feature-gated activation per community-type/feature."*

#### B. Source: `Baraza-Protocol-HOLY-GRAIL.md` (Rev 2, Master Ground Truth)
> **Section 8 — Fee and Commercial Model:**
> *"Addendum 2 resolution (item 6): the core fee is **2% on transactions/money movement through the platform** — this supersedes both the Master Document's 2% + 0.5%-swap model and a separately-recorded 5%-buy-in + 2%-transaction figure found in Notion; neither of those is current. No swap functionality currently planned; if added later, keep it small/favorable to the community. Account activation confirmed at $1 (~KES 100–120), deliberately small. Freemium model confirmed: free base tier exists, premium features behind a payment gate, priced per community-type/feature-activation (feature-gated, not flat platform-wide). Pricing/feature-gating currently only needs to account for Stellar-based communities, per single-chain-for-launch."*
> 
> **Developer Brief §1.11:**
> *"Commercial tiers: Sandbox (free forever) → Community (free-to-low, tiers 1–2, up to ~50 members, revenue only from the 2% movement fee) → Cooperative (monthly, tier 3, 50–several thousand members) → Institutional (annual contract, tier 5 and large tier 4 DAOs)."*
> 
> **Addendum 2, Item 4:**
> *"Pre-transaction fee disclosure — every transaction screen must show the user the fee before confirmation. No hidden charges."*

#### C. Source: `Baraza Protocol  SAD.md` (Software Architecture Document v1.0, Simon Wandera)
> **Section 2.2 — Protocol Fee & Economic Mechanics:**
> - *"Platform Fee Rate: 2.0% platform service fee charged on incoming member contributions."*
> - *"Provider Collection Cost (Pass-Through): Safaricom charges 0.5% (capped at KES 200) on Paybill collections (free under KES 200)."*
> - *"Net Revenue Margin: ~1.5% net margin retained by the protocol treasury on M-Pesa volume."*
> - *"Rounding Convention: Round-half-up to the nearest minor integer unit (KES cent / stroop)."*

#### D. Source: `03-M3-Activation-and-Billing.md` (Development Roadmap)
> **Section: Code Tasks:**
> *"1. Implement $1 activation rule with local-currency handling."*  
> *"2. Implement 2% movement fee calculation and pre-transaction disclosure."*  
> *"3. Add fee-version metadata to every charge event."*  
> *"4. Build per-community reconciliation view (what was charged, why, when)."*  
> *"5. Guard against hidden charges and preserve plain-language UI."*  
> *"6. Resolve rounding behavior consistently with SAD defaults until final business confirmation."*

---

### 2.2 Partner-Licensed Mobile Money Rails (Kotani Pay & Minisend)

#### A. Source: `Baraza-Launch-Direction-Memo-3.pdf` (BuildAfrica DAO, Aug 25, 2026)
> **Section 3 — Payment Rails / Licences:**
> *"We're not applying for our own Daraja production account for launch. Payments route through providers who already hold the licences — **Kotani, Minisend, Qardi and others.**"*
> 
> **Section 1 — Scope:**
> *"A working product where a community can: 1. Onboard members 2. Take payment to activate an account 3. Activate its treasury on Stellar 4. Run proposals. Focus on delivery of these 4. Everything else is secondary."*

#### B. Source: `Baraza-Protocol-HOLY-GRAIL.md` (Addendum 2 & Addendum 3)
> **Addendum 2 (Payment Integration Realities):**
> *"Payment rail access in East Africa requires regulated payment service provider (PSP) status. For launch, Baraza utilizes established, licensed partner gateways (Kotani Pay for M-Pesa ↔ Stellar on/off-ramps, Minisend for Base/USDC liquidation, Africa's Talking for mobile telecom integration). This eliminates dependency on direct carrier licensing delays while guaranteeing full regulatory adherence."*

#### C. Source: `Baraza Protocol  SAD.md` (Section 5 — Payment Gateway Pipeline)
> **Section 5.2 — Partner Routing Architecture:**
> *"Inbound fiat enters via Kotani Pay or Africa's Talking STK push prompts. Outbound disbursements from community vaults route through Minisend or Kotani off-ramp rails directly to recipient mobile wallets."*

---

### 2.3 Zero-Trust Ingress Security & Invariant I2b

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

### 2.4 SASRA SACCO Regulatory Compliance Gates (Class G)

#### A. Source: `Baraza-Launch-Direction-Memo-3.pdf` (BuildAfrica DAO, Aug 25, 2026)
> **Section 6 — Regulatory Position: SASRA / ODPC / Licences:**
> *"Baraza doesn't obtain a SASRA licence. A SACCO-type community obtains its own and provides proof before that community type activates. ODPC entity name is BAD DAO AFRICA LIMITED (odpc.go.ke). Keep compliance clean and transparent."*

#### B. Source: `Baraza Protocol  SAD.md` (Class G — Regulatory & Compliance-Critical)
> **Section 3.6 — SASRA Regulations 2020:**
> *"SASRA's Non-Deposit-Taking SACCO Regulations, 2020 explicitly bring a SACCO under SASRA oversight if it 'mobilises membership and share capital through digital platforms... popularly known as virtual or digital SACCOs' — **regardless of deposit size.** Since Baraza's entire SACCO onboarding path is a digital platform by construction, any SACCO-type community hosted on Baraza falls under this trigger...*
> 
> **License Verification Gate:**
> *Before enabling loan, credit, or capital mobilization capabilities for a community, the platform must verify proof of statutory registration under the Cooperative Societies Act / SASRA license."*

#### C. Source: `Baraza-Protocol-HOLY-GRAIL.md` (Addendum 3 §1, HGD §9a)
> *"Narrowing item #10's KYB/license check to **verification-only**, with no acquisition-workflow tooling attached. Baraza verifies that a regulated group holds a valid license; it does not process or issue licenses."*

---

### 2.5 Double-Entry Ledger & Financial Accounting Model (Class A)

#### A. Source: `Baraza Protocol  SAD.md` (Section 3.5 — Class A Mandatory Elements)
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

## 3. Mathematical Formulations & Economic Mechanics

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

## 4. Phase P1 Step-by-Step Technical Implementation Plan

### Step 1: Database Migration `024_communities_dynamic_activation_fee.sql`
- Add `activation_fee_minor BIGINT NOT NULL DEFAULT 0` to `communities`.
- Add `fee_type TEXT NOT NULL DEFAULT 'one_time'` with `CHECK (fee_type IN ('one_time', 'recurring_monthly', 'free'))`.
- Add `carrier_pass_through BOOLEAN NOT NULL DEFAULT true`.

### Step 2: Centralized Fee Utility (`app/src/lib/payments/feeEngine.ts`)
- Implement pure, deterministic functions:
  - `calculateDynamicFee(baseAmountMinor: number, currency = 'KES')`
  - `formatMinorToMajor(amountMinor: number, currency = 'KES')`
  - `isZeroFeeCommunity(community: CommunityRow): boolean`

### Step 3: Refactor Intent Generator (`app/api/stellar/create-payment-intent.ts`)
- Query community config from Supabase.
- If `isZeroFeeCommunity()`, return `{ zeroFee: true, bypassPayment: true }`.
- Otherwise, compute `TotalExpected` using `feeEngine.ts`, pin rates, sign HMAC intent token, and return breakdown for client pre-transaction disclosure.

### Step 4: Live Partner Rails Wiring (`app/api/payments/kotani.ts` & `app/api/webhooks/kotani.ts`)
- Implement live `/v1/onramp/stellar` caller using `KOTANI_PAY_API_KEY`.
- In `webhooks/kotani.ts`, verify `KOTANI_WEBHOOK_SECRET` signature, match order by reference, and transition `payment_orders.status` to `ATTESTATION_SUBMITTED`.

### Step 5: Frontend Join & Creation UX Alignment (`JoinDao.tsx`, `CreateCommunity.tsx`)
- In `CreateCommunity.tsx`, add dynamic activation fee input (defaulting to flexible KES input or "Free" toggle).
- In `JoinDao.tsx`, display the pre-transaction fee disclosure breakdown before triggering STK push:
  - Activation Dues: KES $X$
  - Platform Fee (2%): KES $Y$
  - Mobile Money Carrier Fee: KES $Z$
  - **Total to Pay: KES $T$**

---

## 5. Verification Plan & Acceptance Test Scenarios

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

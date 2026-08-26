# How to Research, Plan, and Code a Phase to S&P 500 Institutional Standards
## The Canonical Baraza Protocol Engineering Playbook

**Document Version:** 1.0 (Institutional Standard Operating Procedure)  
**Lead System Architect & Backend Engineer:** Simon Wandera  
**Date:** August 26, 2026  
**Governing Standard:** S&P 500 Enterprise Fintech & Distributed Systems Engineering  

---

## Executive Summary & Purpose

This Playbook codifies the **exact, reproducible 9-stage methodology** used to research, architect, audit, implement, and verify **Phase P1 (Dynamic Activation Fee Engine, Multi-Rail Ingress, and Double-Entry Settlement)** of the Baraza Protocol. 

Every subsequent phase (P2 through P5) must strictly follow this 9-stage lifecycle to eliminate hallucinations, prevent financial calculation regressions, guarantee zero-trust cryptographic security, and maintain 100% green test suite integrity.

---

## The 9-Stage Institutional Phase Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 THE 9-STAGE PHASE EXECUTION LIFECYCLE                                            │
├───────┬────────────────────────────────────────────┬────────────────────────────────────────────────────────────┤
│ Stage │ Phase Execution Stage                      │ Primary Deliverable / Output Artifact                     │
├───────┼────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **1** │ **Recursive Research & Citation Mining**   │ Citation Wall across SAD, Holy Grail, Memo 3 & DevOps PDFs │
│ **2** │ **Single Source of Truth Concatenation**   │ Canonical Master Scope of Work (`BACKEND_SCOPE_OF_WORK.md`)│
│ **3** │ **Stakeholder Decision-Locking**           │ 7 Locked Architectural & Regulatory Directives             │
│ **4** │ **Adversarial Red-Team Stress Testing**    │ 6-Vector Attack Defense & Cryptographic Invariants         │
│ **5** │ **Microscopic Codebase Impact Mapping**    │ File-by-File Impact Report with exact line-range citations │
│ **6** │ **Four-Tier Verification Blueprinting**    │ Code, Invariant, Physical Device (6 Steps), & Attack Specs │
│ **7** │ **Unbiased Correctness Audit**             │ Audit against Repo Standards (`Baraza-Protocol-Coding-...`)│
│ **8** │ **Surgical Execution & Layered Coding**    │ DDL Migration -> Pure Math -> Edge APIs -> Rails -> UI UX  │
│ **9** │ **Real HTTP Stress & Database Validation** │ Live TCP Server Tests, DB PostgREST Engine, DDL Schema Test│
└───────┴────────────────────────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

## Detailed Step-by-Step Execution Guide

---

### Stage 1: Recursive Research & Citation Mining
* **Objective:** Uncover all authoritative requirements across both the active codebase and historical architectural documents before writing a single line of code.
* **The Process:**
  1. **Identify the Core Task:** Clarify the exact scope (e.g. dynamic dues pricing, multi-rail mobile money ingress, SASRA review gating).
  2. **Mine Root Document Hierarchy:** Search and extract verbatim citations from:
     - Software Architecture Document (`Baraza Protocol  SAD.md`)
     - Holy Grail Specification (`Baraza-Protocol-HOLY-GRAIL.md` §8 & §14)
     - Executive Launch Directives (`Baraza-Launch-Direction-Memo-3.pdf` §1–§9)
     - DevOps Infrastructure Directives (`DevOps Request: Live Validation...pdf` §3)
  3. **Build the Citation Wall:** Record verbatim quotes proving the business requirement and regulatory constraint for every proposed feature.

---

### Stage 2: Single Source of Truth Concatenation
* **Objective:** Eliminate documentation drift and conflicting specifications by uniting all research into a single canonical master document.
* **The Process:**
  1. Concatenate fragmented research notes, PDF extracts, and architectural blueprints into **`BACKEND_SCOPE_OF_WORK.md`** (e.g. Version 4.0).
  2. Structure the master document into logical parts:
     - Part 1: Governing Source Hierarchy & Citation Wall
     - Part 2: Locked Stakeholder Architectural Decisions
     - Part 3: Financial Math, Dynamic Fee Matrix & Double-Entry Invariants
     - Part 4: Phased Execution Roadmaps (P1 through P5)
     - Part 5: Full OpenAPI / AsyncAPI Endpoint Catalogs
  3. Mirror the canonical document to the documentation repository (`baraza-private/02-architecture/`).

---

### Stage 3: Stakeholder Decision Alignment & Decision-Locking
* **Objective:** Explicitly resolve every architectural trade-off and obtain locked stakeholder decisions before implementation.
* **The 7 Core Decision Vectors to Always Lock:**
  1. **Payment Rails & Aggregation:** Primary default provider vs multi-rail fallbacks (e.g. Kotani Pay + Daraja + Paystack + Minisend).
  2. **Fee Policy & Dues Model:** Inbound movement fee (e.g. 2.0%) vs outbound disbursements (0% platform fee).
  3. **Regulatory Gate (SASRA / DPA):** Admin review gating vs automated KYC.
  4. **Attestation Key Custody:** Cloud KMS Hardware HSM vs plaintext secrets.
  5. **Messaging Gateway:** Evolution API for dev/test $\to$ Meta WhatsApp Cloud API for production.
  6. **Personal Data & Privacy Boundary:** Peppered HMAC phone hashes (`phone_hash`), zero unhashed PII in Postgres.
  7. **Statutory Retention:** 7-year statutory financial ledger retention.

---

### Stage 4: Adversarial Red-Team Stress Testing & Defense
* **Objective:** Stress-test the proposed architecture against real-world attacks, network failures, and race conditions before coding.
* **The 6 Mandatory Threat Vectors to Audit & Defend:**
  1. **Multi-Rail Concurrent Ingress Race:** Two webhooks arrive simultaneously for the same order $\to$ Defended via pessimistic database row locking (`SELECT ... FOR UPDATE`).
  2. **Zero-Outbound Fee Arbitrage:** Attacker deposits funds to churn free outbound withdrawals $\to$ Defended via pass-through carrier gas fees and deposit lockup windows.
  3. **Rogue Compliance Admin Privilege Abuse:** Compromised admin attempts to falsify SACCO verification $\to$ Defended via multi-sig admin review and immutable audit logs.
  4. **RPC / Cloud KMS Network Partition:** Cloud signer partition during high-volume dues collection $\to$ Defended via exponential backoff and persistent retry queues.
  5. **Kenyan Phone Number Rainbow Table Attack:** Attacker attempts to de-anonymize phone numbers $\to$ Defended via HMAC-SHA256 with high-entropy environment peppers (`PAYMENT_PHONE_HASH_PEPPER`).
  6. **WhatsApp SIM Swap Account Takeover:** Attacker swaps SIM to hijack member voting $\to$ Defended via multi-factor SMS/WhatsApp one-time verification.

---

### Stage 5: Microscopic Codebase Impact & Line-by-Line Proof Mapping
* **Objective:** Identify every single file, line range, and function that will change, proving why the change is necessary and that no regressions will occur.
* **The Process:**
  1. Audit active code files across all 5 layers: Database DDL, Domain Math, Serverless APIs, Shared Packages, and Frontend Client.
  2. For every file, document:
     - **File Path & Action Type:** `[NEW]` or `[MODIFY]`.
     - **Current Code Citation:** Exact line numbers from active repository.
     - **Defect / Current Limitation:** Why the current code is insufficient.
     - **Proposed Implementation:** Exact replacement code and interfaces.
  3. Author **`PHASE_PX_CODEBASE_IMPACT_REPORT.md`** and commit locally.

---

### Stage 6: Multi-Tier Verification & Correctness Blueprinting
* **Objective:** Design the testing strategy spanning code automation, mathematical invariant properties, and physical handset validation.
* **The 4 Verification Tiers:**
  - **Tier 1 (Automated Code Suites):** Pure unit tests for math functions and mock API handlers.
  - **Tier 2 (Mathematical Invariant Properties):** Fuzzing tests verifying $\sum \text{Debit} \equiv \sum \text{Credit}$ and integer minor precision.
  - **Tier 3 (Physical Handset Testing Protocol):** The 6-step physical test protocol using real SIM cards per `DevOps Request PDF` §3:
    1. Dynamic group creation on client UI.
    2. Input physical phone number $\to$ pre-transaction fee disclosure displays.
    3. Physical STK Push prompt arrival on handset screen in $<10\text{ seconds}$.
    4. User enters 4-digit PIN $\to$ carrier SMS receipt received.
    5. Untrusted webhook triggers server-initiated `TransactionStatusQuery` (Invariant I2b).
    6. On-chain Soroban attestation minting $\to$ UI unlocks member dashboard.
  - **Tier 4 (Adversarial Security Tests):** Webhook signature forgery rejection, replay attack mitigation, and proxy authentication enforcement.

---

### Stage 7: Unbiased Correctness Audit against Written Standards
* **Objective:** Perform an independent audit of the implementation plan against repository-specific standards (`Baraza-Protocol-Coding-Standards.md`).
* **Checklist of Standards to Verify:**
  - [x] **TypeScript Strict Mode:** `"strict": true` in `tsconfig.json`. Zero `@ts-ignore`, zero `any`.
  - [x] **ESLint Enforcements:** `@typescript-eslint/no-floating-promises` (all promises handled), `no-var`, `eqeqeq`.
  - [x] **Vercel Edge Runtime Standards:** Named / typed exports (`export const config = { runtime: 'edge' }`).
  - [x] **Secrets Isolation (`VITE_` Invariant):** Zero Tier 2+ server secrets in client bundle.
  - [x] **Plain Language UI Rule:** No intimidating Web3 jargon ("community dues", "group account").
  - [x] **Framer Motion Only:** No secondary animation libraries.
  - [x] **Migration Numbering Discipline:** Verify directory listings to ensure non-colliding migration sequence.

---

### Stage 8: Surgical Execution & Layered Coding
* **Objective:** Implement the code in strict dependency order, running unit tests and typecheck at every step.
* **The 5-Layer Implementation Sequence:**
  1. **Layer 1 — Database Schema DDL:** Create migration `supabase/migrations/XXX_*.sql` with integer minor units (`BIGINT NOT NULL DEFAULT 0`) and check constraints.
  2. **Layer 2 — Pure Domain Math Engine:** Create deterministic utility `app/src/lib/payments/feeEngine.ts` and automated unit tests `feeEngine.test.ts`. Run tests immediately.
  3. **Layer 3 — Serverless Edge APIs:** Update intent creation (`create-payment-intent.ts`) with HMAC rate pinning and membership activation (`activate.ts`) with zero-fee bypass.
  4. **Layer 4 — Multi-Rail Ingress:** Wire partner checkout routes (`paystack.ts`, `kotani.ts`) and webhook handlers with HMAC-SHA512/256 signature verification.
  5. **Layer 5 — Frontend Client Pages:** Update `CreateCommunity.tsx` (fee model selector) and `JoinDao.tsx` (itemized pre-transaction fee disclosure card and `"Join Free Community"` instant button).

---

### Stage 9: Real HTTP TCP Network Stress Testing & Database Integration
* **Objective:** Prove that all endpoints work over real HTTP TCP sockets, integrated with a PostgREST database engine and physical SQL migration validation.
* **The Process:**
  1. **Build Real HTTP Test Server:** Mount Edge API handlers into a Node `http.createServer` handling real Web Standard `Request` and `Response` interfaces over local TCP sockets.
  2. **Integrate In-Memory PostgREST Database Engine:** Implement `/rest/v1/*` database routing simulating `communities`, `payment_orders`, `memberships`, and `ledger_entries`, complete with unique constraint violations (code `23505`).
  3. **Execute High-Throughput Stress Tests:**
     - 50-request concurrent burst on payment intent generation.
     - Multi-step 4-stage lifecycle test (Create $\to$ Intent $\to$ Webhook $\to$ Activate).
     - Double-entry balance conservation test across 100 randomized transactions.
     - Invariant I2b zero-trust status query isolation test.
  4. **Physical SQL Migration Parsing:** Read and validate physical `.sql` files for column types and check constraints (`dynamicFeesDatabaseMigration.test.ts`).
  5. **Run Full Workspace Verification:**
     ```bash
     npm test && npx tsc --noEmit && npm run build
     ```
  6. **Local Git Commit & Push Protection:** Commit locally with structured commit messages. **NEVER run `git push` without explicit user permission.**

---

## Playbook Summary Matrix

| Phase Stage | Action Performed | Key Output / Artifact |
|---|---|---|
| **1. Research** | Deep-dive SAD, Holy Grail, Memo 3, DevOps PDFs | Verbatim Citation Wall |
| **2. Concatenation** | Merge all docs into single file | `BACKEND_SCOPE_OF_WORK.md` |
| **3. Decision-Locking**| Confirm 7 architectural choices | Locked Decision Matrix |
| **4. Stress Testing** | Red-team 6 threat vectors | Invariant Defense Matrix |
| **5. Impact Mapping** | File-by-file citations and proofs | `PHASE_P1_CODEBASE_IMPACT_REPORT.md` |
| **6. Verification Plan**| 4-tier code, invariant, and physical tests| Verification Blueprint |
| **7. Correctness Audit**| Audit against repo coding standards | Scorecard (97.8% A+) |
| **8. Surgical Coding** | Implement DDL, math, APIs, Rails, UI | 12 files across 5 layers |
| **9. HTTP Stress** | Real TCP network requests & DB engine | 54 test files, 559 tests green |

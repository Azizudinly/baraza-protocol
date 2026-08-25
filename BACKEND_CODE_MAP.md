# Baraza Protocol — Backend Codebase Map (test-plan branch)

**Branch:** `test-plan`  
**Lead System Architect & Backend Engineer:** Simon Wandera  
**Date:** August 25, 2026  
**Document Purpose:** Complete structural mapping of all smart contracts, serverless API routes, chain adapters, payment state machines, and database migrations.

---

## Table of Contents
1. [Architecture Overview & Boundaries](#1-architecture-overview--boundaries)
2. [Smart Contracts Architecture](#2-smart-contracts-architecture)
3. [Serverless API Layer (`app/api/`)](#3-serverless-api-layer-appapi)
4. [Chain Adapters & Payment Pipeline (`app/src/lib/`)](#4-chain-adapters--payment-pipeline-appsrclib)
5. [Database Schema & Migrations (`supabase/migrations/`)](#5-database-schema--migrations-supabasemigrations)
6. [Conversational Bot & WhatsApp Gateway](#6-conversational-bot--whatsapp-gateway)

---

## 1. Architecture Overview & Boundaries

```mermaid
flowchart TB
    subgraph ClientLayers ["Client Ingress"]
        WebUI["Web Application (React/Vite)"]
        WhatsApp["Evolution WhatsApp Gateway (Port 8080)"]
        USSD["Africa's Talking GSM USSD (*384*XXX#)"]
    end

    subgraph APILayer ["Vercel Serverless Backend (app/api)"]
        StellarAPI["/api/stellar/*"]
        MpesaAPI["/api/mpesa/*"]
        WebhookAPI["/api/webhooks/*"]
        CronAPI["/api/cron/*"]
        IdentityAPI["/api/identity/*"]
        CommunityAPI["/api/communities/*"]
    end

    subgraph CoreLibs ["Backend Domain Libraries (app/src/lib)"]
        Adapters["Chain Adapters (Stellar, Base, Solana)"]
        StateMachine["Daraja/Kotani Payment State Machine"]
        PrivyMPC["Privy MPC / Phone Auth Bridge"]
    end

    subgraph DatabaseLayer ["Supabase PostgreSQL (af-south-1)"]
        Ledger["ledger_entries (Double-Entry)"]
        Orders["payment_orders (Finite State Machine)"]
        Communities["communities & memberships"]
        Proposals["proposals & votes"]
    end

    subgraph SettlementLayer ["Stellar Soroban (Launch Chain)"]
        CRegistry["community_registry.wasm"]
        CMembership["membership.wasm"]
        CGovernance["governance.wasm"]
        CVault["treasury_vault.wasm (M-of-N Multisig)"]
        CAttest["payment_attestation.wasm (2-of-N Service Signer)"]
    end

    WebUI --> APILayer
    WhatsApp --> WebhookAPI
    USSD --> APILayer
    APILayer --> CoreLibs
    CoreLibs --> DatabaseLayer
    CoreLibs --> SettlementLayer
```

---

## 2. Smart Contracts Architecture

### 2.1 Stellar Soroban Suite (`contracts/stellar/`)
Compiled to WebAssembly (`wasm32-unknown-unknown`) targeting Stellar Soroban Protocol 20+:

| Contract Directory | Module / Purpose | Invariants & Authorization |
| :--- | :--- | :--- |
| **`community_registry/`** | `src/lib.rs` — Manages community registration, chain designation, and metadata. | `register()` rejects duplicate community IDs; authoritative for group existence. |
| **`membership/`** | `src/lib.rs` — Manages active member rosters, public keys, and count getters. | `join()` enforces single-record presence; `leave()` decrements count safely. |
| **`governance/`** | `src/lib.rs` — Manages proposal creation, voting duration, and binary vote counting. | Enforces positive voting power; prevents double-voting; ties resolve to `Tied` (non-executable). |
| **`treasury_vault/`** | `src/lib.rs` — Manages pooled funds and M-of-N native multisig execution. | Enforces $M \le N$ threshold; requires explicit signer approval (`__check_auth`); prevents double-execution. |
| **`payment_attestation/`**| `src/lib.rs` — Mints cryptographic on-chain receipts for verified fiat payments. | Enforces 2-of-N multisig service writer authorization; deduplicates payment references. |

### 2.2 Base EVM & Aragon OSx Contracts (`contracts/evm/`)
Targeting Base Mainnet (`8453`) and Base Sepolia (`84532`):
- **`Manager.sol` (`0x3ac0e64fe2931f8e082c6bb29283540de9b5371c`):** Factory contract deploying DAO instances.
- **`Gov.sol` / `Token.sol`:** Timelocked governance governor and non-transferable Soulbound voting token.

### 2.3 Solana Anchor Contracts (`contracts/solana/`)
- Frozen/paused state (ADR-002) pending Phase 2 re-activation for high-frequency micro-voting.

---

## 3. Serverless API Layer (`app/api/`)

The repository contains 26 serverless routes running under Vercel Edge / Node.js runtimes:

### 3.1 Payment & Settlement Routes
1. **`api/stellar/create-payment-intent.ts`:**
   - **Method:** `POST` | **Runtime:** `nodejs`
   - **Function:** Signs an HMAC-SHA256 payment intent token using `STELLAR_INTENT_SECRET`; creates `payment_orders` record in `PENDING` state.
2. **`api/stellar/verify-payment.ts`:**
   - **Method:** `POST` | **Runtime:** `nodejs`
   - **Function:** Cross-checks payment order state against Soroban `payment_attestation` contract.
3. **`api/mpesa/transaction-status.ts`:**
   - **Method:** `POST` | **Runtime:** `nodejs`
   - **Function:** Initiates independent Safaricom Daraja Transaction Status Query (Invariant I2b) using Initiator Security Credentials; advances order state to `STATUS_QUERY_SENT`.
4. **`api/mpesa/status-result.ts`:**
   - **Method:** `POST` | **Runtime:** `nodejs`
   - **Function:** Asynchronous callback handler for Daraja status queries. Authenticated via `MPESA_STATUS_RESULT_PATH_SECRET` and CIDR IP validation (`196.201.214.0/24`, `196.201.213.0/24`, `196.13.100.0/24`). Advances state to `ATTESTATION_SUBMITTED` upon `ResultCode === 0`.
5. **`api/mpesa/status-timeout.ts`:**
   - **Method:** `POST` | **Runtime:** `nodejs`
   - **Function:** Handles query timeouts from Safaricom; schedules retry or escalates order.
6. **`api/mpesa/simulate.ts`:**
   - **Method:** `POST` | **Runtime:** `nodejs`
   - **Function:** Development-only STK simulator. Explicitly disabled in production (`MPESA_SIMULATOR_ENABLED=false`).
7. **`api/payments/kotani.ts` & `api/payments/minisend.ts`:**
   - **Method:** `POST` | **Runtime:** `nodejs`
   - **Function:** Proxy dispatchers for partner mobile money rails.
8. **`api/payments/brza-membership.ts` & `reconcile-brza-membership.ts`:**
   - **Method:** `POST` | **Runtime:** `nodejs`
   - **Function:** Manages BRZA token membership fee calculations and settlement.

### 3.2 Webhook Ingress Routes
9. **`api/webhooks/africastalking.ts`:**
   - **Method:** `POST` | **Runtime:** `edge`
   - **Function:** Ingress for Africa's Talking SMS notifications and USSD session steps.
10. **`api/webhooks/kotani.ts`:**
    - **Method:** `POST` | **Runtime:** `nodejs`
    - **Function:** Ingress for Kotani Pay payment completion callbacks.

### 3.3 Reconciliation & Background Tasks (`api/cron/`)
11. **`api/cron/promote-orders.ts`:**
    - **Method:** `GET` / `POST` | **Runtime:** `nodejs` | **Auth:** `CRON_SECRET`
    - **Function:** Scans `payment_orders` in `STATUS_QUERY_SENT` / `ATTESTATION_SUBMITTED` and executes on-chain attestations via `stellar-mint.ts`.
12. **`api/cron/settle-retro-allocations.ts`:**
    - **Method:** `GET` / `POST` | **Runtime:** `nodejs` | **Auth:** `CRON_SECRET`
    - **Function:** Settles periodic community retro-funding rounds.

### 3.4 Community & Identity Routes
13. **`api/communities/index.ts`:** List/create community records.
14. **`api/communities/retro-rounds.ts`, `retro-ballot.ts`, `retro-allocations.ts`, `retro-settle.ts`:** Quadratic retro-funding allocations.
15. **`api/identity/initiate-claim.ts` & `verify-claim.ts`:** Identity verification handshakes.
16. **`api/membership/activate.ts`:** Direct membership activation gate.
17. **`api/payment-orders/status.ts`, `streak.ts`, `streak-batch.ts`:** Member contribution streak counters.
18. **`api/ussd/index.ts`:** USSD text session state machine.
19. **`api/agent/chat.ts` & `api/akili/filings.ts`:** AI guidance engine proxy.

---

## 4. Chain Adapters & Payment Pipeline (`app/src/lib/`)

### 4.1 Polymorphic Chain Adapters (`app/src/lib/adapters/`)
- **`IChainAdapter.ts`:** Standard TypeScript interface for `createCommunity()`, `registerMember()`, `createProposal()`, `castVote()`, `initTreasury()`, `executeTreasury()`.
- **`StellarAdapter.ts`:** Concrete implementation invoking Soroban contracts via `@stellar/stellar-sdk` and RPC clients.
- **`BaseAdapter.ts`:** EVM implementation interacting with Aragon OSx contracts via `ethers` / `viem`.
- **`SolanaAdapter.ts`:** Anchor RPC client (stubbed/paused).

### 4.2 Payment State Machine (`app/src/lib/payments/`)
- **`daraja.ts`:** Safaricom Daraja OAuth client, STK Push dispatcher, and Transaction Status Query builder.
- **`state-machine.ts`:** Enforces the 5-state lifecycle:
  $$\text{PENDING} \longrightarrow \text{PROVIDER\_CONFIRMED} \longrightarrow \text{STATUS\_QUERY\_SENT} \longrightarrow \text{ATTESTATION\_SUBMITTED} \longrightarrow \text{MEMBERSHIP\_ACTIVE}$$
- **`idempotency.ts`:** Computes deterministic SHA256 idempotency keys.

---

## 5. Database Schema & Migrations (`supabase/migrations/`)

| Migration File | Key Schema Elements & Tables Managed |
| :--- | :--- |
| **`001_communities_governance_columns.sql`** | Adds `governance_type`, `voting_duration`, and chain designation to `communities`. |
| **`002_payment_orders.sql`** | Creates `payment_orders` table with state enums, amounts, currency, and provider references. |
| **`003_payment_attestations.sql`** | Creates `payment_attestations` recording on-chain transaction hashes. |
| **`004_memberships.sql`** | Creates `memberships` table linking `user_id`, `community_id`, and `role`. |
| **`005_stellar_settlements.sql`** | Stores Stellar transaction hashes, ledger sequence numbers, and stroop amounts. |
| **`006_bounties_security_stellar.sql`** | Manages community bounty vaults and security controls. |
| **`007_enable_evm_community_rails.sql`** | Adds EVM contract address columns to communities. |
| **`008_bounty_access_reward_token.sql`** | Configures token distribution rewards for bounties. |
| **`009_membership_payment_order_unique.sql`** | Unique constraint ensuring one active payment order per membership cycle. |
| **`010_proposals_votes_schema_gaps.sql`** | DDL for `proposals` and `votes` tables with quorum calculations. |
| **`011_fix_payment_orders_rls.sql`** | Secures `payment_orders` with Supabase Row-Level Security. |
| **`012_communities_rls.sql`** | Enforces RLS on `communities` (public read, admin write). |
| **`013_votes_block_migration_double_vote.sql`** | Unique constraint `(proposal_id, voter_address)` blocking double-votes. |
| **`014_votes_lock_migration_chain.sql`** | Locks votes to the designated community blockchain network. |
| **`016_votes_weight_positive_check.sql`** | Check constraint ensuring `voting_weight > 0`. |
| **`017_payment_orders_metadata.sql`** | JSONB metadata field on `payment_orders` for provider debug logs. |
| **`018_ussd_monitoring.sql`** | Logs USSD session performance and drop-off metrics. |
| **`019_retro_rounds.sql` – `021_retro_rounds_opened_by.sql`** | Quadratic retro-funding round management. |
| **`022_identity_links.sql`** | Maps Privy DID identifiers to hashed phone numbers. |
| **`023_payment_orders_add_status_query_states.sql`** | Adds `STATUS_QUERY_SENT` and `ATTESTATION_SUBMITTED` to order status enums. |
| **`026_leverage_foundation.sql`** | Financial leverage and credit scoring data models. |

---

## 6. Conversational Bot & WhatsApp Gateway

- **Evolution API Integration:** Runs in a separate Docker container stack (`evolution-api/`) with PostgreSQL and Redis.
- **Bot FSM Engine:** Pure TypeScript decision function `processTurn()` decoupled from I/O messaging transports (ADR-007).

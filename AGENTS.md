# Baraza Protocol — AI Agent Instructions

## What this repo is

Baraza is a community finance and governance protocol for African groups. Communities pool funds in **Stellar treasury accounts**, pay membership dues in XLM or KES via M-Pesa, and govern shared resources through on-chain proposals and votes. The native token is **BRZA** — a Stellar custom asset.

**Layer summary:**
- **Stellar** — primary settlement layer. All treasuries are Stellar G-accounts. BRZA is a Stellar custom asset. All payment rails (M-Pesa, XLM direct) settle to a community Stellar treasury address.
- **Solana** — governance layer. Five Anchor programs handle community registry, membership tiers, proposals, votes, payment attestation, and treasury vault logic.
- **EVM** — secondary governance token (ERC-721) on Ethereum, Base, Optimism, Arbitrum, Celo, Sepolia. Read-only for now.
- **Supabase** — off-chain persistence for payment orders, memberships, and admin state. Always optional — every route falls back gracefully when env vars are absent.

---

## BRZA Token

- **Type:** Stellar custom asset
- **Supply:** 1,000,000,000 (1B), 7 decimals
- **Issuer:** `VITE_BRZA_ISSUER_ADDRESS` (Stellar G-account)
- **Distributor:** `VITE_BRZA_DISTRIBUTOR_ADDRESS` (Stellar G-account)
- **Config:** `app/src/lib/brza/constants.ts` — all values are `as const`, never mutate at runtime
- **Treasury reader:** `app/src/lib/brza/treasury.ts`
- **TVL reader:** `app/src/lib/brza/tvl.ts`

BRZA is separate from supported payment rails. Do not conflate "paying in BRZA" with "paying via Stellar XLM." Public pricing and distribution details are intentionally omitted from repo docs pending counsel review.

---

## Payment Flow (source of truth)

### Stellar XLM path

```
Client calls POST /api/stellar/create-payment-intent
  -> Server signs HMAC intent token (communityId + amountXlm + expiresAt) using STELLAR_INTENT_SECRET
  -> Returns intentToken to client

User sends XLM on Stellar network

Client calls POST /api/stellar/verify-payment { txHash, intentToken, environment }
  -> Server verifies HMAC token (required on mainnet; legacy fields allowed on testnet only)
  -> Fetches tx from Horizon, checks: successful, native payment, amount >= expected, to == treasury
  -> Writes payment_orders row (status: PAYMENT_CONFIRMED, provider: stellar)
  -> Returns { orderId, activationSecret, status: PAYMENT_CONFIRMED }

Cron /api/cron/promote-orders advances: PAYMENT_CONFIRMED → MINT_QUEUED → MINT_SUBMITTED
  → MINT_CONFIRMED → INDEXER_CONFIRMED → RECONCILED (one step per minute, demo mode)

Client polls /api/payment-orders/status until INDEXER_CONFIRMED or RECONCILED

Client calls POST /api/membership/activate { orderId, communityId, walletAddress, activationSecret }
  -> Server verifies: order exists, status ∈ {INDEXER_CONFIRMED, RECONCILED},
     activationSecret hash matches, walletAddress not bound to another order
  -> Writes memberships row (status: ACTIVE)
  -> Returns { ok: true, memberId }
```

### M-Pesa (Kotani Pay KES→XLM onramp) path

```
Trusted server-to-server call: POST /api/payments/brza-membership
  (requires Authorization: Bearer PAYMENT_ADAPTER_PROXY_SECRET)
  { phone, communityId, communityCode, communityTreasuryAddress, amountKes, idempotencyKey }
  -> Idempotency check (no double-charge)
  -> Writes payment_orders row (status: CREATED, provider: kotani)
  -> Calls Kotani POST /v1/onramp/stellar — KES → XLM to communityTreasuryAddress
  -> Updates order: status PAYMENT_PENDING, provider_reference = Kotani reference
  -> Returns { orderId, activationSecret, providerReference, status: PAYMENT_PENDING }

Polling: POST /api/payments/reconcile-brza-membership { orderId }
  -> Fetches Kotani GET /v1/status/:reference
  -> Maps Kotani status → internal status (completed → PAYMENT_CONFIRMED, failed/expired → terminal)
  -> Patches payment_orders row
  -> Returns { orderId, status, changed }

After PAYMENT_CONFIRMED, same cron promoter and membership/activate as Stellar path above.
```

### Payment order status machine

```
CREATED → PAYMENT_PENDING → PAYMENT_CONFIRMED → MINT_QUEUED → MINT_SUBMITTED
  → MINT_CONFIRMED → INDEXER_CONFIRMED → RECONCILED   ← activation fires here or at INDEXER_CONFIRMED

Terminal failure states: PAYMENT_FAILED, PAYMENT_EXPIRED, AMOUNT_MISMATCH
```

**Cron promoter (`/api/cron/promote-orders`) is a demo step-counter.** Production must replace it with real BRZA mint + Stellar indexer confirmation before the INDEXER_CONFIRMED gate.

---

## API Routes

```
POST /api/stellar/create-payment-intent    Sign HMAC intent token (server-only)
POST /api/stellar/verify-payment           Verify XLM tx against Horizon, create order
POST /api/payments/brza-membership         Initiate M-Pesa Kotani onramp order (server-to-server)
POST /api/payments/reconcile-brza-membership  Poll Kotani for order status update
GET  /api/payment-orders/status            Client polls order status by orderId
POST /api/membership/activate              Gate-check + write membership to Supabase
POST /api/payments/kotani                  Low-level Kotani proxy
POST /api/payments/minisend                Low-level Minisend proxy
POST /api/cron/promote-orders              Advance orders one step (cron, requires CRON_SECRET)
```

---

## Frontend Routes

```
/                          Homepage
/communities               Browse DAOs (Explore)
/create                    Create new community
/join/:id                  Join a community (payment flow)
/join/:id/status           Payment status poller
/dashboard/:id             Community dashboard
/dashboard/:id/decisions/create   Create proposal
/dashboard/:id/decisions/:decisionId  Proposal detail + voting
/dashboard/:id/treasury    Treasury detail
/bounties                  Bounty board
/bounties/:bountyId        Bounty detail
/evaluate                  DAO best-practice checklist
/profile                   User profile
/admin                     Admin reconciliation (wallet-gated)
```

---

## Repo Layout

```
app/                    Vite + React (TypeScript, Tailwind, Node 24)
  src/
    components/         UI components
    hooks/              React hooks (useBarazaContract, useBarazaData, useChain, …)
    lib/                All business logic — no UI here
      adapters/         Chain adapters: solana.ts, stellar.ts, evm.ts, celo.ts, kotani.ts, minisend.ts
      brza/             BRZA token constants, treasury reader, TVL reader
      chains/           Chain config and constants
      programs/         Anchor IDLs, PDA helpers, Solana client
      gooddollar/       G$ SDK, identity, token
      tokens/           Community token and umbrella token logic
      wallet/           MPC wallet (Privy) helpers
    pages/              Route-level page components
    types/              Shared TypeScript types (index.ts)
  api/
    stellar/            create-payment-intent.ts, verify-payment.ts
    payments/           brza-membership.ts, reconcile-brza-membership.ts, kotani.ts, minisend.ts
    membership/         activate.ts
    payment-orders/     status.ts
    cron/               promote-orders.ts

programs/               Five Anchor/Solana programs (Rust)
  community_registry/
  governance/
  membership/
  payment_attestation/
  treasury_vault/

contracts/evm/          ERC-721 governance token (Solidity, Forge)
supabase/migrations/    SQL migrations — run in filename order
docs/                   KNOWLEDGE_GRAPH.md, TESTNET_CONTRACT_API_REVIEW.md
Anchor.toml             Cluster: localnet (change to devnet for deployment)
```

---

## Architecture Rules

- **All business logic lives in `app/src/lib/`** — components call hooks; hooks call lib functions. Never import lib directly in components.
- **Chain adapters are the single entry point** for all chain interactions. Do not call Solana/Stellar/EVM SDKs directly from hooks or components.
- **Wallet support is restricted to Phantom, Solflare, and Coinbase Wallet** via `BarazaWalletModalProvider`. Do not add other wallets.
- **`app/src/lib/knowledgeGraph.ts`** must be updated whenever a new chain rail, contract address, settlement route, or testnet readiness task is added.
- **BRZA config** is `as const` in `app/src/lib/brza/constants.ts`. Do not mutate at runtime.
- **Supabase is optional everywhere.** Every API route must work without Supabase env vars (fall back to local state gracefully).
- **No fallback program IDs in production.** `app/src/lib/programs/pda.ts` uses `PLACEHOLDER_CONTRACT_ADDRESS` as a dev fallback — replace with real Vercel env vars before production.
- **intentToken is required for Stellar mainnet.** Legacy `communityId` + `amountXlm` fields in `verify-payment` are testnet-only. Do not relax this gate.
- **Activation secret must be kept client-side** from the moment the payment order is created until membership activation. It is never re-exposed by the server.
- **Chain names must NOT appear in UI** except on the onboarding screen and withdrawal screen. Everywhere else users see KES balance, a pay button, and a vote button — never "Stellar", "Solana", "Base", or any other chain name.
- **GOODDOLLAR_ENABLED must remain false** in all committed code. GoodDollar/Celo is a scaffold for later. Do not set it to true or make it configurable from the frontend.
- **`/lib/adapters/index.ts` is the only permitted entry point** for chain interactions. No component, hook, or API route may import Stellar SDK, Solana web3.js, or viem directly — always through the adapter layer.
- **Loan terms are hardcoded** — 50% LTV, 5% APR, 12-month term. These values are in `app/src/lib/brza/constants.ts` (`LOAN_TERMS`) and must never be made configurable or overridden.

---

## Environment Variables

Frontend vars are prefixed `VITE_`. Server-only vars have no prefix. See `.env.example` at repo root.

```
# Stellar (primary chain)
VITE_STELLAR_NETWORK          testnet | mainnet
VITE_STELLAR_HORIZON_URL      client-side Horizon URL
STELLAR_NETWORK               server-side network
STELLAR_HORIZON_URL           server-side Horizon URL
STELLAR_TREASURY_ACCOUNT      community treasury G-account (required for mainnet verification)
STELLAR_INTENT_SECRET         HMAC key for signing payment intent tokens (required on mainnet)

# BRZA token
VITE_BRZA_ISSUER_ADDRESS      Stellar issuer G-account
VITE_BRZA_DISTRIBUTOR_ADDRESS Stellar distributor G-account

# M-Pesa / Kotani
KOTANI_PAY_API_KEY            server-only
KOTANI_API_BASE               default: https://api.kotanipay.com
PAYMENT_ADAPTER_PROXY_SECRET  server-only, Bearer token for trusted server calls to /api/payments/*
PAYMENT_PHONE_HASH_PEPPER     server-only, HMAC pepper for phone number hashing

# Supabase
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_URL                  server-only
SUPABASE_SERVICE_ROLE_KEY     server-only

# Cron
CRON_SECRET                   auth header for /api/cron/promote-orders

# Solana (governance layer)
VITE_SOLANA_NETWORK           devnet | mainnet-beta
VITE_RPC_ENDPOINT             Solana RPC URL
VITE_COMMUNITY_REGISTRY_PROGRAM_ID
VITE_GOVERNANCE_PROGRAM_ID
VITE_MEMBERSHIP_PROGRAM_ID
VITE_PAYMENT_ATTESTATION_PROGRAM_ID
VITE_TREASURY_VAULT_PROGRAM_ID
```

---

## Commands

```bash
# Frontend (Node 24)
cd app
npm run dev          # dev server :5173
npm run build
npm run typecheck    # tsc --noEmit
npm run lint
npm run test         # vitest run — 231 tests, all must pass
npm run test:watch

# Solana programs
cargo test --workspace
anchor build
anchor deploy --provider.cluster devnet

# EVM contracts
cd contracts/evm
forge build
forge test
```

---

## Testnet Status

| Chain | Status | Blocker |
|---|---|---|
| Stellar | testnet-ready | Fund treasury G-account, set `STELLAR_TREASURY_ACCOUNT` |
| Solana | partial | `solana` CLI missing from PATH; Anchor.toml targets localnet |
| Celo/GoodDollar | coming-soon | Need Alfajores token/identity addresses |
| EVM | partial | All contract addresses are placeholders |

---

## Hard Production Blockers

Do not enable treasury withdrawals or move to mainnet until these are done:

1. **Cron promoter** (`/api/cron/promote-orders`) is a demo step-counter — replace with real BRZA mint + Stellar indexer confirmation. Without this, `INDEXER_CONFIRMED` never fires on real payments.
2. **Governance → treasury CPI** (`programs/governance/src/lib.rs`) — rule changes and membership actions are wired but TODO. Must be completed and tested before treasury release is enabled.
3. **Treasury vault release authority** (`programs/treasury_vault/src/lib.rs`) — hand release authority to a Squads vault PDA and test on devnet before setting `withdrawals_enabled = true`.
4. **`user_id_hash` in membership activate** — currently stores `wallet:<address>` as a placeholder. Production must replace with the HMAC-peppered phone hash from auth.
5. **Solana `payment_attestation::attest_payment`** — Supabase payment orders are not yet wired to the on-chain attestation program. Wire this before treating on-chain membership as canonical.
6. Run all Supabase migrations (`supabase/migrations/`) in filename order before any durable payment flow.

---

## Do Not

- Do not change the wallet adapter list (Phantom, Solflare, Coinbase only)
- Do not add Magic UI or other heavy animation libraries — removed deliberately
- Do not add features beyond what the current task requires
- Do not set `withdrawals_enabled = true` on the treasury vault until blockers above are cleared
- Do not commit real private keys, seed phrases, or service role secrets
- Do not import files from another repo with logic changes — copy verbatim
- Do not relax the intentToken requirement for Stellar mainnet payments
- Do not bypass the activation secret gate in `/api/membership/activate`

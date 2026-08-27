# Baraza — Next Steps PRD

**Date:** 2026-06-03  
**Branch:** feat/brza-core  
**Status:** 231/231 tests passing. Soroban contracts written. EVM governance client wired. Payment rails active. No production deployment yet.

---

## Current State Summary

What is done and tested:

| Area | Status |
|---|---|
| Stellar verify-payment API + intent tokens | Done |
| M-Pesa → Kotani → BRZA payment adapters | Done |
| Africa's Talking + Kotani webhook receivers | Done |
| Payment order state machine (promote-orders cron) | Done |
| Membership activate + payment-orders/status APIs | Done |
| 5 Soroban contracts (Rust, tested locally) | Written, not deployed |
| Stellar TypeScript contract clients | Done |
| EVM governance client for Base (GOVERNOR_ABI, TOKEN_ABI) | Done |
| Security hardening (timing-safe, HMAC, cron auth, intent tokens) | Done |
| BRZA token constants, treasury, TVL tracker | Done |
| All 231 unit tests | Passing |

What is missing before a first real user can do anything:

- No Supabase tables exist for `payment_orders`, `memberships`, `proposals`, `votes`
- No Soroban contracts deployed (testnet or mainnet)
- No Base chain governance contracts deployed
- No Helius or Stellar event indexing
- No Vercel production environment configured
- The community creation, join, proposal, and vote UI flows all write to mock/localStorage state

---

## Phase 0 — Foundation (Blocker for everything else)

These must be done before any other phase can be tested end-to-end.

### 0.1 Supabase Schema

Apply the canonical schema to the Supabase project. The schema must cover:

**Tables required:**

```
communities
  id uuid PK
  name text
  slug text UNIQUE
  description text
  chain text  -- 'stellar' | 'solana' | 'base'
  treasury_address text
  governor_address text    -- on-chain governor (Base: bytes32 deployer, Stellar: contract ID)
  token_address text       -- on-chain token
  quorum_pct int
  approval_threshold_pct int
  membership_fee numeric   -- canonical fee column (migration 010 deliberately does NOT add membership_fee_kes)
  created_at timestamptz
  created_by text          -- wallet address of the creator (matches proposals.created_by)

memberships
  id uuid PK
  community_id uuid REFERENCES communities
  user_id uuid REFERENCES users
  wallet_address text
  phone_hash text
  tier text
  status text  -- 'pending' | 'active' | 'suspended' | 'revoked'
  voting_weight int DEFAULT 1
  joined_at timestamptz
  nft_mint_address text    -- Solana NFT or Base ERC721 token ID
  on_chain_attested bool DEFAULT false

payment_orders
  id uuid PK
  community_id uuid
  user_id uuid
  provider text            -- 'africastalking' | 'kotani' | 'stellar' | 'solana_pay'
  provider_reference text  -- provider's transaction ID
  status text              -- follows 10-state machine in PRD §10
  amount_kes numeric
  amount_xlm numeric
  brza_allocated numeric
  activation_secret_hash text
  intent_token_hash text   -- sha256 of the HMAC intent token; the raw bearer is never stored (migration 010)
  user_id_hash text        -- HMAC of wallet address
  created_at timestamptz
  updated_at timestamptz

proposals
  id uuid PK
  community_id uuid
  title text
  description text
  kind text
  status text              -- 'draft' | 'pending' | 'active' | 'passed' | 'failed' | 'queued' | 'executed' | 'cancelled'
  on_chain_proposal_id text  -- bytes32 (Base) or Soroban key (Stellar)
  chain text
  created_by text            -- wallet address of the proposer (migration 010)
  starts_at timestamptz
  ends_at timestamptz
  for_votes int DEFAULT 0
  against_votes int DEFAULT 0
  abstain_votes int DEFAULT 0
  created_at timestamptz

votes
  id uuid PK
  proposal_id uuid REFERENCES proposals
  member_id uuid REFERENCES memberships
  option text              -- 'yes' | 'no' | 'abstain'
  weight int
  tx_hash text
  cast_at timestamptz

bounties
  (already partially defined — finalize)
```

**Row-Level Security:** Enable RLS on all tables. Members can read their community's rows. Only service role writes payment_orders and memberships on server-side flows.

**Acceptance:** `supabase db push` runs clean. All server API routes that reference Supabase can perform their reads/writes without error.

### 0.2 Environment Variables — Vercel Production

Set in Vercel dashboard (Settings → Environment Variables, Production environment):

**Required for payment flows:**
- `STELLAR_NETWORK=mainnet`
- `STELLAR_HORIZON_URL`
- `STELLAR_TREASURY_ACCOUNT`
- `STELLAR_INTENT_SECRET` (32+ byte random)
- `BRZA_ISSUER_ADDRESS`
- `BRZA_DISTRIBUTOR_ADDRESS`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYMENT_ADAPTER_PROXY_SECRET`
- `PAYMENT_PHONE_HASH_PEPPER`
- `KOTANI_PAY_API_KEY`
- `KOTANI_WEBHOOK_SECRET`
- `AT_USERNAME`
- `AT_API_KEY`
- `CRON_SECRET`

**Required for client:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STELLAR_NETWORK=mainnet`
- `VITE_STELLAR_HORIZON_URL`
- `VITE_STELLAR_NETWORK_PASSPHRASE`
- `VITE_STELLAR_TREASURY_ACCOUNT`
- `VITE_BRZA_ISSUER_ADDRESS`

**Acceptance:** `vercel env pull .env.local` produces a working `.env.local`. `npm run dev` renders the app without console errors on env validation.

---

## Phase 1 — Testnet E2E Payment Loop

**Goal:** One real user can join a community and have their membership activated, starting from M-Pesa, ending in an active Supabase membership record and a Soroban on-chain attestation.

### 1.1 Confirm Solana Program Deployments

The Anchor programs are deployed at fixed addresses (already set as defaults in `src/lib/programs/pda.ts`):

| Program | Address |
|---|---|
| Community Registry | `Ggj4e8YjiDdpbcudKz6BLx5arT9nf7BQR498VnLXd7eD` |
| Governance | `DzMhDFtq2s2bUn4LNDVzDLLnbbRQ8jW1FKeWPQDDq25A` |
| Membership | `34MQRw2XSScvMYTiyYLix31qnrmh9vARwpmXM6ycNtuK` |
| Payment Attestation | `Az2CdHJFBLxRY6pigkYSsni6A8N1dQo3JUp3d62NGVpT` |
| Treasury Vault | `ApPdkfooQLdVN8gAXRnddbtttruYNihiwjanYtXUnxYy` |

These are devnet addresses. Before mainnet launch, confirm they are also deployed on mainnet-beta and update the defaults in `pda.ts`.

**Acceptance:** `solana program show DzMhDFtq2s2bUn4LNDVzDLLnbbRQ8jW1FKeWPQDDq25A --url devnet` returns the program account without error.

### 1.2 Wire Community Creation to Supabase

`CreateCommunity.tsx` currently writes to localStorage. Replace with:

1. POST to a new API route `POST /api/communities` (server-side, service role)
2. Insert row into `communities` table
3. If chain is `stellar`: call `community_registry.register()` via the Soroban client
4. Return the new community ID and navigate to `/dashboard/:id`

**Acceptance:** Create a community → it appears in Supabase → refreshing the page preserves it.

### 1.3 Wire Join Flow to Real Payment Orders

`JoinDao.tsx` already calls `create-payment-intent` and `verify-payment`. What's missing:

1. `verify-payment.ts` must write a `payment_orders` row to Supabase on PAYMENT_CONFIRMED (currently it returns `persisted: false`)
2. Add `persistOrder()` implementation: insert with status=PAYMENT_CONFIRMED, amount, user_id_hash, intent details
3. After persist: call `payment_attestation.attest()` (Soroban) — best-effort, non-blocking
4. `promote-orders.ts` cron must handle PAYMENT_CONFIRMED → activate membership:
   - Insert/update row in `memberships` with `status='active'`
   - Call `membership.activate()` on the Soroban contract

**Acceptance:** Pay via Stellar testnet → row appears in `payment_orders` → cron promotes it → row appears in `memberships` with `status='active'` → member can see their community dashboard.

### 1.4 Activate M-Pesa Webhook Flow (AT Sandbox)

1. Register the Vercel preview URL as the Africa's Talking callback:  
   `MPESA_CALLBACK_URL=https://your-preview.vercel.app/api/webhooks/africastalking`
2. Run a sandbox STK push via AT sandbox dashboard
3. Verify `payment_orders` row is created and promoted by cron

**Acceptance:** AT sandbox webhook updates payment_orders status. Cron promotes to membership.

---

## Phase 2 — Governance (Proposal + Vote)

**Goal:** An active member can create a proposal and cast a vote that is durably recorded.

### 2.1 Proposal Creation API

New route: `POST /api/proposals`

- Auth: verify the caller holds an active membership in the target community (check `memberships` table)
- Insert into `proposals` table with `status='pending'`
- If chain is `stellar`: call `governance.create_proposal()` on Soroban, store the returned proposal key in `on_chain_proposal_id`
- Return the new proposal ID

`ProposalDetail.tsx` → show real data from Supabase, not mock.

### 2.2 Vote Casting API

New route: `POST /api/proposals/:id/vote`

- Auth: verify active membership
- Check no existing vote for this member on this proposal (idempotent)
- Insert into `votes` table
- Update `proposals.for_votes / against_votes / abstain_votes` (or compute from votes table)
- If chain is `stellar`: call `governance.vote()` on Soroban (best-effort, non-blocking)
- If chain is `base`: do NOT sign on-chain here — the client must call `castBaseGovernorVote()` directly with the user's connected wallet. Record the returned txHash.

### 2.3 Proposal ID Bridge (Base chain)

On-chain Base proposals have a `bytes32` ID (hash of targets + values + calldatas + descriptionHash). Baraza proposals have a Supabase UUID. These must be linked.

When a Base community creates a proposal:
1. The client calls `Governor.propose()` (or we provide a `POST /api/proposals` route that does it server-side)
2. The returned `bytes32 proposalId` is stored in `proposals.on_chain_proposal_id`
3. `castBaseGovernorVote()` in `base-governance.ts` is called with this `on_chain_proposal_id`

### 2.4 Proposal State Sync Cron

Add a second cron job `GET /api/cron/sync-proposals` (runs every 15 min):

For active Base proposals:
- Call `governor.state(on_chain_proposal_id)` via viem
- Map ProposalState via `ozStateToBaraza()`
- Update `proposals.status` in Supabase if changed

For active Stellar proposals:
- Call `governance.get_proposal()` via Soroban client
- Map state and update Supabase

**Acceptance:** A proposal created on Base → its status in the Baraza UI reflects the actual on-chain state after the cron runs.

---

## Phase 3 — Base Chain DAO (EVM Communities)

**Goal:** A founder can deploy a Baraza DAO on Base using the governance contracts, and members can join via NFT mint.

### 3.1 Deploy a Baraza Community DAO via Manager

Baraza has not deployed its own Manager factory on Base yet — deploy it via the Foundry scripts in `contracts/evm/script/`, then record the address in `src/lib/evm/manager.ts` and set:

```
VITE_BASE_MANAGER_ADDRESS=<manager>
```

Call `deployDao()` from `src/lib/evm/manager.ts` with the founder's connected wallet. The Manager will deploy Token + MetadataRenderer + Auction + Treasury + Governor as a single transaction and return all five addresses.

Store the returned addresses in the community record in Supabase and set:
```
VITE_BASE_GOVERNOR_ADDRESS=<governor>
VITE_BASE_TOKEN_ADDRESS=<token>
VITE_BASE_TREASURY_ADDRESS=<treasury>
```

Set `VITE_BASE_TESTNET=true` to use Sepolia automatically.

**Acceptance:** After `deployDao()` confirms, call `getDaoAddresses(tokenAddress)` — all five contract addresses are returned. `governor.state(dummyProposalId)` returns ProposalState 0 (Pending).

### 3.2 NFT Membership Mint on Base

For Base communities, membership is represented by holding an ERC721 token (the governance Token contract).

The join flow for Base:
1. Founder configures: membership = hold ≥ 1 governance NFT
2. Member pays via M-Pesa → Kotani → Stellar (BRZA allocated)  
   OR member connects MetaMask / Coinbase Wallet and buys via the Auction contract
3. After confirmed payment: server mints NFT to member's wallet address via the Token contract (using a relayer wallet with minting rights)
4. `membership.verify({ accountAddress })` in the EVM adapter calls `balanceOf` — returns `true` if NFT balance > 0

### 3.3 Community Creation Wizard — Base Path

Extend `CreateCommunity.tsx` to support a "Base chain" option:

1. Collect governance parameters (voting delay, period, quorum)
2. Client calls `POST /api/communities/deploy-base` (server-side)
3. Server calls `Manager.deploy()` via ethers.js using a funded deployer wallet
4. Store all 5 returned contract addresses in the community record

---

## Phase 4 — Production Hardening

### 4.1 Rate Limiting

Add rate limiting middleware to all public API routes:
- `/api/stellar/create-payment-intent`: 5 req/min per IP
- `/api/stellar/verify-payment`: 10 req/min per IP
- `/api/webhooks/*`: 100 req/min (provider IPs only, if AT/Kotani publish allowlists)

Use Vercel's built-in rate limiting or a Redis-backed counter (Upstash).

### 4.2 Helius Webhook (Solana Event Indexing)

Register a Helius webhook that fires on:
- Membership NFT mint (Token program, community mint address)
- Governance program: proposal creation, vote cast

New route: `POST /api/webhooks/helius`
- Verify Helius signature header
- On membership mint: update `memberships.on_chain_attested = true`, `status = 'active'`
- On proposal state change: update `proposals.status`

### 4.3 Stellar Event Indexing

Subscribe to Stellar Horizon SSE stream for the treasury account:
- New payment received → create or update `payment_orders`
- Or use the Soroban event stream for `attested` events from `payment_attestation`

Alternative: poll via `promote-orders` cron using Horizon `/accounts/:id/payments`.

### 4.4 Refund Flow

Implement `POST /api/payment-orders/:id/refund`:
- Admin only (check `VITE_ADMIN_WALLETS` or Supabase admin role)
- Move order to `REFUND_QUEUED`
- Call Kotani B2C payout or Stellar reverse payment
- Update to `REFUND_CONFIRMED` on success
- Revoke membership if it was activated

### 4.5 Admin Reconciliation UI

Wire `AdminReconciliation.tsx` to real Supabase data:
- List all `payment_orders` with status `MANUAL_REVIEW`, `MINT_FAILED_RETRYABLE`, `AMOUNT_MISMATCH`
- Allow admin to manually approve (→ PAYMENT_CONFIRMED) or reject (→ REFUND_QUEUED)
- Require wallet signature from an address in `VITE_ADMIN_WALLETS`

### 4.6 Auth Gate

All community dashboard routes require an authenticated session:
- Wallet connected (Phantom/Solflare/Coinbase) OR
- Phone OTP verified (Privy embedded wallet)

Add a session check in `WalletGate.tsx` that blocks access to `/dashboard/*` until auth is confirmed.

---

## Phase 5 — Bounty & AI Layer (Post-MVP)

Roadmap only. Do not implement until Phase 1–3 are in production.

- Bounty creation with BRZA escrow in treasury vault
- Submission review queue
- AI scoring via Claude API (read-only rubric evaluation, not a signer)
- DAO ratification vote (reuse proposal flow)
- Payout via Kotani B2C or Stellar Disbursement Platform
- Contributor reputation attestation (Soroban or Solana program)

---

## Priority Order

```
Phase 0.1  Supabase schema                  — blocker for all persistence
Phase 0.2  Vercel env vars                  — blocker for all APIs in production
Phase 1.1  Confirm Solana program addresses — verify devnet → mainnet readiness
Phase 1.2  Community creation → Supabase    — needed to test join flow
Phase 1.3  Persist payment orders           — core membership flow
Phase 1.4  AT webhook sandbox test          — validates webhook route
Phase 2.1  Proposal creation API            — needed for governance demo
Phase 2.2  Vote casting API                 — needed for governance demo
Phase 3.1  Deploy DAO via Base Manager      — call existing Manager.deploy(), no custom contracts
Phase 2.3  Proposal ID bridge (Base)        — needed for on-chain vote
Phase 2.4  Proposal state sync cron         — needed for accurate UI
Phase 3.2  NFT membership on Base           — completes EVM join flow
Phase 4.1  Rate limiting                    — before any public launch
Phase 4.2  Helius webhook                   — needed for accurate on-chain state
Phase 4.3  Stellar event indexing           — needed for treasury visibility
Phase 4.4  Refund flow                      — required before real money
Phase 4.5  Admin reconciliation UI          — needed before operations scale
Phase 4.6  Auth gate                        — required before launch
```

---

## Open Questions

1. **Membership NFT standard.** For Solana communities: Metaplex NFT/Core (as per PRD). For Base communities: ERC721 from the Governor Token contract. Decide if both are supported at MVP or if one chain launches first.

2. **Relayer wallet for Base NFT minting.** Server-side NFT minting on Base requires a funded EOA with minting rights granted by the Token contract. Add `BASE_RELAYER_PRIVATE_KEY` to server-side env vars (never frontend). Fund it with ETH on Base Sepolia for testing.

3. **USSD flow.** `app/api/ussd/index.ts` exists and handles USSD menu sessions. Scope: decide whether USSD launches at MVP or Phase 2, and confirm full Africa's Talking USSD sandbox integration end-to-end.

4. **Solana mainnet program addresses.** The devnet program IDs in `pda.ts` are confirmed working on devnet. Confirm whether the same programs are deployed on mainnet-beta before any production launch.

# Deployment Guide

## Prerequisites

- Node.js >= 20
- Vercel account + CLI (`npm i -g vercel`)
- Git repository
- Supabase project for durable production flows

## Vercel Deployment

### First-Time Setup

```bash
cd app
vercel
```

Follow the prompts and link to the `baraza-protocol` Vite project.

### Production Deploy

```bash
vercel --prod
```

The root `vercel.json` is the canonical deploy config for this repo.

## Environment Variables

Set these in Vercel Project Settings -> Environment Variables.

| Variable | Scope | Notes |
| --- | --- | --- |
| `VITE_RPC_ENDPOINT` | Build-time, optional | Custom Solana RPC |
| `VITE_SOLANA_NETWORK` | Build-time | `devnet` for review |
| `VITE_PROGRAM_ID` | Build-time, optional | Baraza program ID once deployed |
| `VITE_SUPABASE_URL` | Build-time | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Build-time | Supabase anon key |
| `SUPABASE_URL` | Runtime | Supabase project URL for API routes |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime, secret | Server-only service role key |
| `CRON_SECRET` | Runtime, secret | Bearer token for manual cron calls |
| `VITE_STELLAR_NETWORK` | Build-time | `testnet` for review |
| `VITE_STELLAR_HORIZON_URL` | Build-time | Horizon URL for balances and tx checks |
| `VITE_STELLAR_NETWORK_PASSPHRASE` | Build-time | Testnet passphrase for review |
| `STELLAR_NETWORK` | Runtime | Server-side Stellar verifier network |
| `STELLAR_HORIZON_URL` | Runtime | Server-side Horizon URL |
| `STELLAR_TREASURY_ACCOUNT` | Runtime, required for mainnet | Enforces that verified XLM reaches the DAO treasury; recommended for testnet review |
| `PAYMENT_ADAPTER_PROXY_SECRET` | Runtime, secret | Restricts trusted server payment-adapter calls |
| `PAYMENT_PHONE_HASH_PEPPER` | Runtime, secret | HMAC pepper for durable phone hashes in payment orders |
| `KOTANI_PAY_API_KEY` | Runtime, secret | Kotani M-Pesa on/off-ramp API key |
| `KOTANI_API_BASE` | Runtime | Kotani API base URL |

BRZA membership payments use two trusted server calls:

1. `POST /api/payments/brza-membership` creates the ledger row before requesting the Kotani on-ramp.
2. `POST /api/payments/reconcile-brza-membership` checks pending orders against Kotani and only confirms exact KES amounts.

For Stellar testnet review:

```bash
VITE_STELLAR_NETWORK=testnet
VITE_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
```

## Supabase Migrations

Run every file in `supabase/migrations/` in filename order before testing durable production flows:

```text
001_communities_governance_columns.sql
002_payment_orders.sql
003_payment_attestations.sql
004_memberships.sql
005_stellar_settlements.sql
006_bounties_security_stellar.sql
007_enable_evm_community_rails.sql
008_bounty_access_reward_token.sql
009_membership_payment_order_unique.sql
```

Dashboard path: Supabase -> SQL Editor -> paste each migration in order.

CLI path:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

## Production Review Status

- Vercel project is linked from `.vercel/project.json`.
- Non-secret production/development envs for Solana devnet and Stellar testnet have been added from this workspace.
- Supabase production migrations are not run from this workspace because no Supabase project ref, database URL, or service role key is available.
- Live Stellar Horizon verification was tested with a real testnet payment hash: `018b8cde8e3987212bb0ec6d10b98e34a2ef95a40da3e80d1d829be4760173c8`.

## Smoke Test

After redeploy completes:

```text
1. Open the production URL.
2. Browse /communities and confirm seed DAOs render.
3. Create a community and confirm it persists to the Supabase communities table.
4. Join with M-Pesa simulator and confirm a payment_orders row is created.
5. Wait for cron or call /api/cron/promote-orders with CRON_SECRET. The demo promoter advances sandbox orders only.
6. Confirm payment status advances to RECONCILED and memberships receives a row.
7. Join with Stellar by sending 1 XLM on testnet, pasting the tx hash, and confirming the Stellar status path.
8. Open /dashboard/<id> and /profile to confirm member-facing state.
```

## SPA Routing

`vercel.json` rewrites non-API routes to `/index.html` for React Router compatibility.

## Build Settings

- Framework: Vite
- Build command: `cd app && npm install && npm run build`
- Output directory: `app/dist`
- Install command: `echo skip`

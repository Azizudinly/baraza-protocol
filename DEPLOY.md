# Deploy checklist

How to take the Vercel deploy from "ships static SPA in localStorage mode" to
"end-to-end with Supabase + cron + persistence."

## 1. Supabase project

```
1. Create a project at https://supabase.com
2. Copy from Project Settings → API:
   - Project URL          (used for both SUPABASE_URL and VITE_SUPABASE_URL)
   - anon public key      (VITE_SUPABASE_ANON_KEY)
   - service_role secret  (SUPABASE_SERVICE_ROLE_KEY — server-only, never VITE_*)
```

## 2. Apply migrations (in order)

```
supabase/migrations/001_communities_governance_columns.sql
supabase/migrations/002_payment_orders.sql
supabase/migrations/003_payment_attestations.sql
supabase/migrations/004_memberships.sql
supabase/migrations/005_stellar_settlements.sql
supabase/migrations/006_bounties_security_stellar.sql
supabase/migrations/007_enable_evm_community_rails.sql
```

Easiest path: Supabase dashboard → SQL Editor → paste each migration in order
and run. Or with CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## 3. Vercel env vars

Vercel dashboard → Settings → Environment Variables → add for **Production +
Preview + Development**:

| Variable | Scope | Value |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Build-time | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Build-time | anon public key |
| `SUPABASE_URL` | Runtime | Same as above (server-side reads can't use VITE_*) |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime, secret | service_role key |
| `CRON_SECRET` | Runtime, secret | Any random string (`openssl rand -hex 32`) |
| `VITE_SOLANA_NETWORK` | Build-time | `devnet` (or `mainnet`) |
| `VITE_RPC_ENDPOINT` | Build-time, optional | Helius/QuickNode URL if you want a private RPC |
| `VITE_STELLAR_NETWORK` | Build-time | `testnet` for review |
| `VITE_STELLAR_HORIZON_URL` | Build-time | `https://horizon-testnet.stellar.org` for review |
| `VITE_STELLAR_NETWORK_PASSPHRASE` | Build-time | `Test SDF Network ; September 2015` for testnet |
| `STELLAR_NETWORK` | Runtime | `testnet` for review |
| `STELLAR_HORIZON_URL` | Runtime | `https://horizon-testnet.stellar.org` for review |
| `STELLAR_TREASURY_ACCOUNT` | Runtime, recommended | Stellar public key that XLM dues must reach |
| `VITE_ADMIN_WALLETS` | Build-time, optional | Comma-separated pubkeys allowed to view `/admin` |

After adding, redeploy (or just push another commit) for env vars to apply.

Current Vercel status from this workspace:

- Added non-secret production/development review envs for Solana devnet, Stellar testnet, and `CRON_SECRET`.
- Still blocked on Supabase values and a real `STELLAR_TREASURY_ACCOUNT`; add those in Vercel before production review.

## 4. Smoke test

After redeploy completes:

```
1. Open the production URL
2. Browse /communities — see the four seed DAOs
3. Create one — should persist to communities table (no longer localStorage)
4. /join/<id> — enter 712 345 678 → Request M-Pesa Prompt
5. Check Supabase → payment_orders → new row, status = PAYMENT_CONFIRMED
6. Wait 1 min for cron tick → status advances to MINT_QUEUED
7. After ~5 min cron ticks → RECONCILED → memberships table has a row
8. /dashboard/<id> Wallet tab — your real SOL balance from VITE_SOLANA_NETWORK
9. /profile — joined community shows up as a row
```

## 5. Verify cron is running

Vercel dashboard → Functions → Crons. The schedule from `vercel.json`:

```
0 0 * * *    /api/cron/promote-orders
```

Cron runs only on the **Pro plan**. On Hobby plan the schedule is registered
but not executed — promote orders manually with:

```bash
curl -X GET https://<your-domain>/api/cron/promote-orders \
  -H "Authorization: Bearer $CRON_SECRET"
```

## 6. Known limitations (not blockers for deploy)

- **No real Solana mint.** The cron simulates `MINT_QUEUED → ... → RECONCILED`
  without touching the chain. Wire `programs/` to the cron later.
- **No real M-Pesa.** `/api/mpesa/simulate` immediately marks orders
  `PAYMENT_CONFIRMED`. Replace with Africa's Talking webhook receiver in
  production.
- **No phone auth.** `memberships.user_id_hash` uses `wallet:<address>` as a
  placeholder until phone-first signup is wired (per `MVP_ARCHITECTURE.md §4`).
- **Stellar verifier is live, payouts are not.** The app can verify XLM payment
  hashes through Horizon, but Stellar Disbursement Platform and SEP/anchor
  payout/off-ramp flows are still roadmap work.

## Rollback

Vercel keeps every deployment. If something breaks:

```
Vercel dashboard → Deployments → previous green deploy → Promote to Production
```

Or revert the offending commit and push.

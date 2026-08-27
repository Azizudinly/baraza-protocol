# Baraza Protocol Status

Date: 2026-06-07
Repo: `Azizudinly/baraza-protocol`
Branch: `fix/app-vercel-config`

## Protocol Position

Baraza is a Stellar-first community finance and governance protocol for African savings groups, chamas, SACCO-like groups, and DAO-style communities.

The current protocol model is:

1. Communities hold pooled funds in Stellar treasury G-accounts.
2. Members pay dues through native XLM or Kotani Pay M-Pesa KES to XLM onramp.
3. Payment orders are verified or reconciled server-side.
4. Membership activation is gated by payment order state plus an activation secret.
5. Governance and treasury rules are modeled through Solana Anchor programs.
6. EVM governance token support is secondary and read-oriented until wallet signing and deployed addresses are finalized.
7. BRZA is a Stellar custom asset, separate from payment rails.

## Active Protocol Surface

- Stellar settlement is the primary live/testnet path.
- Kotani Pay is the active M-Pesa onramp path for KES to XLM.
- Supabase stores payment orders, memberships, and admin state when configured.
- `/api/payment-orders/status` is the safe payment status read path and requires `x-activation-secret`.
- `/api/membership/activate` requires a confirmed/reconciled payment order and matching activation secret.
- `/api/cron/promote-orders` remains a demo promoter, not production mint/indexer logic.
- Solana programs exist for registry, governance, membership, payment attestation, and treasury vault.
- Treasury withdrawals must remain disabled until governance and release authority handoff are tested.
- Experimental Soroban prototypes now live under `contracts/stellar`, but active Stellar settlement is still API plus Horizon/Kotani.

## Protocol Rules To Preserve

- Do not relax the Stellar mainnet `intentToken` requirement.
- Do not expose activation secrets after payment order creation.
- Do not make `payment_orders` publicly readable through Supabase anon access.
- Do not mark membership active at payment confirmation alone.
- Do not set `withdrawals_enabled = true` before treasury authority handoff and devnet execution testing.
- Do not conflate BRZA with paying via Stellar XLM.
- Do not treat EVM/Base/Celo as launch blockers for the Stellar-first MVP.

## Open Protocol Work

1. Verify root Vercel deployment behavior for the app and API routes.
2. Run Supabase migrations in filename order, including `010_fix_payment_orders_rls.sql`.
3. Configure all required Vercel server and frontend environment variables.
4. Fund a Stellar testnet treasury account and run a real XLM payment verification smoke.
5. Replace the demo cron promoter with real BRZA mint submission, mint confirmation, and indexer confirmation.
6. Deploy Solana programs to devnet and set real Vercel program IDs.
7. Wire Supabase payment orders to the Solana payment attestation program.
8. Complete remaining governance CPI dispatch paths for membership actions and rule changes.
9. Restrict community member-count changes to membership CPI.
10. Move treasury release authority to a multisig-controlled authority and test before enabling withdrawals.
11. Replace `wallet:<address>` placeholder identity hashing with HMAC-peppered authenticated user identity.
12. Clean stale docs that still describe missing USSD routes, Daraja as the active M-Pesa path, or missing Stellar contract prototypes.

## Research Sync Targets

Use these as current sources for NotebookLM, Notion, and GitHub review:

- `README.md`
- `AGENTS.md`
- `docs/OPEN_TASKS_RESEARCH_UPDATE.md`
- `docs/PROTOCOL_STATUS_2026-06-07.md`
- `docs/KNOWLEDGE_GRAPH.md`
- `docs/TESTNET_CONTRACT_API_REVIEW.md`
- `app/docs/DEPLOYMENT.md`

## Recommended Next Move

Finish and merge the deployment/RLS/status cleanup branch after Vercel verification, then run Supabase migrations and the Stellar testnet treasury smoke. Only after that should Solana devnet deployment and secondary chain rails take priority.

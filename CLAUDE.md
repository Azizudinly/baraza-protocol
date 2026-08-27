# Baraza Protocol — Claude Code Instructions

## What this is

Baraza is a multi-chain community governance and treasury protocol for African DAOs, chamas, SACCOs, cooperatives, and stokvels. Primary market: Kenya, Tanzania, Uganda, Ethiopia, Nigeria.

**Products:** BAD · Baraza · Soko AI · Akili
**Founder:** Aziz Mohammed (@azizke)
**Live:** baraza-protocol.vercel.app · GitHub: github.com/Azizudinly/baraza-protocol

---

## DAOs-as-a-Business — the headline product

The revenue case: Baraza is **the only protocol where a registered SACCO, cooperative society, NGO, alumni association, or chama-graduating-to-LLP can run on-chain governance, treasury, and member distributions while keeping its legal standing in its home jurisdiction.**

Every community on Baraza runs the same DAO kernel (see *DAO governance is the canonical model* below). The product tier is determined by the **wrapper class** the community chooses at creation:

| `wrapper_class` | Who it is | What it gets | Pricing |
|---|---|---|---|
| `informal` | A chama, study circle, friend group — no legal entity | Full DAO kernel (proposals, votes, treasury, BRZA, retro rounds, badges, streaks, Akili Council) | Free |
| `self_declared` | A community that names itself as a registered SACCO/cooperative/NGO but hasn't uploaded a verifying certificate | Everything in `informal` + "Self-declared" badge + access to compliance report exports | Subscription (TBD) |
| `verified_business` | KYB-reviewed; certificate on file; registration number + authority verified | Everything in `self_declared` + "Verified" badge + Akili Council premium statutory mode (Kofi cites the actual Cooperative Societies Act sections; Zara quotes SASRA reserve ratios) + officer-tied multisig signer policy | Subscription (TBD) |

**Six categories that pay the verified tier:**
1. Cooperatives (Cooperative Societies Act, Kenya / Tanzania / Uganda)
2. SACCOs (SASRA-registered, Kenya)
3. NGOs (NGO Coordination Board, Kenya — equivalents elsewhere)
4. Investment clubs / chamas graduating to LLP or limited cooperative
5. Religious organisations and endowments (registered trustees)
6. Alumni associations / homeowner associations (registered mutual association)

The wrapper layer is **metadata + verification + display + Akili context** — it never branches the underlying governance, voting, treasury, BRZA, or retro code paths. See *DAO governance is the canonical model* for the invariant.

---

## Chain priority (do not reorder)

1. **Stellar** — primary. All treasuries are Stellar G-accounts. BRZA is a Stellar custom asset. M-Pesa → Kotani Pay → XLM → treasury.
2. **Solana** — governance. 5 Anchor programs (written, not deployed to devnet yet).
3. **Base (EVM)** — secondary. Aragon OSx Manager factory at known addresses.
4. **Celo** — mobile. GoodDollar G$ identity. Scaffold only.

Stellar launches first. Never treat EVM or Solana as launch blockers.

---

## Architecture rules — never break

- All business logic lives in `app/src/lib/` — components → hooks → lib. Never import lib directly in components.
- Chain adapters (`app/src/lib/adapters/`) are the single entry point for all chain interactions.
- Wallet support: **Phantom, Solflare, Coinbase Wallet only** — do not add others.
- Supabase is optional everywhere — every route falls back gracefully without env vars.
- `intentToken` is required for Stellar mainnet verification — legacy fields dev-only.
- Activation secret is client-side only from order creation to membership activation.
- BRZA ≠ XLM — never conflate the token with the payment rail.
- `withdrawals_enabled` stays `false` until multisig handoff is tested on devnet.
- Update `app/src/lib/knowledgeGraph.ts` when adding chain rails, contracts, or settlement routes.
- Keep public product naming within the BAD DAO ecosystem: BAD, Baraza, Soko AI, and Akili.
- Do not add Magic UI or heavy animation libraries.

---

## DAO governance is the canonical model

**Every community on Baraza is a DAO under the hood.** Chamas, SACCOs, stokvels, cooperatives, ROSCAs, alumni groups, burial societies — all 23 types in `app/src/lib/constants.ts:108-132` run on the same DAO primitives: proposals, votes, treasury, multisig, dues, BRZA emission, badges, streaks, retro rounds. There is no "chama mode" or "SACCO mode" — there is one governance kernel, and type is a label + creation-time governance preset over that kernel.

**Audit-confirmed invariant (2026-06-20):** zero `if (community.type === …)` runtime branches exist in `app/src/`, `app/api/`, or `contracts/`. The architecture holds the line cleanly.

Rules for keeping it that way:

- Type selection at `CreateCommunity.tsx` auto-populates governance form fields (quorum, approval threshold, voting period, treasury policy) from `GOVERNANCE_PRESETS`. The user can override every value. After creation, type becomes inert metadata.
- Post-creation, `communities.type` is read for cosmetic surfaces only — banner imagery (`communityVisuals.ts`), settings display, gallery copy. **Never branch governance, treasury, voting, or token logic on it.**
- Loan terms (`LOAN_TERMS` in `brza/constants.ts`) are global — `maxLtvPct: 0.50`, `aprPct: 0.05`, `termMonths: 12` — never configurable per community type.
- Treasury policy (`multisig-ready`, `proposal-only`, `manual-review`) is an independent field on `communities`, not derived from type. A SACCO can ship with `proposal-only`; a chama can ship with `multisig-ready`. The configuration is per-community, not per-type.
- Retro rounds (`app/src/lib/brza/retroRounds.ts`) and the BRZA emission pool are type-agnostic — pool sizing is per-community-membership share, never per-type share.
- Any member of any community type can open a retro round, vote, draft proposals, and govern. The DAO surface is the surface, regardless of label.
- **Adding a new community type:** add to `COMMUNITY_TYPES`, optionally add a `GOVERNANCE_PRESETS` entry, optionally add banner imagery. Do not add behavior branches. Type is a starter, not a switch.

---

## BRZA token (quick ref)

- **Supply:** 1,000,000,000 · 7 decimals · Stellar custom asset
- **Source of truth:** `app/src/lib/brza/constants.ts`
- Public pricing, allocation, and sale-planning details are intentionally omitted from repo docs pending counsel review.

---

## Security — never relax

- Use `crypto.timingSafeEqual` for all secret comparisons — never `===`
- Never log or expose: `SUPABASE_SERVICE_ROLE_KEY`, `STELLAR_INTENT_SECRET`, `PAYMENT_ADAPTER_PROXY_SECRET`, `PAYMENT_PHONE_HASH_PEPPER`, `KOTANI_PAY_API_KEY`, private keys
- `payment_orders` SELECT is `false` via RLS — reads go through `/api/payment-orders/status` + activation secret
- Rate-limit payment routes before public launch

---

## Key files

| File | Purpose |
|---|---|
| `AGENTS.md` | Full agent instructions, API routes, payment flow source of truth |
| `app/src/lib/brza/constants.ts` | BRZA token configuration and emission logic |
| `app/src/lib/chains/config.ts` | Chain config + Aragon OSx addresses |
| `app/src/lib/evm/manager.ts` | Aragon OSx deployDao() client |
| `app/src/lib/evm/base-governance.ts` | viem governance: castVote, getVotes, proposal state |
| `app/src/lib/programs/pda.ts` | Solana PDA derivation (all 5 programs) |
| `app/api/agent/chat.ts` | Akili community brain (Claude claude-sonnet-4-6, SSE streaming) |
| `app/src/lib/akili/` | Akili Council — 5 specialised one-shot agents (Amara, Kofi, Zara, Nia, Seku) |
| `app/api/stellar/verify-payment.ts` | Payment verification — HMAC, Horizon, Supabase |
| `supabase/migrations/` | Run 001–010 in filename order before any payment flow |
| `docs/NEXT_STEPS.md` | Phase 0–5 PRD with dependency order |
| `docs/CLAUDE_CONTEXT_PROMPT.md` | Full context for new sessions |

---

## AI layer

- **Akili brain** (`/api/agent/chat`) — Claude claude-sonnet-4-6 streaming. Drafts proposals, flags bad ones, answers community questions. Falls back to static when `ANTHROPIC_API_KEY` unset.
- **Akili Council** (`app/src/lib/akili/`) — 5 specialised one-shot agents: Amara (community intel), Kofi (governance), Zara (compliance), Nia (research), Seku (content). Invoke via `invokeCouncilAgent(name, message)`.
- **Dev swarm** (`.github/workflows/agent-swarm.yml`) — 4 parallel agents on every PR: SEO · Design · Security · Code. Requires `ANTHROPIC_API_KEY` in GitHub secrets.

---

## Immediate blockers (in order)

1. `ANTHROPIC_API_KEY` → Vercel + GitHub secrets
2. Supabase env vars → Vercel (URL, anon key, service role key)
3. `supabase db push` — run migrations 001–012
4. Fund Stellar testnet treasury G-account + run XLM payment verification smoke
5. Pick an indexer source for `MINT_CONFIRMED → INDEXER_CONFIRMED → RECONCILED` (currently a blind status walk; real BRZA mint + Horizon confirmation already ship)

---

## Do not

- Add wallets beyond Phantom, Solflare, Coinbase Wallet
- Commit secrets, private keys, or service role keys
- Set `withdrawals_enabled = true` before multisig handoff
- Relax `intentToken` requirement for Stellar mainnet
- Bypass activation secret gate in `membership/activate.ts`
- Introduce external protocol branding as Baraza product identity

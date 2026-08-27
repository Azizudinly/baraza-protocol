# TODOS

## Governance

## Gamification / rewards (P2)

### Open

#### Phase 5 wiring — vote-streak multiplier into vote casting
- Math + tests landed (`app/src/lib/voteStreak.ts`, 15 tests). Integration into actual vote weight gated on council filings: **Kofi** (procedure under charter — weight inflation is a material member-right change), **Nia** (chama-cultural absence question — funerals/harvest/school-fees decay), **Zara** (treasury authorisation impact at the margin), **Seku** (sourcing on documented streak-multiplier mechanics outside Web3).
- Default `currentVotingWeight` stays 1.0 across the stack until council clears wiring.

#### Out of scope for now (bigger swings)
- Token-bearing reputation badges (Founder-with-BRZA / Quorum-keeper-with-BRZA, etc.) — Kofi's 5 conditions precedent from `badge-token-pressure` filing (2026-06-17, id 95cd). Five conditions: identity continuity live, communityRewards/referral draw only, sub-cap within the monthly emission cap, named multi-sig, charter amendment clause.
- Curator economy on bounties (proposal-author share, reviewer share) — touches the bounty payout flow which is partly unbuilt.
- Cross-community reputation — opt-in, privacy-preserving design needed before any code.

## Completed

### 2026-06-19 — Phase 9: Identity continuity (bidirectional claim flow)
- Migration `021_identity_links.sql` — `identity_links` + `identity_claim_pending` tables, service-role-only RLS.
- `app/src/lib/identity/claim.ts` — 6-digit code generator (crypto.getRandomValues, not Math.random), SHA-256 code hash, HMAC phone hash reusing `PAYMENT_PHONE_HASH_PEPPER`, 5-attempt cap + 10-minute TTL + wallet-mismatch guard on wallet-initiated claims.
- `app/src/lib/identity/resolver.ts` — `resolveCanonicalIdentity()`, 5-minute cache, cluster-aware (one phone_hash → many wallets warmed together).
- `app/api/identity/initiate-claim.ts` + `verify-claim.ts` — bidirectional REST.
- `app/src/pages/ClaimIdentity.tsx` — wallet-side UI (`/claim`), phone → SMS code → linked.
- `phone_hash` is canonical per Nia's W3 promise ("your phone IS your membership").
- `referralPayoutBlockedReason()` accepts `identityContinuityLive` — lifts Kofi's phase ceiling when operator flags continuity live.

### 2026-06-19 — Phase 6: Referral 90d+3-payment Sybil gate
- Akili council ruling 2026-06-19 (filings: kofi 351d, zara 18f8, nia 4c43, seku f025) — SHIP CONDITIONAL.
- Fixed `BRZA_EMISSION.referralPct` double-draw against the dedicated Referral bucket — now `reservedPct`, sum still 1.0.
- New `BRZA_REFERRAL` constants — 500/250 split, 90d+3 gate, monthly sub-cap 50K, per-referrer cap 5/12mo rolling, velocity breach 5/30d, phase0 ceiling.
- `referralPayoutBlockedReason()` runtime guard enforces Kofi 4a/4c/4d + Seku pepper dedup. **Kofi 4d (named multi-sig signers) ships unsatisfied — unresolved dissent on file.**
- `app/src/components/ReferralProgress.tsx` — Nia's required design (relationship named, NO BRZA visible during 90d lock).
- 14 referral-guard tests.

### 2026-06-19 — Phase 5: Vote-streak multiplier (math + tests)
- `app/src/lib/voteStreak.ts` — `computeVoteStreak`, `streakToMultiplier`, `applyVoteMultiplier`. Cap 1.5×, 6-vote ramp, single-skip decay.
- 15 tests covering ramp, cap, decay, dedup, float discipline.
- **Integration into actual vote weight pending council ruling.**

### 2026-06-18 — Phase 2-A: Nia's USSD welcome (W0–W3 + SMS fallback)
- `app/src/lib/ussd/welcome.ts` — 4-screen flow, pending welcome registry, SMS fallback queue.
- Cross-process via `payment_orders.metadata` (cron writes, USSD endpoint rehydrates).
- Pre-check in `handleUssdInput()` routes pending welcomes through the flow.
- 21 tests.

### 2026-06-18 — Phase 2-B: Seku monitoring instrumentation
- Migration `018_ussd_monitoring.sql` — `ussd_session_exits` table.
- `app/src/lib/ussd/monitoring.ts` — `logSessionExit()`, `classifyExit()`, `sweepInvisibleUssdMembers(30)`.
- Sweep wired into `promote-orders.ts` cron — flags `metadata.invisible_member = true` on RECONCILED USSD orders with no session in 30 days.

### 2026-06-18 — Phase 2-C: `/api/payment-orders/streak` (live chip data)
- `app/src/lib/duesStreak.ts` — pure `computeStreak()` (UTC months, gap-resets, per-community partition).
- `/api/payment-orders/streak` + `/api/payment-orders/streak-batch` (Phase 12 batched).
- Profile aside + membership rows + MemberDirectory rows all wired.

### 2026-06-17 — Gamification phases 1, 3, 4 (badges + leaderboard + a11y)
- **Phase 1**: Founder + Quorum-keeper unlocked; `Community.createdBy` exposed; `dataStore.getVoteCountForWallet()` powers Profile "Voting history".
- **Phase 3**: `CommunityLeaderboard` hardcoded "David K. / Wanjiku M." removed; honest empty state.
- **Phase 4**: 15 `deriveBadges` tests + a11y on badge chips (`role="list"/"listitem"`, `aria-label`, `data-state` transitions, no-dead-air sync prime on Profile mount).

### 2026-06-19 — Council / operations
- `lib/badgeDistribution.ts` — runtime gate; falls closed until `USSD_WELCOME_DEPLOYED=1`. Honors Kemi-vs-Nia dissent on file.
- `docs/akili-council/MEMBER_VOICE_GAPS.md` — MVG-001 (USSD welcome copy) + MVG-002 (Phase 6 referee UX) carried, with closure protocol.
- `skills/akili-memory/memory.sh` — jq dependency replaced with node fallback; smoke-tested.
- Council backfill via node: synthesis + guard-audit entries for `phase-6-referral-gate-cleared` written to akili memory.

### 2026-06-14 — Profile double-fetch + useBrzaBalance cache eviction

### 2026-06-14 — Profile double-fetch + useBrzaBalance cache eviction
- Profile.tsx dropped the `fetchTotalBrzaBalance(address)` round trip — it queried the same memberships rows as the adjacent `fetchMembershipsForWallet` effect. `totalBrza` is now a `useMemo` summing `record.brzaBalance` across `myMemberships` (which already carries `voting_weight` via rowToRecord).
- `fetchTotalBrzaBalance` removed from useBrzaBalance.ts (Profile.tsx was the only caller).
- Added `sweepExpiredCache()` invoked on every cache lookup so the module-level Map drops entries past TTL instead of growing forever.

### 2026-06-14 — Landing vibrancy phase 2 (a/b/c/d)
- (a) Body font Inter → Public Sans (USWDS-derived humanist sans). Display stays Hanken Grotesk.
- (b) Editorial offset on the symmetric card grids: FeaturesSection's 2×2 workflow grid and FlowWalkthrough's 4-col flow row now drop every other card by a half-step on desktop. Breaks AI-grid symmetry without changing semantics.
- (c) Extended `whileInView` reveals to FlowWalkthrough (was the only landing section without an on-scroll reveal).
- (d) Light surfaces shifted from neutral cream (`hsl(0 0% 98%)`) to brand-hue warm (`hsl(22 30% 97%)` background, `hsl(22 20% 99%)` card). Matches the existing warm `--muted`/`--surface` tokens; whole palette now reads as intentional.

### 2026-06-14 — knowledgeGraph stopped selecting nonexistent memberships.created_at
- Dropped `created_at` from the Supabase select at `app/src/lib/knowledgeGraph.ts:425`, the optional field on `MembershipRow`, and the `row.joined_at ?? row.created_at` fallback in `membershipFromRow`.
- Migration 004 only defines `joined_at`; the query was failing with PostgREST 42703 and the column-level GRANT correctly omits the missing column.

### 2026-06-14 — Chain-adapter boundary cleanup
- Deleted empty root `lib/adapters/` scaffold. Real chain code already lives in `app/src/lib/adapters/`.
- Updated `.github/PULL_REQUEST_TEMPLATE.md` checklist to reference `app/src/lib/adapters/index.ts`.

### 2026-06-14 — Phone/email-identity voter gate + USSD vote menu honesty (443f9dc)
- `useWalletGuard` now accepts phone/email session as a fallback identity (`phone:<num>` / `email:<x>`), matching USSD membership key shape.
- USSD vote menu replaced misleading "Vote queued. Will broadcast when online." with honest copy, and added Abstain to match web's three-way vote.

### 2026-06-14 — Wallet-migration double-vote guard + payment_orders hash columns
- Migration 013 adds a BEFORE INSERT trigger on `votes` that walks the `migrated_from` / `migrated_to` chain and rejects a vote if any chain member already voted on the same proposal. DB-level backstop so the future vote-casting API can't bypass it by forgetting to walk.
- `stellar/verify-payment.ts` now writes `intent_token_hash` (sha256 of the signed intent), `user_id_hash` (HMAC-peppered payer address), and `amount_xlm` when persisting orders, activating migration 010's intent-token unique index. Intent-replay attempts now surface as a distinct `stellar_intent_reused` 409.

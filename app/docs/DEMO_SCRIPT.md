# Baraza Protocol — Live Demo Script

End-to-end walkthrough for a screen-recorded demo. Target run time **6–8 minutes**.
Read talking points aloud verbatim where quoted; everything else is direction.

> **Important — most write actions are mocked.** Clicking `Create`, `Vote`, `Join` will toast "coming soon". The on-chain program is not yet wired. Acknowledge this once near the start and don't dwell.

---

## Pre-flight (do this off-camera)

1. Start the dev server: `cd app && npm run dev` (Vite defaults to port `5173` — `vite --host`).
2. Open in Chrome, full screen. Recommended window size **1440×900**.
3. Install **Phantom** browser extension; create or unlock a Devnet account with some SOL.
4. Set `VITE_ADMIN_WALLETS` to your Phantom pubkey in `app/.env.local` if you want to demo `/admin`.
5. Clear localStorage (`baraza.communities.v1`, `baraza.memberships.v1`) so seeded mocks are clean.
6. Open three tabs ahead of time: `/`, `/communities`, `/admin` — switch with **Ctrl+Tab** for snappy transitions.
7. Close DevTools. Hide bookmarks bar.

---

## Scene 1 — Landing page (0:00 → 0:45)

**Where:** `http://localhost:5173/`

**Actions**
- Land on `/`. Pause 2s on the hero so the rotating word cycles once (`community → DAO → SACCO → co-operative → chama → welfare group`).
- Scroll slowly past the **CommunityMarquee** band.
- Stop briefly on the **FeaturesSection** ("The treasury loop your members can inspect").
- Continue down to the **CTASection** ("Launch a community DAO with rules everyone can inspect"). Pause on the 5-step grid: Connect wallet → Set DAO basics → Define governance rules → Invite members → Govern transparently.

**Talking points**
> "Baraza is a treasury layer for community groups — chamas, SACCOs, welfare circles, co-operatives — that already collect dues and vote on spending, but do it on paper or in WhatsApp."

> "Members get one shared dashboard: collect contributions, propose how to spend them, vote, and see every release on-chain."

> "We support both wallets and M-Pesa, so members can participate from a feature phone."

---

## Scene 2 — Wallet connect (0:45 → 1:30)

**Where:** Header, top-right "Connect Wallet" button.

**Actions**
- Click **Connect Wallet** in the header.
- The custom modal appears: title reads *"Connect a Solana wallet to continue"*.
- Hover over the three options to show the status badges (**Detected / Available / Install**):
  - Phantom
  - Solflare
  - Coinbase Wallet
- Click **Phantom**. The Phantom popup opens — approve.
- Modal closes. Header now shows a truncated address (e.g. `9x7K…aB3p`) with a chevron.
- Click the chevron. Show the dropdown: **Copy address**, **Change wallet**, **Disconnect**. Close the dropdown without clicking.

**Talking points**
> "We deliberately scoped the wallet picker to three options that work well in this region — Phantom, Solflare, and Coinbase Wallet. Anything else is filtered out at the modal layer."

> "Network is checked on connect — if you're on the wrong cluster the button turns red and prompts you to switch."

---

## Scene 3 — Browse and join an existing DAO (1:30 → 3:00)

**Where:** `/communities`

**Actions**
1. From the header, click **Community DAOs**. Land on `/communities`.
2. Show the search bar + type filter + Grid/List toggle. Type "kibera" into the search to filter to one card.
3. Clear the search. Click the **Kibera Youth Collective** card.
4. On `/dashboard/:id`:
   - Point to the stat row: **DAO Treasury**, **Members**, **Active Proposals**, **Past Proposals**.
   - Hover over the three tabs: **Governance Proposals**, **My Membership**, **DAO Treasury**.
   - Click **Join this DAO** (top-right of the banner).
5. On `/join/:id`:
   - Point to the two side-by-side panels: **M-Pesa** (left, primary) and **Wallet** (right, optional).
   - Type a phone number into the M-Pesa field: `0712345678`.
   - Click **Request M-Pesa Prompt**.
6. Land on `/join/:id/status?orderId=ord_demo_123`.
   - Walk through the **Activation Tracker** steps: *Check your phone for the M-Pesa prompt → Payment received — activating membership → Preparing your membership credential → Submitting to Solana → Membership verified → Active DAO member*. (First two are checkmarked, third is the live spinner step.)
   - Sidebar shows **Payment: Confirmed**, **Credential: Preparing**, **Membership: Pending**.

**Talking points**
> "Communities are seeded with mock data — Kibera Youth Collective, Mama Mboga Association, TechBridge Nairobi, Mwanzo Housing SACCO — but anything a user creates is persisted to Supabase or local storage."

> "Joining a DAO is two steps that we deliberately keep separate: the payment, and the membership credential. A member who has paid but whose credential is still minting can already see they're inbound — they don't sit in limbo wondering if their money landed."

> "The M-Pesa path is the primary one. Wallet-only is a power-user shortcut."

---

## Scene 4 — Create a new DAO (3:00 → 4:30)

**Where:** `/create`

> **Wallet required.** If you started this scene with no wallet connected, click the **Connect Wallet** header button first and approve in Phantom. Otherwise the submit at the bottom of the form reads *"Connect wallet to continue"* and just re-opens the modal.

**Actions**
1. Click **Create a DAO** in the header (or the CTA section button).
2. On `/create`, fill the form:
   - **Community Name:** `Demo Savings Circle`
   - **Community Type:** select **Savings**
   - **Monthly Membership Fee:** `500`
   - **Description:** `A demo group for the walkthrough — 12 members contributing monthly toward shared purchases.`
3. Expand the **Governance rules** group:
   - **Quorum Threshold:** leave at `51`
   - **Approval Threshold:** leave at `66`
   - **Default Voting Period:** select **7 days**
   - **Treasury Policy:** **multisig-ready**
4. Point at the right-side checklist: *CommunityAccount → TreasuryAccount → MembershipTier → Governance Rules → Membership Credential*.
5. Click **Create Community DAO**. A toast appears: *"coming soon"*.

**Talking points**
> "We surface every governance lever before the DAO is created — quorum, approval threshold, voting period, treasury policy. Members can see the rules before any proposal opens, not after the first vote goes sideways."

> "The on-chain program isn't live yet, so this submit is intentionally stubbed — we're shipping the UX surface first while the program is being audited."

---

## Scene 5 — DAO Treasury (4:30 → 5:15)

**Where:** `/dashboard/:id/treasury` (use any seeded community — e.g. Mama Mboga has rich mock data).

**Actions**
1. From the header click **Community DAOs** → click **Mama Mboga Association**.
2. On the dashboard, click the **DAO Treasury** tab → lands on `/dashboard/:id/treasury`.
3. Point at the **Treasury balance** (KSh stat, large).
4. Show the left section: **Inflows and Payment Attestations** — scroll the table, point at a couple of `MPESA-…` references with **Confirmed** status.
5. Show the right section: **Treasury Release Queue** — point at the pending proposal IDs (`PROP-042`, `PROP-044`, `PROP-045`).
6. Scroll to the **Executed Treasury Releases** table. Point at the disabled tx-signature column — note: *"Tx links go live when the on-chain program ships."*
7. Hover the **Export CSV** button (disabled — *Coming soon*).

**Talking points**
> "The treasury page is the single source of truth members come back to. Every inflow has a reference. Every queued release is tied to a proposal ID. Every executed release will eventually carry an on-chain signature."

> "This is the page that replaces the spreadsheet a chama treasurer photographs and shares in the WhatsApp group every month."

---

## Scene 6 — Propose & vote on a decision (5:15 → 6:30)

**Where:** `/dashboard/:id` → proposal flow

> **Wallet required for both halves.** Without a connected wallet, the Support/Object buttons and the proposal-submit button both render as gated CTAs (e.g. *"Connect your wallet to submit a governance proposal"*) and just open the wallet modal. Make sure you're connected from Scene 2 before recording this.

**Actions — viewing & voting on an existing proposal**
1. Go back to `/dashboard/:id` (Mama Mboga). Default tab is **Governance Proposals**.
2. Click any active proposal card — e.g. **"Purchase Shared Boda-Boda"**. Lands on `/dashboard/:id/decisions/:decisionId`.
3. Walk top-to-bottom:
   - Status badge (**Voting open**), proposal ID, title, description.
   - Stats row: **Requested funding**, **Treasury impact %**, **Quorum required**, **Current approval %**.
   - Voting bar — support (green) vs object (gray), counts visible.
4. Click **Sign to Support**. Phantom popup may appear; close it or approve. A toast shows *"coming soon"*.
5. Point at the right sidebar: **Proposal activity** — opened date, closes-on date.

**Actions — creating a new proposal**
6. Click **← Back to dashboard**. On the Governance Proposals tab, click **New Proposal** (bottom-right of the tab bar).
7. On `/dashboard/:id/decisions/create`:
   - **Title:** `Bulk-buy maize flour for December`
   - **Description:** `Negotiated rate with wholesaler — KSh 12 per kg vs market KSh 16. Two-week purchase window.`
   - **Funding Amount:** `45000`
   - **Voting Period:** **7 days**
   - Point at the blue info box: *"Available DAO Treasury: KSh …"*
   - Point at the governance rules callout: *"This DAO requires 50% quorum and 60% approval."*
8. Click **Submit Proposal for Vote**. Toast: *"coming soon"*.

**Talking points**
> "A proposal isn't just a yes/no — it's bound to a funding amount that the treasury has to be able to cover. If you try to over-commit, the form blocks you before the vote even opens."

> "Members see the quorum and approval rules right next to the form. There's no surprise threshold."

> "Voting is signed by the member's wallet — every vote is verifiable, not just tallied in a spreadsheet."

---

## Scene 7 — Profile (6:30 → 7:00)

**Where:** `/profile`

> **Connect before navigating.** If you land on `/profile` without a wallet you get a full-page "Connect your wallet" gate with a single CTA — fine to show for half a beat ("the profile is wallet-gated by design"), but make sure Phantom is connected before continuing or the rest of the scene is empty.

**Actions**
1. Navigate to `/profile`.
2. Banner shows the connected wallet address + "Connected via Phantom".
3. Point at the left sidebar: **Linked wallets** (primary wallet shown; "Linking a second wallet coming soon"), **Active roles** (empty).
4. Main content: **Your memberships** (empty for a fresh demo wallet) with CTAs **Browse Community DAOs** and **Create a Community DAO**.
5. Below: **Voting history** and **Membership credentials** (both empty until first real action).

**Talking points**
> "The profile is intentionally sparse on day one — it fills out as a member joins DAOs, votes, and earns membership credentials. Nothing here is editable; it's just the on-chain record, rendered."

---

## Scene 8 — Admin reconciliation *(optional — skip if running long)* (7:00 → 7:45)

**Where:** `/admin` (only works if your wallet address is in `VITE_ADMIN_WALLETS`).

**Actions**
1. Navigate to `/admin`.
2. Show the **KPI cards**: Pending Value, Webhook Health, Mint Queue Depth.
3. Point at the three tables: **Payment Orders** (PENDING / CONFIRMED / MANUAL_REVIEW), **Mint Jobs** (QUEUED / FAILED / CONFIRMED), **Webhook Events**.
4. Hover an action button — toast: *"coming soon"*.

**Talking points**
> "The operator surface is gated by an allow-list of wallet addresses, and it shows the bridge between fiat-rail payments and on-chain mints — exactly the seam where things go wrong in real-world deployments. Manual review queue is a first-class concept here, not an afterthought."

> "Most users never see this; it's for the people running a DAO on behalf of a community that's onboarding from M-Pesa."

---

## Scene 9 — Outro (7:45 → 8:00)

**Actions**
- Navigate back to `/`.
- Scroll smoothly to the footer.
- Pause on the footer tagline: *"A treasury layer for groups that collect dues, vote on proposals, and move funds with shared on-chain visibility."*
- Point at **Stellar reference contracts** and **Built for communities in Africa**.

**Talking point**
> "That's the loop end-to-end. Browse, join, propose, vote, release - and every member can audit it. Built for groups that have been running treasuries on trust and want the receipts to match, with Stellar as the reference chain and adapters for other rails."

---

## Appendix — fast cuts if you're running long

Drop any of these without losing the story:
- **Scene 8 (Admin)** — operator detail, not needed for a product audience.
- **Profile** (Scene 7) — empty state on a fresh wallet doesn't sell much; cut it if memberships aren't populated.
- **Treasury Executed Releases table** (Scene 5) — keep the queue & inflows, cut the historical table.
- **Create-proposal half of Scene 6** — keep just the vote view; mention creation verbally.

## Appendix — recovery tips

- **Modal won't open**: refresh the page, ensure Phantom is unlocked.
- **Wrong network warning**: switch Phantom to the cluster `EXPECTED_GENESIS` is set to (Devnet by default).
- **Stale mock data**: in DevTools, `localStorage.clear()` and reload.
- **Toast spam**: any "coming soon" toast is expected — it's the contract stub. Don't apologize on camera; just acknowledge once at the start ("submit and vote are intentionally stubbed while the program is in audit") and move on.

## Appendix — keyboard shortcuts during the demo

- **Cmd/Ctrl + L** then type a path — fastest way to navigate without leaving the address bar.
- **Cmd/Ctrl + Tab** — switch to a pre-loaded tab.
- **Cmd/Ctrl + 0** — reset zoom if you accidentally hit `+`/`-`.

> Product-layer document. Retained in this repo pending the public/private split; only framing corrections are in scope here.

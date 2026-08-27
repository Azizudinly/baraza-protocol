# Avalanche Grants — Baraza Protocol Fit Review

**Date:** 2026-06-30  
**Prepared for:** Aziz Mohammed (@azizke)  
**Sources reviewed:** build.avax.network/grants/team1-mini-grants · docs.avax.network/grants · Team1 Mini Grants program

---

## Programs on the Table

### 1. Team1 Mini Grants

| Field | Detail |
|---|---|
| **Operator** | Team1 DAO (independent, not the Avalanche Foundation) |
| **Fund size** | $100,000 pool |
| **Grant per project** | $500 – $5,000 |
| **Stage target** | Early-stage — idea to MVP |
| **Geographic focus** | Global, with active pushes into Kenya and India |
| **What they fund** | dApps, smart contracts, prototypes building on Avalanche |
| **Application asks** | Whitepaper/litepaper · prototype/demo · market analysis |
| **Process** | Submit → internal evaluation → interview → milestone-based tranches |
| **Extra upside** | Top applicants get interviewed for Codebase (Avalanche's accelerator) |

Team1 has run a **Kenya Mini Hack** and awarded its first community-builder mini grant to Yellow Cat DAO for grassroots impact. The Africa/community angle is actively valued by this program — not a footnote.

---

### 2. Avalanche Foundation — infraBUIDL(AI)

| Field | Detail |
|---|---|
| **Operator** | Avalanche Foundation |
| **Fund size** | Up to $15M direct + retroactive grants; fast-tracked into Aethir's $100M ecosystem fund |
| **Stage target** | Projects fusing AI with decentralised infrastructure |
| **What they fund** | Intelligent tooling · coin-operated agents (COAs) · AI-driven launchpads · next-gen solutions |
| **Application** | Form submission → Foundation outreach |

---

### 3. Avalanche Foundation — Community Grants (Gitcoin)

Open matching-fund rounds via Gitcoin. Visibility-driven — community traction earns proportional matching. No fixed amount per project.

---

### 4. Other Foundation Programs (lower priority)

- **Ted Yin Grant** — open source software on Avalanche public blockchain; academic / tooling slant.
- **Research Grants** — up to $50K for original academic work on Avalanche network economics; not a product grant.
- **Multiverse** — $290M L1 incentive programme; targets gaming, DeFi, NFTs, and institutional subnets. Too large a scope for current stage.

---

## Fit Assessment

### Team1 Mini Grants — **Strong fit, with one gap**

**What lines up:**

| Criterion | Baraza status |
|---|---|
| Working prototype | baraza-protocol.vercel.app — community creation, dues via M-Pesa, Stellar treasury, BRZA mint, Akili relay all ship |
| Whitepaper/litepaper | `docs/whitepaper/PUBLIC_WHITEPAPER.md` + `ONE_PAGER.md` — grant-ready |
| Market analysis | Investor whitepaper §2 covers ROSCA/SACCO market size, mobile money maturity, competitive landscape |
| Africa/community focus | Exact match — Kenya Tier 1, chama/SACCO/stokvel primary target |
| Early-stage | Pre-mainnet, seeking grant to reach Phase 1 (Stellar mainnet end-to-end) |
| AI component | Akili relay + 5-specialist council is a working differentiator |

**The gap — Avalanche chain presence:**

Baraza currently deploys on Stellar (primary), Solana (governance), and Base EVM (secondary via Aragon OSx). There is no Avalanche C-Chain deployment.

This is bridgeable. The EVM contracts targeting Base use `viem` and Aragon OSx — both are chain-agnostic. Avalanche C-Chain is EVM-compatible; deploying the Aragon OSx Manager to Avalanche C-Chain would be a configuration change, not a rewrite. It would mean:

1. Add `avalanche` to `app/src/lib/chains/config.ts` with C-Chain RPC and the Aragon OSx addresses (or deploy fresh).
2. Add an `avalanche` adapter in `app/src/lib/adapters/`.
3. Update `knowledgeGraph.ts` with the new rail.

Estimated effort: 1–2 days given the existing adapter pattern.

**Application narrative:**

> Baraza is the only protocol giving African chamas, SACCOs, and cooperatives a USSD-accessible, M-Pesa-settled DAO — no seed phrases, no bank account required. We're applying to Team1 Mini Grants to complete our Stellar mainnet verification (Phase 1) and deploy our EVM governance layer to Avalanche C-Chain, making community treasury governance available across mobile money and the Avalanche ecosystem simultaneously. Our Akili AI council (5 specialised agents + a relay) is already live and making governance recommendations inside communities today.

---

### infraBUIDL(AI) — **Plausible fit, needs repositioning**

Akili Council maps directly onto what infraBUIDL(AI) calls "coin-operated agents" (COAs):

- Amara, Kofi, Zara, Nia, Seku are 5 specialised one-shot agents each with defined character bibles, durable wounds, and domain constraints.
- The Akili relay synthesises their outputs and surfaces a single voice to the community.
- The council is never a signer — it recommends; humans execute. This is exactly the "intelligent tooling" framing infraBUIDL looks for.

The gap is the same: Avalanche deployment. But the story is stronger here because the AI layer is genuinely novel and deployable anywhere.

**Application narrative:**

> Akili Council is a live multi-agent governance system operating inside Baraza communities today. Five specialised agents — covering governance, compliance, economy, people, and research — file independent recommendations; a relay synthesises and surfaces one voice. No agent can sign a transaction. The system's task is to make on-chain governance legible to members who vote by USSD from a feature phone. We are applying to infraBUIDL(AI) to extend this architecture to Avalanche — deploying community treasury governance to Avalanche C-Chain and enabling Akili to operate as a coin-operated governance agent within Avalanche DAOs. Immediate use case: 50M+ African ROSCA members who currently have no auditable governance rail.

This application is a bigger swing (more competitive, higher bar) but the funding ceiling is orders of magnitude larger.

---

## Recommended Sequence

1. **Apply to Team1 Mini Grants now.** The whitepaper, one-pager, and prototype are already grant-ready. Request $3,000–$5,000 targeting Phase 1 (Stellar mainnet verification + Avalanche C-Chain adapter). The Africa/community angle is a direct match for Team1's stated interests (Kenya Mini Hack, community builder grant history). Risk: low. Effort: 1–2 days to write the application.

2. **Add Avalanche C-Chain to the adapter layer.** Takes 1–2 days of engineering. Strengthens both this application and future Foundation grant rounds. Does not break the Stellar-first architecture — it's additive.

3. **Apply to infraBUIDL(AI) in parallel or immediately after.** Stronger application once Avalanche adapter is live. Frame Akili Council as the AI product, Baraza communities as the deployment context.

4. **Enter Gitcoin community round.** Once Phase 1 ships and you have active communities on mainnet, the matching fund becomes viable. Community traction drives matching; no traction = no match.

---

## What the Application Packet Needs

For **Team1 Mini Grants**, the submission packet should include:

| Document | Status | Location |
|---|---|---|
| One-pager | Ready | `docs/whitepaper/ONE_PAGER.md` |
| Public whitepaper | Ready | `docs/whitepaper/PUBLIC_WHITEPAPER.md` |
| Prototype / demo link | Ready | baraza-protocol.vercel.app |
| Market analysis | Ready (in investor WP §2) | `docs/whitepaper/INVESTOR_WHITEPAPER.md` |
| Team page | Partial (Founder B TBA) | `docs/whitepaper/TEAM.md` |
| Pitch deck | Canva design DAHCPQ0MpOk | External (share view link in application) |
| Avalanche integration plan | **Needs writing** | See §"The gap" above |
| Milestone plan | **Needs writing** | Phase 1 + Avalanche adapter scoped |

---

## Technical Note — Avalanche C-Chain Integration

The existing EVM stack in `app/src/lib/evm/` uses `viem` + Aragon OSx. Avalanche C-Chain shares the same EVM ABI surface. Steps to add support:

```ts
// app/src/lib/chains/config.ts — add after Base entry:
avalanche: {
  chainId: 43114,
  name: 'Avalanche C-Chain',
  rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
  // Aragon OSx on Avalanche — deploy or use existing addresses once confirmed
  aragonOsxManager: '0x...',
}
```

Then create `app/src/lib/adapters/avalanche.ts` mirroring `app/src/lib/adapters/base.ts`, and register it in `knowledgeGraph.ts`. The manager factory in `app/src/lib/evm/manager.ts` already takes a `chainId` argument — no fork needed.

This does not affect `withdrawals_enabled` (stays `false`), the Stellar primary rail, or any Solana programs. It is purely additive.

---

## Notes on the Canva Pitch Deck

The deck at `canva.com/design/DAHCPQ0MpOk/...` was shared as a view link but is owned by a different Canva account — Claude cannot read its content directly. If you want the deck reviewed or updated, share it via Canva's "share for collaboration" (editor access) or export a PDF and drop it in the repo.

---

*Sources: [Team1 Mini Grants](https://grants.team1.network/) · [Team1 Kenya Hackathon](https://team1-kenya-hackathon.vercel.app/) · [Avalanche Builder Hub Grants](https://build.avax.network/grants) · [infraBUIDL(AI) Program](https://www.infrabuidl.com/) · [Team1 $1.15M DAO Grant](https://www.team1.blog/p/the-avalanche-team1-dao-secures-115) · [Aethir + infraBUIDL](https://www.avax.network/about/blog/avalanche-foundation-partners-with-aethir-to-fast-track-infrabuidl-ai-grantees-into-100m-ecosystem-fund)*

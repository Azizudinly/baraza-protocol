# Research Flags — 2026-07-02

Surfaced during strategy research, **not yet independently verified**. Do not cite in a live grant application, pitch, or public copy without confirming first. This file exists so research doesn't get lost between conversations, not as a source of truth.

---

## Avalanche — institutional precedent (addendum to `AVALANCHE_GRANTS_REVIEW.md`)

A government — the State of Wyoming — already runs infrastructure on Avalanche subnets. Useful as a pre-emptive answer to "will governments actually use a subnet chain" in the federated/institutional-tier pitch (see the existing chain-fit table: Avalanche → federated/institutional, own subnet/L1). Needs a direct source check before use in an application.

**Zora is not a commitment.** Zora is accounted for in code (the placeholder slot restored in the "account for all available EVM chains" commit), but it is **not** a roadmap item or a grant-pipeline commitment. It has no distinct community-type fit beyond what Base already covers for the creator/consumer tier, no identified grant thread, and no demand pulling it in. The one place it might matter is Baraza TV — creator-coin minting is closer to Zora's actual strength — but that's a separate product's roadmap question, not Baraza Protocol's. Stated plainly here so nobody later reads the code placeholder as a commitment.

## Competitive intelligence

- **BlockCoop SACCO** — Kenya's first blockchain-powered SACCO, launched Oct 2025, reportedly reached KES 1.3B (~$10M) market cap by April 2026, VASPA-2025 licensed, M-Pesa native, tokenized SACCO shares (BLOCKS), partnered with HF Group + Nomachain. Real and well-capitalized, but a single tokenized institution, not infrastructure — that's the differentiation line for grant/investor conversations, not a threat to route around.
- **Celo / Haraka** — cKES (Kenya Shilling stablecoin) is live on Celo/Mento. An existing product, Haraka, already uses it for chama lending circles, and Celo Africa DAO is doing active field research with chamas. Do not pitch "chamas want local-currency stablecoins" to Celo Africa DAO as a novel insight — lead with full governance/treasury/proposals tooling as the differentiator instead.

## Token-launch planning track (separate from the "no token this phase" public posture)

A token launch **next year** has been planned around, independent of the current protocol-only public positioning:

- **Token chains:** Stellar + Solana + Avalanche + Base (not the full 9-chain protocol-deployment list — communities can still deploy more broadly; this is specifically which chains the token itself would live on).
- **Raise:** a lean bottom-up estimate exists (figures withheld from the public repo pending counsel review), built from a 6–12 month runway to mainnet + first cohort, not backed into from a round-number target. Grants-first. **Explicitly no centralized public token sale** — the model is communities/partners hold their own license (BlockCoop-style) and plug into Baraza as infrastructure, rather than BAD DAO taking on retail compliance itself.
- **Funding-stack accuracy:** only Stellar has an active grant application in, and Artizen Fund is the only confirmed funding source right now. Everything else (Solana Foundation, Avalanche programs, GSMA, AfDB) is a named target, not an active application, as of this flag.

### Open conflict — tokenomics source of truth

There is a real, unresolved conflict between **this repo's live code** (`app/src/lib/brza/constants.ts`) and the tokenomics numbers in the Notion "Master Document," on three concrete points:

1. **Allocation percentages** — the Notion table over-allocates (a documented bug); the code fixed it with a different rebalance than a straight fix would produce. (Specific figures are counsel-gated and withheld from the public repo.)
2. **Referral mechanic** — Notion describes a 10-level percentage cascade; the live code has a completely different design (flat referrer/referee payout per referral pair, gated by 90-day activity + 3 payments, monthly sub-cap, per-referrer cap, velocity-breach detection). This is a redesign, not a tuning difference.
3. **Baraza TV creator bucket** — a creator allocation bucket exists in the live code, absent from the Notion table entirely.

Both the Notion Master Document and this repo have now been cross-flagged pointing at each other (Notion page updated 2026-07-02). This needs a founder decision on which is authoritative before either is finalized — not something to resolve by silently picking one.

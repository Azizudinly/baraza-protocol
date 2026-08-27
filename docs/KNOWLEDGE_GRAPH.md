# Baraza Knowledge Graph

The knowledge graph is the project memory for Baraza. It links communities, chain rails, proposals, bounties, Akili security checks, and readiness tasks so product and engineering decisions stay connected as the build moves toward testnet.

## Source

The current graph is generated in:

- `app/src/lib/knowledgeGraph.ts`

It is version-controlled and can run in two modes:

- `local`: mock/localStorage-derived graph for development and demos
- `supabase`: persisted communities, bounties, memberships, and payment orders when Supabase env vars are configured

It can later be backed by The Graph, Neo4j, or another graph database without changing the product language.

## Current node types

- `community`
- `chain`
- `proposal`
- `bounty`
- `membership`
- `payment-order`
- `security-review`
- `readiness-task`
- `capability`

## Current edge types

- `uses-chain`
- `has-proposal`
- `has-bounty`
- `has-member`
- `has-payment`
- `has-review`
- `needs-task`
- `supports-capability`
- `settles-on`

## Update rule while building

When adding a feature, also update the graph if the feature changes one of these:

- A new chain rail, wallet, testnet, RPC, or contract address
- A new community workflow such as proposals, bounties, dues, payouts, or membership
- A new security check or Akili review outcome
- A new blocker or testnet readiness task
- A new settlement route such as SOL, XLM, G$, M-Pesa, or community token

## Chain Status (as of 2026-05-26)

| Chain | Status | Notes |
| --- | --- | --- |
| Stellar | `testnet-ready` | `/api/stellar/verify-payment` live against Horizon testnet. Treasury account needs funding. |
| Solana | `partial` | Five Anchor programs compile (`cargo test --workspace` passes). Anchor.toml still targets `localnet`. `solana` CLI missing from PATH — blocks devnet deploy. |
| Celo (GoodDollar) | `coming-soon` | G$ SDK and identity wired. Needs Alfajores token/identity contract addresses in Vercel env. |
| Ethereum / Base / Arbitrum / Optimism / Polygon | `partial` | Placeholder contract addresses. EVM governance and membership not yet deployed. |
| BNB / XDC | `coming-soon` | Scaffold only. |

## Governance Token (ERC-721 — contracts/evm)

The governance token is an upgradeable ERC-721 with on-chain votes (ERC-5805). Storage is append-only across three versions:

- **TokenStorageV1**: `Settings` (auction house, supply, numFounders, metadataRenderer, mintCount, totalOwnership), `founder` map, `tokenRecipient` map
- **TokenStorageV2**: `minter` allowlist
- **TokenStorageV3**: `reservedUntilTokenId`

Key structs: `Founder { wallet, ownershipPct uint8, vestExpiry uint32 }` and `MinterParams { minter, allowed }`.

Token IDs below `reservedUntilTokenId` are reserve-mintable (minter-gated); IDs at or above are auctioned. Founder vesting is scheduled by `tokenId % 100`, total ownership capped at 100%.

EVM token contracts are not yet deployed to any testnet. Deploy path: [contracts/evm/](contracts/evm/).

## Next Steps — Testnet

These are ordered by dependency. Do them in sequence.

### 1. Run Supabase migrations (blocker for everything)

Tables needed: `payment_orders`, `memberships`, `bounties`, `review_queues`.
Until these exist, every API route that writes persistence falls back to in-memory state only.

```
supabase db push
```

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel after migrations run.

### 2. Set all Vercel environment variables

Use `.env.example` as the source of truth. Minimum set for testnet:

- All `VITE_*` frontend vars
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- Stellar vars: `STELLAR_NETWORK`, `STELLAR_HORIZON_URL`, `STELLAR_TREASURY_ACCOUNT`
- M-Pesa sandbox vars: `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`

### 3. Stellar testnet smoke

1. Fund a Stellar testnet G-account via Friendbot.
2. Set `STELLAR_TREASURY_ACCOUNT` in Vercel.
3. Send a real native XLM payment to the treasury account.
4. Confirm via `POST /api/stellar/verify-payment` with `txHash`, `communityId`, `amountXlm`.
5. Expected: `status: PAYMENT_CONFIRMED`, `persisted: true`.

After this passes, Stellar moves from `testnet-ready` → `live` for payments.

### 4. Solana devnet deploy

1. Install Solana CLI locally: `sh -c "$(curl -sSfL https://release.solana.com/stable/install)"`.
2. `solana config set --url devnet && solana airdrop 5 <DEPLOYER_PUBKEY>`
3. Edit `Anchor.toml`: change `[provider] cluster = "localnet"` → `cluster = "devnet"`.
4. `anchor build && anchor deploy --provider.cluster devnet`
5. Copy the five deployed program IDs into Vercel:
   - `VITE_COMMUNITY_REGISTRY_PROGRAM_ID`
   - `VITE_GOVERNANCE_PROGRAM_ID`
   - `VITE_MEMBERSHIP_PROGRAM_ID`
   - `VITE_PAYMENT_ATTESTATION_PROGRAM_ID`
   - `VITE_TREASURY_VAULT_PROGRAM_ID`
6. Run seed script: create community, membership tier, governance config, treasury vault. Keep `withdrawals_enabled = false`.
7. Smoke test: Phantom on devnet → browse group → join → create proposal → cast vote → deposit SOL.

After this passes, Solana moves from `partial` → `testnet-ready`.

### 5. GoodDollar / Celo Alfajores

1. Set `VITE_GOODDOLLAR_TOKEN_ADDRESS` and `VITE_GOODDOLLAR_IDENTITY_ADDRESS` to Alfajores addresses.
2. Set `VITE_CELO_RPC_URL` to `https://alfajores-forno.celo-testnet.org`.
3. Test bounty reward adapter handoff with a G$ distribution.

After this passes, Celo moves from `coming-soon` → `testnet-ready`.

## Next Steps — Production (post-testnet)

These are hard blockers before real funds move.

| # | Task | File | Risk |
| --- | --- | --- | --- |
| 1 | Test governance-dispatched treasury releases on devnet | `programs/governance/src/lib.rs` → `execute_proposal` | **Critical** — native SOL CPI dispatch is wired locally but still needs a real devnet execution |
| 2 | Hand treasury release authority to the production Squads vault PDA | Treasury deployment and operations | **Critical** — on-chain authority enforcement is wired; keep `withdrawals_enabled = false` until the deployed handoff is tested |
| 3 | Wire Supabase payment orders to on-chain attestation | `programs/payment_attestation` + `/api/membership/activate` | **Critical** — off-chain membership is acceptable for testnet, not for live |
| 4 | Restrict `bump_member_count` to membership CPI only | `programs/community_registry/src/lib.rs` | **High** — currently admin-only |
| 5 | Replace admin-provided governance snapshot inputs with CPI reads | `programs/governance/src/lib.rs` → `activate_proposal` | **High** |
| 6 | Verify SPL token balance movement in `record_spl_deposit` | `programs/treasury_vault/src/lib.rs` | **Medium** — currently event-only |
| 7 | Decide Stellar Soroban scope | — | **Medium** — needed only if Stellar-native treasury/governance state is required |
| 8 | Remove fallback program IDs from frontend | `app/src/lib/programs/pda.ts` | **Low** — fine for demos, must be removed before production |
| 9 | Triage Anchor macro `unexpected cfg` warnings before enabling strict CI | workspace root | **Low** |

## Admin surface

The admin dashboard reads the graph summary and shows:

- Node and edge count
- Data source: local or Supabase
- Risk and watch review counts
- Member and payment-order counts
- Testnet-ready chain rails
- Coming-soon chain rails
- Top readiness tasks

## Next graph upgrades

1. Persist graph snapshots to Supabase after migrations are live.
2. Add proposal and bounty event history as graph edges.
3. Add member and role nodes once membership data is durable.
4. Add payment order nodes for M-Pesa, Stellar, and treasury releases.
5. Add export to Mermaid or JSON for reviewer docs and architecture diagrams.
6. Add `token` node type for community ERC-721 governance token once EVM contracts are deployed.

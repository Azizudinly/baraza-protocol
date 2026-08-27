# BARAZA PROTOCOL — AUDIT LOG

---

## Security Finding — 2026-06-08

**Source:** Governance research synthesis (NotebookLM export)
**Severity:** Informational / Product Design

**Finding:** Governance proposals submitted without prior structured community dialogue are 90% more likely to fail.

**Implication:** The anonymous per-proposal chat board (discussion phase before voting opens) is validated as essential to governance health — not just a UX nicety. Proposals should not be voteable without a mandatory discussion window.

**Action taken:** Added discussion phase to proposal lifecycle in `app/docs/PRD.md` section 18.2. Governance program must enforce a minimum discussion period before `Active` state transition.

---

## Phase 1 Full Audit — 2026-05-26

Branch: `feat/gooddollar-buildathon`

Audit date: 2026-05-26

Scope note: this audit covers the tracked repository state from `git ls-files` on the feature branch. Generated folders such as `.git`, `node_modules`, `target`, and Vercel cache are intentionally not treated as source.

## 1. Current Stack

### App package: `app/package.json`

Dependencies:

| Package | Version |
| --- | --- |
| `@coral-xyz/anchor` | `^0.32.1` |
| `@radix-ui/react-toast` | `1.2.4` |
| `@solana/wallet-adapter-base` | `^0.9.26` |
| `@solana/wallet-adapter-coinbase` | `^0.1.23` |
| `@solana/wallet-adapter-phantom` | `^0.9.29` |
| `@solana/wallet-adapter-react` | `^0.15.38` |
| `@solana/wallet-adapter-react-ui` | `^0.9.38` |
| `@solana/wallet-adapter-solflare` | `^0.6.33` |
| `@solana/web3.js` | `^1.98.2` |
| `@stellar/stellar-sdk` | `^14.2.0` |
| `@supabase/supabase-js` | `^2.57.4` |
| `buffer` | `^6.0.3` |
| `class-variance-authority` | `^0.7.1` |
| `clsx` | `^2.1.1` |
| `framer-motion` | `^12.7.4` |
| `lucide-react` | `^0.454.0` |
| `react` | `^18.3.1` |
| `react-dom` | `^18.3.1` |
| `react-router-dom` | `^6.22.1` |
| `tailwind-merge` | `^2.5.5` |
| `tailwindcss-animate` | `^1.0.7` |
| `zod` | `^4.4.3` |

Dev dependencies:

| Package | Version |
| --- | --- |
| `@eslint/js` | `^9.9.1` |
| `@testing-library/jest-dom` | `^6.9.1` |
| `@testing-library/react` | `^16.3.2` |
| `@testing-library/user-event` | `^14.6.1` |
| `@types/node` | `^25.9.1` |
| `@types/react` | `^18.3.5` |
| `@types/react-dom` | `^18.3.0` |
| `@vitejs/plugin-react` | `^6.0.2` |
| `@vitest/coverage-v8` | `^4.1.7` |
| `autoprefixer` | `^10.4.20` |
| `eslint` | `^9.9.1` |
| `eslint-plugin-react-hooks` | `^5.1.0-rc.0` |
| `eslint-plugin-react-refresh` | `^0.4.11` |
| `globals` | `^15.9.0` |
| `jsdom` | `^29.1.1` |
| `postcss` | `^8.4.35` |
| `tailwindcss` | `^3.4.11` |
| `typescript` | `^5.5.3` |
| `typescript-eslint` | `^8.3.0` |
| `vite` | `^8.0.14` |
| `vitest` | `^4.1.7` |

### EVM package: `contracts/evm/package.json`

Dependencies:

| Package | Version |
| --- | --- |
| `@openzeppelin/contracts` | `^4.7.3` |
| `@openzeppelin/contracts-upgradeable` | `^4.8.0-rc.1` |
| `@types/node` | `^18.7.13` |
| `ds-test` | `https://github.com/dapphub/ds-test.git` |
| `forge-std` | `https://github.com/foundry-rs/forge-std` |
| `micro-onchain-metadata-utils` | `^0.1.1` |
| `sol-uriencode` | `^0.2.0` |

Dev dependencies:

| Package | Version |
| --- | --- |
| `dotenv` | `^17.4.2` |
| `husky` | `^8.0.1` |
| `lint-staged` | `^13.0.3` |
| `prettier` | `^2.7.1` |
| `prettier-plugin-solidity` | `^1.0.0-dev.23` |
| `solhint` | `^3.3.7` |
| `solhint-plugin-prettier` | `^0.0.5` |

### Rust / Solana

- Anchor workspace in root `Cargo.toml`, `Anchor.toml`, and `programs/*`.
- Anchor CLI installed locally: `anchor-cli 0.30.1`.
- `solana` CLI is missing from PATH.
- `stellar` CLI is missing from PATH.

## 2. Folder Structure

Tracked top-level source tree:

```text
.
├── .github/workflows/ci.yml
├── Anchor.toml
├── Cargo.lock
├── Cargo.toml
├── DEPLOY.md
├── README.md
├── AUDIT.md
├── app/
│   ├── api/
│   │   ├── cron/promote-orders.ts
│   │   ├── membership/activate.ts
│   │   ├── mpesa/simulate.ts
│   │   ├── payment-orders/status.ts
│   │   └── stellar/verify-payment.ts
│   ├── docs/
│   │   ├── BRAND_GUIDELINES.md
│   │   ├── CONTRACT_INTEGRATION.md
│   │   ├── CROSS_CHAIN_DEPLOYMENT_CHECKLIST.md
│   │   ├── DAO_LOGIC_REFERENCE.md
│   │   ├── DEMO_SCRIPT.md
│   │   ├── DEPLOYMENT.md
│   │   ├── DESIGN.md
│   │   ├── DESIGN_SPEC.md
│   │   ├── GOVERNANCE_CONTRACT_ROADMAP.md
│   │   ├── HIGGSFIELD_PROMPTS.md
│   │   ├── MVP_ARCHITECTURE.md
│   │   ├── PRD.md
│   │   └── SUPABASE_SCHEMA.sql
│   ├── public/
│   │   ├── baraza-logo.svg
│   │   ├── og-image.svg
│   │   ├── robots.txt
│   │   └── sitemap.xml
│   ├── scripts/higgsfield/
│   │   ├── render.mjs
│   │   └── shots.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── AIPlatformSection.tsx
│   │   │   ├── BackendStatus.tsx
│   │   │   ├── BarazaWalletModalProvider.tsx
│   │   │   ├── BountyBoard.tsx
│   │   │   ├── BrandLogo.tsx
│   │   │   ├── CTASection.tsx
│   │   │   ├── ChainProvider.tsx
│   │   │   ├── ChainSelector.tsx
│   │   │   ├── CommunityBanner.tsx
│   │   │   ├── CommunityCard.tsx
│   │   │   ├── CommunityGallery.tsx
│   │   │   ├── CommunityMarquee.tsx
│   │   │   ├── DecisionCard.tsx
│   │   │   ├── FeaturesSection.tsx
│   │   │   ├── FlowWalkthrough.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── HeroSection.tsx
│   │   │   ├── Layout.tsx
│   │   │   ├── MembershipCard.tsx
│   │   │   ├── MobileBottomNav.tsx
│   │   │   ├── PageLoader.tsx
│   │   │   ├── WalletProviders.tsx
│   │   │   ├── WalletStatus.tsx
│   │   │   ├── auth/WalletGate.tsx
│   │   │   ├── chat/AshaChat.tsx
│   │   │   ├── community/*.tsx
│   │   │   ├── security/AshaSecurityReview.tsx
│   │   │   └── ui/*.tsx
│   │   ├── contexts/*.tsx
│   │   ├── hooks/*.ts
│   │   ├── index.css
│   │   ├── lib/
│   │   │   ├── access.ts
│   │   │   ├── bounties.ts
│   │   │   ├── chain.ts
│   │   │   ├── chainMappings.ts
│   │   │   ├── communities.ts
│   │   │   ├── communityVisuals.ts
│   │   │   ├── constants.ts
│   │   │   ├── dataStore.ts
│   │   │   ├── env.ts
│   │   │   ├── evm/
│   │   │   ├── memberships.ts
│   │   │   ├── network.ts
│   │   │   ├── payments.ts
│   │   │   ├── phone.ts
│   │   │   ├── phoneAuth.ts
│   │   │   ├── programs/
│   │   │   ├── proposalStatus.ts
│   │   │   ├── rpc.ts
│   │   │   ├── securityReview.ts
│   │   │   ├── seo.ts
│   │   │   ├── stellar.ts
│   │   │   ├── stellarAccounts.ts
│   │   │   ├── stellarSettlements.ts
│   │   │   ├── tokenGate.ts
│   │   │   └── utils.ts
│   │   ├── main.tsx
│   │   ├── pages/*.tsx
│   │   ├── polyfill.ts
│   │   └── test/setup.ts
│   ├── package.json
│   └── vite.config.ts
├── contracts/
│   ├── evm/
│   │   ├── addresses/*.json
│   │   ├── deploys/*.txt
│   │   ├── docs/*.md
│   │   ├── script/*.sol and *.mjs
│   │   ├── src/**/*.sol
│   │   └── test/**/*.sol
│   ├── solana/.gitkeep
│   └── stellar/.gitkeep
├── docs/TESTNET_CONTRACT_API_REVIEW.md
├── programs/
│   ├── community_registry/src/lib.rs
│   ├── governance/src/lib.rs
│   ├── membership/src/lib.rs
│   ├── payment_attestation/src/lib.rs
│   └── treasury_vault/src/lib.rs
├── supabase/migrations/
│   ├── 001_communities_governance_columns.sql
│   ├── 002_payment_orders.sql
│   ├── 003_payment_attestations.sql
│   ├── 004_memberships.sql
│   ├── 005_stellar_settlements.sql
│   ├── 006_bounties_security_stellar.sql
│   └── 007_enable_evm_community_rails.sql
├── tests/anchor-smoke.mjs
├── third_party/anchor-syn-0.30.1/
└── vercel.json
```

Complete tracked file inventory count: 414 files.

## 3. What Is Working

- React/Vite SPA routing for home, explore, bounties, evaluate, launch, profile, dashboard, treasury, proposal details, join flow, admin, and 404.
- Header, mobile nav, chain selector, theme toggle, search, and Asha chat UI.
- Supabase client fallback pattern: when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are missing, communities and bounties use mock/localStorage data.
- Community list, community detail/dashboard, creation form, and local/Supabase community persistence.
- Bounty list with board/grid/list views, status filters, detail page, local/Supabase bounty creation, local/Supabase submissions, and member-gated bounty posting.
- Local membership activation record through `localStorage`.
- Payment order polling endpoint and membership activation endpoint backed by Supabase service role when configured.
- M-Pesa simulator endpoint for sandbox/demo payment orders.
- Stellar Horizon transaction verification endpoint for native XLM payment hashes.
- Stellar SDK helpers for balances, tx confirmation, testnet XLM payment submission, local linked accounts, and local settlement records.
- Solana wallet adapter provider with Phantom, Solflare, and Coinbase adapter packages.
- Stellar Freighter-style browser connection attempt in `WalletStatus`.
- Lightweight injected EVM account connection and testnet switching through `window.ethereum`.
- EVM read client for token supply, governor proposal count, treasury balance, and member token balance using raw JSON-RPC.
- Asha chat is live as a deterministic local response bot.
- Asha security review layer is implemented as deterministic rule checks for communities, proposals, and bounties.
- Admin dashboard route exists and is gated by `VITE_ADMIN_WALLETS`.
- Five Solana Anchor programs exist and compile through `cargo test --workspace`.
- EVM Solidity contract package exists with Manager, Token, Auction, Governor, Treasury, metadata, minter, and tests.
- TypeScript check passed: `npm --prefix app run typecheck`.
- ESLint passed: `npm --prefix app run lint`.
- Previous local contract verification: `cargo test --workspace` passed, with Anchor macro warnings.

## 4. What Is In The UI But Not Built

- Solana write actions are preview-blocked: `useBarazaContract` returns toasts instead of submitting real transactions for join, create community, and vote.
- Bounty payout approval is visual/local only; there is no escrow, payout transaction, owner approval endpoint, or on-chain reward movement.
- Admin reconciliation tables use hardcoded payment orders and mint jobs.
- Admin actions like export, sync, refund approval, retry mint, and reconciliation are preview toasts.
- Asha "AI" is local keyword matching and deterministic safety rules, not a model/API-backed AI security layer.
- Phone/email onboarding stores a local identity session only; no MPC wallet, OTP provider, or account recovery.
- M-Pesa real Daraja/Africa's Talking STK Push/callback is not implemented; only simulator exists.
- Stellar treasury/payout/off-ramp is not implemented; only payment verification exists.
- Chain selector lists many chains with metadata, but only Solana, Stellar payment verification, and EVM read/switch behavior have code behind them.
- Testnet metadata is shown, but Solana programs are not deployed/configured to devnet in this repo state.
- Community health/admin metrics are mostly mock/local computed values, not indexed chain metrics.
- "Create community token", grant eligibility, umbrella treasury, dividends, and mass payouts are not implemented.
- Proposal comments/chat and full audit trail UI are not implemented.

## 5. What Is Completely Missing

- GoodDollar SDK integration.
- GoodDollar Identity contract integration.
- G$ reward token selection and transfer/payout logic.
- Celo-specific GoodDollar bounty rewards.
- XDC integration.
- NEAR, Algorand, Hedera, Tron, Aptos, Sui, Flow, and Chainlink integrations.
- Chain adapter abstraction that routes all actions away from UI components.
- The Graph indexing layer.
- IPFS/Filecoin storage integration.
- Privy or Web3Auth MPC wallet creation and recovery.
- WhatsApp, SMS, Telegram, Discord, and email notification services.
- Real bounty escrow, payout trigger, and dispute resolution.
- Community SPL token minting and optional launch flow.
- Umbrella token, shared liquidity pool, grant circuit breaker, and grant distribution.
- Real-world asset tracking and member return/dividend distribution.
- NFT threshold gate for admin access.
- Soroban/Stellar contract workspace.
- Solana devnet deployment scripts/seed scripts.

## 6. Chain Connections

| Chain | Real or placeholder? | Wallet/account path | Actions supported | Missing |
| --- | --- | --- | --- | --- |
| Solana | Partial real | Phantom/Solflare/Coinbase wallet adapter | Connect account, read attempted treasury/proposal accounts, Anchor IDLs/program clients exist | Devnet deployment, real write txs, SPL mint, membership mint, payment attestation wiring, governance CPI |
| Stellar | Partial real | Freighter-style browser API and local linked account | Horizon tx verification, balance helper, tx confirmation, testnet XLM payment helper | Soroban contracts, treasury state, payouts, M-Pesa on/off ramp, SDP/SEP flows |
| Ethereum | Partial read | Injected EVM wallet | Switch/connect and raw RPC reads for configured contract addresses | Wagmi/viem signing, app-specific deployed testnet validation, membership flow |
| Base | Partial read | Injected EVM wallet / Coinbase suggested | Switch/connect and raw RPC reads for configured contract addresses | Full onboarding flow, writes, real community mapping |
| Arbitrum | Partial read | Injected EVM wallet / Rabby suggested | Switch/connect and raw RPC reads if address config exists | Writes, DeFi community workflows |
| Optimism | Partial read | Injected EVM wallet / MetaMask suggested | Switch/connect and raw RPC reads if address config exists | Writes, public goods DAO workflows |
| Polygon | UI metadata mostly | Injected EVM wallet | Chain metadata and switch target | Token minting flow, app contracts |
| BNB Chain | Disabled placeholder | Trust Wallet suggested | Chain metadata only | Full integration |
| Celo | Partial metadata/read path | Valora/MetaMask suggested | Chain metadata, switch target, public RPC path | GoodDollar/G$ rewards and identity |
| XDC | Missing | None | None | Full integration |
| NEAR | Missing | None | None | Full integration |
| Algorand | Missing | None | None | Full integration |
| Hedera | Missing | None | None | Full integration |
| Tron | Missing | None | None | Full integration |
| Aptos/Sui | Missing | None | None | Full integration |
| Flow | Missing | None | None | Full integration |
| Chainlink | Missing | None | None | CCIP, price feeds, oracle integrations |

Testnet availability status:

- Solana devnet is configured as the default network in env examples and UI metadata, but deployment is blocked locally because the `solana` CLI is missing.
- Stellar testnet Horizon is configured and usable through `/api/stellar/verify-payment`.
- EVM testnet metadata exists for Sepolia/Base Sepolia/Arbitrum Sepolia/OP Sepolia/Polygon Amoy/BNB testnet/Celo Alfajores, but write flows are not implemented.

## 7. Smart Contracts

### Solana

Anchor programs:

- `community_registry`
- `governance`
- `membership`
- `payment_attestation`
- `treasury_vault`

Frontend Solana client files:

- `app/src/lib/programs/client.ts`
- `app/src/lib/programs/pda.ts`
- `app/src/lib/programs/idl/*.ts`
- `app/src/hooks/useBarazaContract.ts`

Status:

- Program code exists.
- Program IDs are hardcoded fallbacks and env-overridable.
- `Anchor.toml` is still `localnet`.
- Reads are attempted through Anchor clients.
- Writes are intentionally blocked in preview mode.
- No confirmed devnet deployment from this machine.

### EVM

Contracts:

- `contracts/evm/src/manager/Manager.sol`
- `contracts/evm/src/token/Token.sol`
- `contracts/evm/src/auction/Auction.sol`
- `contracts/evm/src/governance/governor/Governor.sol`
- `contracts/evm/src/governance/treasury/Treasury.sol`
- plus proxy, metadata, minter, escrow, and utility contracts.

Frontend EVM client:

- `app/src/lib/programs/evmClient.ts`
- `app/src/lib/programs/evmAddresses.ts`
- `app/src/lib/evm/abis.ts`

Status:

- Raw JSON-RPC read calls exist.
- Address files exist for several EVM chain IDs.
- No frontend EVM write/signing flow exists.

### Stellar

Status:

- No Soroban contract exists.
- Stellar implementation is SDK/Horizon payment verification only.

## 8. Type Safety

Checks run:

- `npm --prefix app run typecheck`: passed, no TypeScript errors.
- `npm --prefix app run lint`: passed.

Findings:

- No `as any` usage found in app source.
- IDL files use `as unknown as <IDLType>` casts.
- `app/src/polyfill.ts` uses `globalThis as unknown as GlobalShim`.
- `EthereumProvider.request` returns `Promise<unknown>` and event payloads are typed as `unknown`, which is acceptable for external provider boundaries but should be wrapped before a larger chain adapter rollout.
- Some hook dependency lint suppressions exist in `AshaChat.tsx`, `JoinDao.tsx`, `LiveStatCard.tsx`, and `useBarazaData.ts`.

## 9. Dependencies Needed

Needed for the requested buildathon scope and not currently installed in `app/package.json`:

- `ethers`
- `wagmi`
- `viem`
- `@wagmi/core`
- `@gooddollar/goodprotocol`
- `@solana/spl-token`
- `@privy-io/react-auth`
- `@walletconnect/modal`
- `@apollo/client`
- `graphql`
- `ipfs-http-client`
- `twilio`
- `@sendgrid/mail`
- `bignumber.js`
- `date-fns`
- `zustand`

Already present:

- `@solana/web3.js`
- `@coral-xyz/anchor`
- `@stellar/stellar-sdk`

Potentially needed but not listed in the prompt:

- `@tanstack/react-query` if wagmi v2 patterns are used.
- A maintained IPFS alternative if `ipfs-http-client` compatibility is a concern.

## 10. Risk Flags

- `main` must remain untouched; current branch is correct.
- Uncommitted baseline changes existed before the audit branch was created; they are now committed on `feat/gooddollar-buildathon`.
- Solana CLI missing, so Solana devnet push cannot be completed locally yet.
- Stellar CLI missing, so Soroban/testnet contract deploy cannot be completed locally.
- Solana programs are not confirmed deployed to devnet; `Anchor.toml` uses `localnet`.
- Treasury withdrawals are admin-gated in contract code and must remain disabled until governance CPI is implemented.
- Governance execution marks proposals executed but does not dispatch side effects.
- Payment attestation is not wired from API to on-chain membership activation.
- M-Pesa simulator can create confirmed payment orders; real provider callbacks are missing.
- Supabase service role key is required for durable server-side writes.
- Admin dashboard is gated by public env allowlist only; no backend session/auth guard.
- `VITE_ADMIN_WALLETS` is public by design and cannot be treated as a secret.
- Public RPC endpoints may rate-limit or be unreliable for review.
- EVM address constants appear reused across chains and need verification against intended Baraza deployments.
- DataStore simulates live members/votes/funds with timers, so some UI metrics are not real.
- Sensitive server envs must stay server-only and never use `VITE_`.

## Requirements Verification

Legend: Complete = functional code exists; Partial = some UI or partial logic exists; Missing = not present.

### GOVERNANCE

| Requirement | Status | Evidence |
| --- | --- | --- |
| Yes / No / Abstain voting | Partial | Solana program has `VoteSupport::{Against, For, Abstain}`; UI/data store mostly uses support/object and no full abstain flow. |
| Proposal creation | Partial | UI/data store and Solana instruction exist; frontend write is preview-blocked. |
| Proposal comments and chat | Missing | No comment/chat model or endpoint. |
| Proposal history and audit trail | Partial | Activity feed and lifecycle fields exist; no durable audit log/indexer. |
| Disciplinary vote flow | Partial | Solana `MembershipAction` supports suspend/reinstate/revoke proposal kind; UI flow missing. |
| Governing body election and removal via proposal | Missing | No election/removal flow. |
| Burn-to-vote mechanism | Missing | No burn mechanic. |
| Supermajority override for founder | Missing | No founder override logic. |

### MEMBERSHIP

| Requirement | Status | Evidence |
| --- | --- | --- |
| Soulbound membership tier | Partial | Membership tier program exists; no actual SBT mint/non-transferable token implementation. |
| Token-bound membership tier | Missing | No token-bound account/tier logic. |
| Basic membership tier | Partial | Membership tier/account exists, local/Supabase membership exists. |
| NFT-gated admin dashboard | Missing | Admin gate is wallet allowlist, not NFT threshold. |
| Role and permission system | Partial | Local data roles and token gate helper exist; no durable policy engine. |
| Admin tier levels | Missing | No tiered admin roles. |
| Members voted in and out via proposals | Partial | Contract enum supports membership actions; UI/execution missing. |

### BOUNTY BOARD

| Requirement | Status | Evidence |
| --- | --- | --- |
| Post a bounty | Complete | UI, validation, local/Supabase creation exist. |
| Community-restricted bounties | Partial | Posting is member-gated; applying/access control is not fully enforced by bounty access type. |
| Public bounties | Partial | Open bounties are visible publicly; no explicit access model. |
| G$ as reward token | Missing | No GoodDollar/G$ package or reward token selector. |
| SOL as reward token | Partial | Chain currency conversion displays SOL equivalents; no payout. |
| Community membership gate before bounty access | Partial | Posting is gated; submission/access is not fully gated. |
| Multi-community worker profile | Missing | Profile exists, but no worker profile across bounties/communities. |
| Bounty completion and payout trigger | Partial | Status/submission logic exists locally; no payout trigger. |
| Dispute resolution on bounties | Missing | No dispute model. |

### COMMUNITY TOKENS

| Requirement | Status | Evidence |
| --- | --- | --- |
| Community token creation (SPL mint on Solana) | Missing | No SPL token mint flow. |
| Fundraising token model | Missing | No model. |
| Burn-to-vote token model | Missing | No model. |
| Airdrop reward distribution rules engine | Missing | No rules engine. |
| Percentage of community token sent to umbrella treasury | Missing | No umbrella treasury/token logic. |
| Optional token launch | Missing | No optional launch flow. |

### UMBRELLA TOKEN

| Requirement | Status | Evidence |
| --- | --- | --- |
| Shared liquidity pool fed by community token percentages | Missing | No umbrella token. |
| Grant eligibility checks | Missing | No eligibility engine. |
| Treasury floor circuit breaker | Missing | No circuit breaker. |
| Grant distribution | Missing | No grant distribution. |
| Incentives for new community creation | Missing | No incentive engine. |
| Member join incentives | Missing | No incentive engine. |
| Operational costs/salaries/events funding | Missing | No budgeting module. |

### CHAIN INTEGRATIONS

| Requirement | Status | Evidence |
| --- | --- | --- |
| Solana governance/membership/bounty/soulbound | Partial | Contracts and UI exist, writes not deployed/wired. |
| Stellar payments/treasury/M-Pesa on/off ramp | Partial | Horizon payment verification only. |
| Celo G$ bounty rewards/GoodDollar Identity | Missing | Celo metadata only. |
| XDC extended G$ ecosystem | Missing | No XDC. |
| Ethereum high-value DAO memberships | Partial | EVM contracts/read metadata exist; no product flow. |
| Base new user onboarding | Partial | Chain selector/EVM connect only. |
| Arbitrum DeFi communities | Partial | Chain selector/EVM connect only. |
| Optimism public goods DAOs | Partial | Chain selector/EVM connect only. |
| Polygon token minting | Missing | Metadata only. |
| BNB Chain African crypto users | Missing | Disabled metadata only. |
| NEAR human-readable accounts | Missing | No NEAR. |
| Algorand carbon-neutral fintech | Missing | No Algorand. |
| Hedera enterprise compliance | Missing | No Hedera. |
| Tron USDT movement | Missing | No Tron. |
| Aptos / Sui fast cheap transactions | Missing | No Aptos/Sui. |
| Flow NFT soulbound credentials | Missing | No Flow. |
| Chainlink CCIP/feeds/oracles | Missing | No Chainlink. |

### CHAIN ADAPTER

| Requirement | Status |
| --- | --- |
| Single adapter layer routing all actions | Missing |
| `governance.vote()` to Solana | Missing |
| `treasury.pay()` to Stellar | Missing |
| `bounty.reward()` to Celo/G$ | Missing |
| `membership.verify(NFT)` to asset chain | Missing |
| `identity.check()` to Celo/GoodDollar Identity | Missing |
| `data.query()` to The Graph | Missing |
| `storage.save()` to IPFS | Missing |
| No chain called directly from UI components | Missing |

### WALLET & ONBOARDING

| Requirement | Status | Evidence |
| --- | --- | --- |
| Wallet creation via email (MPC) | Missing | Local email identity only. |
| Wallet creation via phone number (MPC) | Missing | Local phone identity only. |
| Key backup and recovery | Missing | No MPC. |
| No seed phrase complexity for basic users | Partial | Phone/email UI exists but not a wallet. |
| Mass payment to verified members | Missing | No payout engine. |
| Dividend distribution from treasury | Missing | No dividends. |
| Payout to wallet/mobile/email | Missing | No payout provider integration. |
| Verified accounts only for payouts | Missing | No verification/payout gate. |

### NOTIFICATIONS

| Requirement | Status |
| --- | --- |
| WhatsApp bot | Missing |
| SMS bot | Missing |
| Telegram bot | Missing |
| Discord integration | Missing |
| Email notifications | Missing |

### INFRASTRUCTURE

| Requirement | Status |
| --- | --- |
| Chain adapter pattern | Missing |
| The Graph indexing | Missing |
| IPFS/Filecoin storage | Missing |
| GoodDollar SDK | Missing |
| GoodDollar Identity contract integration | Missing |
| Privy or Web3Auth MPC wallet | Missing |
| WalletConnect across all EVM chains | Partial, WalletConnect project env exists but no wagmi/modal EVM integration |
| Wagmi for EVM chain management | Missing |
| Stellar SDK | Complete |
| `@solana/web3.js` | Complete |

### AI GUIDE — ASHA

| Question | Status |
| --- | --- |
| Is Asha live or placeholder? | Live local deterministic helper; not external AI. |
| Is it marked Coming Soon? | No. |
| Is the button disabled? | No. |

### REAL WORLD ASSETS

| Requirement | Status |
| --- | --- |
| Community pooled investment in real assets | Partial narrative/UI examples only |
| On-chain asset tracking | Missing |
| Proportional member returns | Missing |
| Dividend distribution | Missing |

### ADMIN DASHBOARD

| Requirement | Status | Evidence |
| --- | --- | --- |
| NFT threshold gate for access | Missing | Wallet allowlist only. |
| Add and remove members | Missing | No admin member mutation UI/API. |
| Assign administrative roles | Missing | No role assignment UI/API. |
| Trigger mass payouts and dividends | Missing | No payout engine. |
| Community health metrics | Partial | Dashboard shows computed/mock metrics and Asha reviews. |
| Grant eligibility status display | Missing | No grant engine. |
| Bad debt flagging | Missing | No debt model. |
| Governing body management | Missing | No governing body module. |

## Phase 1 Summary

The current app is a strong review prototype with real UI coverage, Supabase/local persistence, deterministic Asha review rules, Stellar Horizon payment verification, Solana Anchor program scaffolding, and EVM read scaffolding. It is not yet a full GoodDollar/buildathon implementation. The largest missing foundations are the chain adapter, GoodDollar/Celo integration, MPC onboarding, notification services, IPFS/The Graph, payout systems, community/umbrella token logic, and real on-chain write execution.

Testnet must be available for the sprint. The repo is closest on Stellar testnet verification and Solana devnet readiness, but Solana devnet deployment requires installing the Solana CLI, deploying the five programs, updating Vercel env program IDs, and seeding test data.

# Baraza Testnet Contract and API Review

Date: 2026-05-26

This review covers the current Solana and Stellar surfaces needed for a testnet push. It is intentionally practical: what exists, what is deployable, which APIs are exposed, and what must be configured before reviewers test live payments and governance.

## Executive Readiness

| Area | Status | Notes |
| --- | --- | --- |
| Solana Anchor contracts | Ready to build, not yet configured for devnet deploy | Five programs exist and compile through `cargo test --workspace`. `Anchor.toml` still points at `localnet`. |
| Solana CLI/deploy path | Blocked on local CLI | `anchor-cli 0.30.1` is installed, but `solana` CLI is not available in PATH on this machine. |
| Stellar contracts | Not present | The repo has Stellar Horizon payment verification/client helpers, but no Soroban contract workspace or WASM artifact. |
| Stellar testnet verification | Ready for API testing | `/api/stellar/verify-payment` verifies native XLM payment transactions through Horizon testnet. |
| Server persistence | Depends on env vars | API routes write to Supabase only when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. |

## Contract Review Findings

### Blockers Before Production Treasury Movement

1. Treasury withdrawals are proposal-gated but still disabled for public review.
   - File: `programs/treasury_vault/src/lib.rs`
   - `release_sol` requires `withdrawals_enabled`, the configured release-authority signer, an executed governance `TreasuryRelease` proposal with matching community, native SOL recipient, and amount, and initializes a one-time release receipt PDA to block replay.
   - Governance `execute_proposal` dispatches native SOL treasury releases by CPI. The release authority is transferable with a two-step handoff so production deployments can assign a Squads vault PDA.
   - Existing treasury vault PDAs created before the release-authority fields were added must be migrated or recreated after upgrading the program; their previous allocation is too small for the new account layout.
   - Testnet recommendation: keep `withdrawals_enabled = false` for public review. Allow deposits and balances only.

2. Governance execution only dispatches native SOL treasury releases.
   - File: `programs/governance/src/lib.rs`
   - `execute_proposal` transitions proposals to `Executed` and dispatches `TreasuryRelease` into `treasury_vault`. Membership actions and rule changes are still TODO.
   - Testnet recommendation: label execution as a governance signal until CPI is implemented.

3. Membership activation depends on payment attestation, but the off-chain-to-on-chain attestation path is not wired end to end.
   - File: `programs/membership/src/lib.rs`
   - `activate_member` validates a consumed `PaymentAttestationAccount`, but the API routes currently write Supabase membership/order rows rather than submitting Anchor instructions.
   - Testnet recommendation: treat Supabase membership as the app source for review, and schedule on-chain attestation wiring as the next contract task.

4. Community member count is admin-maintained.
   - File: `programs/community_registry/src/lib.rs`
   - `bump_member_count` has a TODO to restrict the caller to the membership program by CPI. Current placeholder is admin-only.
   - Testnet recommendation: do not use this count as a hard security gate.

5. Stellar Soroban contract is missing.
   - Searched repo for Soroban/contract artifacts; only SDK dependencies were found under `node_modules`.
   - Testnet recommendation: push Stellar payment verification first. Create a Soroban contract workspace only when Stellar-native governance/treasury state is required.

### Moderate Risks

1. SPL deposits are event-only.
   - File: `programs/treasury_vault/src/lib.rs`
   - `record_spl_deposit` emits an event and increments counters but does not verify token balance movement.

2. Governance snapshot inputs are admin-provided.
   - File: `programs/governance/src/lib.rs`
   - `activate_proposal` accepts `total_eligible_weight` and `total_eligible_members` from the admin. Future CPI should read this from membership state.

3. Public frontend has fallback program IDs.
   - File: `app/src/lib/programs/pda.ts`
   - This is useful for demos, but deployed testnet should explicitly set all program IDs in Vercel after deploy.

## Solana Program Surface

| Program | Current ID | Core instructions |
| --- | --- | --- |
| `community_registry` | `Ggj4e8YjiDdpbcudKz6BLx5arT9nf7BQR498VnLXd7eD` | `create_community`, `update_metadata`, `nominate_admin`, `accept_admin`, `cancel_admin_nomination`, `set_status`, `bump_member_count` |
| `governance` | `DzMhDFtq2s2bUn4LNDVzDLLnbbRQ8jW1FKeWPQDDq25A` | `initialize_config`, `create_proposal`, `activate_proposal`, `cast_vote`, `finalize_proposal`, `queue_proposal`, `execute_proposal`, `expire_proposal`, `cancel_proposal`, `veto_proposal` |
| `membership` | `34MQRw2XSScvMYTiyYLix31qnrmh9vARwpmXM6ycNtuK` | `create_tier`, `update_tier`, `set_tier_status`, `register_member`, `activate_member`, `suspend_member`, `reinstate_member`, `revoke_member`, `mark_expired`, `migrate_wallet`, `update_member_tier` |
| `payment_attestation` | `Az2CdHJFBLxRY6pigkYSsni6A8N1dQo3JUp3d62NGVpT` | `initialize_config`, `transfer_trusted_attester`, `nominate_authority`, `cancel_authority_nomination`, `accept_authority`, `attest_payment`, `consume_payment_for_mint`, `void_payment_attestation` |
| `treasury_vault` | `ApPdkfooQLdVN8gAXRnddbtttruYNihiwjanYtXUnxYy` | `initialize_vault`, `deposit_sol`, `record_spl_deposit`, `release_sol`, `enable_withdrawals`, `disable_withdrawals`, `set_vault_status`, `nominate_admin`, `cancel_admin_nomination`, `accept_admin`, `nominate_release_authority`, `cancel_release_authority_nomination`, `accept_release_authority` |

## API List

| Endpoint | Method | Purpose | Required input | Env vars | Side effect |
| --- | --- | --- | --- | --- | --- |
| `/api/stellar/verify-payment` | `POST` | Verify a Stellar testnet/mainnet native XLM payment by transaction hash | `communityId`, `txHash`, `amountXlm` | `STELLAR_NETWORK`, `STELLAR_HORIZON_URL`, `STELLAR_TREASURY_ACCOUNT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Inserts `payment_orders` row when Supabase is configured; mainnet fails closed unless a valid treasury G-account is configured |
| `/api/membership/activate` | `POST` | Activate a membership after a confirmed/reconciled payment order | `orderId`, `communityId`, `walletAddress`, `activationSecret` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Atomically binds the single-use payment order wallet, rejects sandbox orders in production, then inserts/returns a `memberships` row |
| `/api/payment-orders/status` | `GET` | Poll safe payment order status | `orderId` query param, `x-activation-secret` header | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Read-only; activation credentials stay out of URLs |
| `/api/cron/promote-orders` | Any | Promote sandbox demo payment orders along the status lifecycle | Bearer `CRON_SECRET` in production | `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Updates sandbox `payment_orders.status` only; production orders require real attestation/indexer evidence |
| `/api/mpesa/simulate` | `POST` | Sandbox-only simulated mobile-money payment | `phone`, `communityId`, `amount`, optional `tierId`, `currency` | `MPESA_SIMULATOR_ENABLED`, `MPESA_SIMULATOR_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Inserts `payment_orders` row when Supabase is configured |
| `/api/payments/brza-membership` | `POST` | Trusted server workflow for idempotent Kotani M-Pesa -> BRZA membership initiation | Bearer `PAYMENT_ADAPTER_PROXY_SECRET`; `phone`, community fields, `amountKes`, `idempotencyKey` | `PAYMENT_ADAPTER_PROXY_SECRET`, `PAYMENT_PHONE_HASH_PEPPER`, `KOTANI_PAY_API_KEY`, `KOTANI_API_BASE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Inserts a hashed `payment_orders` row before calling Kotani, then records pending or failed state; reconciliation performs confirmation |
| `/api/payments/reconcile-brza-membership` | `POST` | Trusted reconciliation for a pending Kotani BRZA membership payment | Bearer `PAYMENT_ADAPTER_PROXY_SECRET`; `orderId` | `PAYMENT_ADAPTER_PROXY_SECRET`, `KOTANI_PAY_API_KEY`, `KOTANI_API_BASE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Reads the ledger order and Kotani status, then records confirmed, failed, expired, or amount-mismatch state |

## Required Testnet Env Vars

### Frontend

```env
VITE_SITE_URL=https://baraza-protocol.vercel.app
VITE_SOLANA_NETWORK=devnet
VITE_RPC_ENDPOINT=https://api.devnet.solana.com
VITE_STELLAR_NETWORK=testnet
VITE_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_COMMUNITY_REGISTRY_PROGRAM_ID=<solana-devnet-program-id>
VITE_GOVERNANCE_PROGRAM_ID=<solana-devnet-program-id>
VITE_MEMBERSHIP_PROGRAM_ID=<solana-devnet-program-id>
VITE_PAYMENT_ATTESTATION_PROGRAM_ID=<solana-devnet-program-id>
VITE_TREASURY_VAULT_PROGRAM_ID=<solana-devnet-program-id>
VITE_SUPABASE_URL=<supabase-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
VITE_WALLETCONNECT_PROJECT_ID=<walletconnect-project-id>
```

### Server Only

```env
SUPABASE_URL=<supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
CRON_SECRET=<strong-random-secret>
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_TREASURY_ACCOUNT=<testnet-g-account>
STELLAR_SOROBAN_RPC=https://soroban-testnet.stellar.org
MPESA_CONSUMER_KEY=<daraja-sandbox-key>
MPESA_CONSUMER_SECRET=<daraja-sandbox-secret>
MPESA_SHORTCODE=<daraja-sandbox-shortcode>
MPESA_PASSKEY=<daraja-sandbox-passkey>
MPESA_CALLBACK_URL=https://baraza-protocol.vercel.app/api/mpesa/callback
```

## Solana Devnet Push Plan

1. Install Solana CLI locally and confirm `solana --version`.
2. Fund the deployer on devnet:
   ```powershell
   solana config set --url devnet
   solana airdrop 5 <DEPLOYER_PUBKEY>
   ```
3. Build the Anchor workspace:
   ```powershell
   anchor build
   cargo test --workspace
   ```
4. Deploy to devnet:
   ```powershell
   anchor deploy --provider.cluster devnet
   ```
5. Save deployed program IDs in Vercel:
   - `VITE_COMMUNITY_REGISTRY_PROGRAM_ID`
   - `VITE_GOVERNANCE_PROGRAM_ID`
   - `VITE_MEMBERSHIP_PROGRAM_ID`
   - `VITE_PAYMENT_ATTESTATION_PROGRAM_ID`
   - `VITE_TREASURY_VAULT_PROGRAM_ID`
6. Seed one review community on devnet:
   - Create community
   - Create membership tier
   - Initialize governance config
   - Initialize treasury vault
   - Keep treasury withdrawals disabled
7. Run reviewer smoke:
   - Connect Phantom on Solana devnet
   - Browse group
   - Join group through demo payment path
   - Create proposal
   - Cast vote
   - Deposit SOL into treasury vault
   - Confirm program accounts on Solana Explorer devnet

## Stellar Testnet Push Plan

1. Create/fund a Stellar testnet treasury account with Friendbot.
2. Set:
   - `STELLAR_TREASURY_ACCOUNT`
   - `STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org`
   - `VITE_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org`
3. Send a small native XLM payment to the treasury account with a real Stellar testnet account.
4. Verify it through:
   ```powershell
   Invoke-RestMethod -Method Post `
     -Uri https://baraza-protocol.vercel.app/api/stellar/verify-payment `
     -ContentType application/json `
     -Body '{"communityId":"ky","txHash":"<64-char-hash>","amountXlm":1}'
   ```
5. Confirm response includes:
   - `status: PAYMENT_CONFIRMED`
   - `rail: stellar`
   - `ledger`
   - `persisted: true` when Supabase env is configured
6. Only after this should a Soroban contract be added for Stellar-native governance/treasury execution.

## Verification Completed Locally

```text
anchor-cli 0.30.1
cargo test --workspace: passed
Vitest Stellar suite: 3 files passed, 20 tests passed
solana CLI: missing from PATH
stellar CLI: missing from PATH
```

`cargo test --workspace` emits Anchor/Solana macro `unexpected cfg` warnings from Anchor 0.30.1 dependencies. These are warnings, not test failures, but should be triaged before strict CI is enabled.

## Next Contract Tasks

1. Add Solana CLI to the deploy environment and run `anchor build`.
2. Change testnet deployment config from `localnet` to `devnet` or always deploy with `--provider.cluster devnet`.
3. Deploy the five Solana programs and update Vercel program ID env vars.
4. Add a seed script for community, tier, governance config, and vault initialization.
5. Wire Supabase payment orders to `payment_attestation::attest_payment`, `consume_payment_for_mint`, and `membership::activate_member`.
6. Hand the release authority to the production Squads vault PDA and test a real governance-dispatched treasury release before enabling withdrawals.
7. Decide whether Stellar needs only payment verification or a Soroban governance contract. If Soroban is needed, scaffold it as a separate contract workspace and add build/deploy docs.

# Mainnet V2 Upgrade Runbook

## Scope

This runbook covers:

- Mainnet rollout from `1.2.0` to `2.0.0` for contracts with logic changes: `Manager`, `Token`, `Auction`, `Governor`
- Keeping `MetadataRenderer` and `Treasury` on `1.2.0` (no logic/storage diff from `v1.2.0`)
- Manager owner actions through governance proposal or multisig
- Upgrade path for existing DAOs and expected behavior for newly deployed DAOs

## Current Mainnet Baseline

Baraza has not deployed these contracts to Ethereum mainnet — `addresses/1.json`
holds NOT_DEPLOYED placeholders. When a Baraza deployment lands, record the
live values in `addresses/1.json` and fill in the placeholders below. Do not
fill them in with any other protocol's addresses.

- Last verified on: `<date>`
- Manager proxy: `<MANAGER_PROXY>` (from `addresses/1.json`)
- Current manager owner: `<MANAGER_OWNER>`
- Current canonical impls in `addresses/1.json`:
  - Token: `<TOKEN_IMPL>`
  - Auction: `<AUCTION_IMPL>`
  - Governor: `<GOVERNOR_IMPL>`
  - MetadataRenderer: `<METADATA_IMPL>` (keep)
  - Treasury: `<TREASURY_IMPL>` (keep)

Re-derive immediately before any upgrade action:

```bash
RPC_ALIAS=mainnet
MANAGER_PROXY=<manager-proxy-address-from-addresses/1.json>

# Manager owner
cast call $MANAGER_PROXY "owner()(address)" --rpc-url $RPC_ALIAS

# Current canonical impls from manager
cast call $MANAGER_PROXY "tokenImpl()(address)" --rpc-url $RPC_ALIAS
cast call $MANAGER_PROXY "auctionImpl()(address)" --rpc-url $RPC_ALIAS
cast call $MANAGER_PROXY "governorImpl()(address)" --rpc-url $RPC_ALIAS
cast call $MANAGER_PROXY "metadataImpl()(address)" --rpc-url $RPC_ALIAS
cast call $MANAGER_PROXY "treasuryImpl()(address)" --rpc-url $RPC_ALIAS

# Optional: manager proxy implementation slot (EIP-1967)
cast storage $MANAGER_PROXY 0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC --rpc-url $RPC_ALIAS
```

Run these checks right before deployment/proposal execution so the listed owner and implementation values are confirmed live.

## Preflight

1. Update `addresses/1.json` with the intended `BarazaRewardsRecipient` used by the new `Manager` constructor.
2. Export env vars:

```bash
export NETWORK=mainnet
export PRIVATE_KEY=<deployer_private_key>
```

RPC and verification keys are resolved from `foundry.toml` aliases and `.env` endpoint vars.

3. Confirm deployment script target: `script/DeployV2Upgrade.s.sol`.
4. Optional: run dry-run without broadcast first.

## Phase 1: Deploy New V2 Implementations

Run:

```bash
yarn deploy:v2-upgrade
```

This deploys:

- `NEW_TOKEN_IMPL`
- `NEW_AUCTION_IMPL`
- `NEW_GOVERNOR_IMPL`
- `NEW_MANAGER_IMPL`

Auction reward policy in this rollout:

- `barazaRewardsBPS = 250` (2.5%)
- `referralRewardsBPS = 250` (2.5%)

Note: this 2.5% is an **EVM-specific auction reward split**, intentionally distinct
from the 2% `treasuryTxPct` defined in `app/src/lib/brza/constants.ts`. The core
constant governs Stellar-side treasury transactions; this EVM-side BPS governs
auction-mechanism rewards on EVM mainnet only. Flagged in
`docs/TOKENOMICS_AUDIT_REPORT.md` (2026-06-14) and confirmed intentional.

Outputs are written to `deploys/1.version2_upgrade.txt`.

Note: deployment scripts in this repo do not auto-write contract address fields to `addresses/1.json`; update those fields manually from `deploys/1.version2_upgrade.txt`. WETH is read from `addresses/1.json`.

## Phase 2: Update Manager (Root Upgrade Policy)

Manager owner must execute these actions:

1. `Manager.upgradeTo(NEW_MANAGER_IMPL)`
2. Register `Token` upgrades:
   - `<PRIOR_TOKEN_IMPL_1_1_0> -> NEW_TOKEN_IMPL` (1.1.0)
   - `<PRIOR_TOKEN_IMPL_1_2_0> -> NEW_TOKEN_IMPL` (1.2.0)
3. Register `Auction` upgrades:
   - `<PRIOR_AUCTION_IMPL_1_1_0> -> NEW_AUCTION_IMPL` (1.1.0)
   - `<PRIOR_AUCTION_IMPL_1_2_0> -> NEW_AUCTION_IMPL` (1.2.0)
4. Register `Governor` upgrades:
   - `<PRIOR_GOVERNOR_IMPL_1_1_0> -> NEW_GOVERNOR_IMPL` (1.1.0)
   - `<PRIOR_GOVERNOR_IMPL_1_2_0> -> NEW_GOVERNOR_IMPL` (1.2.0)

Prior-impl addresses come from your deployment manifests (`deploys/`) once a
Baraza mainnet deployment exists.

Generate calldata:

```bash
cast calldata "upgradeTo(address)" $NEW_MANAGER_IMPL
cast calldata "registerUpgrade(address,address)" $PRIOR_TOKEN_IMPL_1_1_0 $NEW_TOKEN_IMPL
cast calldata "registerUpgrade(address,address)" $PRIOR_TOKEN_IMPL_1_2_0 $NEW_TOKEN_IMPL
cast calldata "registerUpgrade(address,address)" $PRIOR_AUCTION_IMPL_1_1_0 $NEW_AUCTION_IMPL
cast calldata "registerUpgrade(address,address)" $PRIOR_AUCTION_IMPL_1_2_0 $NEW_AUCTION_IMPL
cast calldata "registerUpgrade(address,address)" $PRIOR_GOVERNOR_IMPL_1_1_0 $NEW_GOVERNOR_IMPL
cast calldata "registerUpgrade(address,address)" $PRIOR_GOVERNOR_IMPL_1_2_0 $NEW_GOVERNOR_IMPL
```

Use your manager owner path:

- If owner is DAO treasury: submit one governance proposal containing all calls above.
- If owner is multisig: execute the same calls from multisig in that order.

## Governance Note (Economic Change)

Suggested proposal note for v2 rollout:

"This upgrade includes a change to Auction rewards policy. The new Auction implementation sets `barazaRewardsBPS=250` and `referralRewardsBPS=250` (2.5% each). For upgraded DAOs, settled auction proceeds will allocate these reward splits through protocol rewards before the remainder is transferred to treasury. MetadataRenderer and Treasury implementations remain unchanged in this release."

## Phase 3: Existing DAO Upgrades

Each DAO upgrades itself through its own governance proposal.

Required call sequence per DAO:

1. `Token.upgradeTo(NEW_TOKEN_IMPL)`
2. `Auction.pause()`
3. `Auction.upgradeTo(NEW_AUCTION_IMPL)`
4. `Auction.unpause()`
5. `Governor.upgradeTo(NEW_GOVERNOR_IMPL)`

Notes:

- `Auction` upgrade requires the contract to be paused (`whenPaused` in `_authorizeUpgrade`).
- `MetadataRenderer` and `Treasury` are intentionally unchanged in this rollout.

## New DAOs After Manager Update

After manager proxy is upgraded to `NEW_MANAGER_IMPL`, new DAOs deployed via `Manager.deploy(...)` will use:

- Token/Auction/Governor: v2 impls
- MetadataRenderer/Treasury: existing 1.2.0 impls configured in manager constructor

No retrofit proposal is needed for these newly deployed DAOs.

## Verification Checklist

1. Manager proxy implementation equals `NEW_MANAGER_IMPL`.
2. `tokenImpl()`, `auctionImpl()`, `governorImpl()` equal new impl addresses.
3. `metadataImpl()` and `treasuryImpl()` remain unchanged.
4. `isRegisteredUpgrade(base, new)` returns `true` for all six registrations.
5. `getLatestVersions()` returns:
   - token `2.0.0`
   - metadata `1.2.0`
   - auction `2.0.0`
   - treasury `1.2.0`
   - governor `2.0.0`
6. For each upgraded DAO, `getDAOVersions(token)` reflects expected versions.

## Operational Safety

- Run one canary DAO upgrade before broad DAO batch upgrades.
- Keep pause/upgrade/unpause in one DAO proposal where possible.
- Preserve all historical registrations unless there is a clear reason to remove.
- Store all deployed addresses and ownership state updates in JSON manifests.

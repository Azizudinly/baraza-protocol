# Deployment Workflows

This doc covers the main deployment and maintenance commands in `package.json`.

## Supported Networks

Only these network aliases are supported in this workspace:

- `mainnet` (`1`)
- `sepolia` (`11155111`)
- `optimism` (`10`)
- `optimism_sepolia` (`11155420`)
- `base` (`8453`)
- `base_sepolia` (`84532`)

Deprecated networks `4` and `5` are removed.

## Required Env

Minimum env for deploy commands:

- `NETWORK` (must match one alias above)
- `PRIVATE_KEY`

RPC aliases and explorer settings are configured in `foundry.toml` using:

- `[rpc_endpoints]`
- `[etherscan]`

Common env variables used by those sections:

- `MAINNET_RPC_URL`
- `SEPOLIA_RPC_URL`
- `OPTIMISM_RPC_URL`
- `OPTIMISM_SEPOLIA_RPC_URL`
- `BASE_RPC_URL`
- `BASE_SEPOLIA_RPC_URL`
- `ETHERSCAN_API_KEY`
- `OPTIMISTIC_ETHERSCAN_API_KEY`
- `BASESCAN_API_KEY`

## Main Deploy Commands

- `yarn deploy:v2-core`

  - Deploy a full fresh v2 core stack (manager proxy + all impls).
  - Output file: `deploys/<chainid>.version2_core.txt` (from `block.chainid`).
  - Use for new environments, not mainnet upgrade migration.

- `yarn deploy:v2-upgrade`

  - Deploy only new v2 upgrade impls for existing manager deployments.
  - Deploys: Token, Auction, Governor, Manager impl.
  - Auction implementation is configured with `barazaRewardsBPS=250` and `referralRewardsBPS=250`.
  - Reuses Metadata/Treasury/WETH/BarazaRewardsRecipient addresses from `addresses/<chainid>.json`.
  - Output file: `deploys/<chainid>.version2_upgrade.txt`.

- `yarn deploy:v2-new`

  - Deploys MerkleReserveMinter plus L2MigrationDeployer.
  - Requires `CrossDomainMessenger` in `addresses/<chainid>.json`.
  - Output file: `deploys/<chainid>.version2_new.txt`.

- `yarn deploy:erc721-redeem-minter`

  - Deploys ERC721 redeem minter only.
  - Output file: `deploys/<chainid>.erc721_redeem_minter.txt`.

- `yarn deploy:dao`

  - Runs `DeployNewDAO.s.sol` sample DAO deployment flow.
  - Intended for controlled deployment/testing flows.

## Ownership and Address Maintenance

- `yarn addresses:check-manager-owner`

  - Reads live `Manager.owner()` on supported networks.
  - Compares against `ManagerOwner` in `addresses/*.json`.
  - Non-zero exit when drift exists.

- `yarn addresses:sync-manager-owner`

  - Same as check, but writes updates to `addresses/*.json`.

- `yarn addresses:check-baraza-rewards`

  - Reads live `manager.barazaRewardsRecipient()` where available.
  - Compares against `BarazaRewardsRecipient` in `addresses/*.json`.
  - Prints current Auction `barazaRewardsBPS/referralRewardsBPS` for each network when callable.

- `yarn addresses:sync-baraza-rewards`

  - Same as check, but writes `BarazaRewardsRecipient` updates when on-chain value is available.

- `yarn upgrade:check-status`

  - Prints manager owner/latest implementation/version status.
  - Checks registered upgrades against known legacy base impls (mainnet matrix).
  - Uses upgrade targets from `addresses/<chainid>.json`.
  - Select network via `NETWORK` (defaults to `mainnet`).

Optional scoped run:

```bash
node script/updateManagerOwner.mjs --write --chain-ids 1,8453
```

```bash
node script/checkBarazaRewardsConfig.mjs --write --chain-ids 1,8453
```

## Address Book Update Policy

Current policy in this repo:

- Scripts use `block.chainid` to resolve `addresses/<chainid>.json` and write outputs to `deploys/<chainid>.*.txt`.
- Contract address fields in `addresses/<chainid>.json` are updated manually from deployment output files.
- The single automatic sync is `ManagerOwner` via `script/updateManagerOwner.mjs`.
- `BarazaRewardsRecipient` is operator-managed; `script/checkBarazaRewardsConfig.mjs` provides check/sync utilities when the on-chain getter is available.

Recommended post-deploy sequence:

1. Run deploy command and capture generated `deploys/*.txt` output.
2. Manually update `addresses/<chainid>.json` contract address fields.
3. Run `yarn addresses:sync-manager-owner` and `yarn addresses:sync-baraza-rewards`.
4. Commit `deploys/*` and `addresses/*` changes together.

## Example Upgrade Flow

```bash
source .env
export NETWORK=mainnet
yarn deploy:v2-upgrade
yarn addresses:sync-manager-owner
```

Then execute manager owner actions and DAO upgrades using:

- `docs/mainnet-v2-upgrade-runbook.md`
- `docs/manager-ownership-runbook.md`

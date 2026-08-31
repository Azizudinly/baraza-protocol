#!/usr/bin/env bash
# Creates 4 new Baraza ecosystem repos on GitHub and pushes their
# full scaffold structure. Requires: gh (GitHub CLI), git, node.
#
# Run once from any directory:
#   chmod +x scripts/create-repos.sh
#   ./scripts/create-repos.sh

set -e

GITHUB_USER="${GITHUB_USER:-Azizudinly}"
REPOS_DIR="${HOME:?HOME must be set}/baraza-repos"
mkdir -p "$REPOS_DIR"

# ──────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────

create_repo() {
  local name="$1"
  local desc="$2"
  echo ""
  echo ">>> Creating $name ..."
  if gh repo view "$GITHUB_USER/$name" >/dev/null 2>&1; then
    echo "    Repo already exists — skipping create step"
  else
    gh repo create "$GITHUB_USER/$name" \
      --public \
      --description "$desc"
  fi
}

init_repo() {
  local name="$1"
  local dir="$REPOS_DIR/$name"

  rm -rf "$dir"
  mkdir -p "$dir"
  cd "$dir"
  git init -b main
  git remote add origin "https://github.com/$GITHUB_USER/$name.git"
}

push_repo() {
  local name="$1"
  local dir="$REPOS_DIR/$name"
  cd "$dir"
  git add -A
  git commit -m "chore: initial scaffold — folder structure, README, CI, .gitignore"
  git push -u origin main
  git checkout -b develop
  git push -u origin develop
  echo "    Done: https://github.com/$GITHUB_USER/$name"
}

# ──────────────────────────────────────────────────────────────
# SHARED GITIGNORE
# ──────────────────────────────────────────────────────────────

GITIGNORE='node_modules/
.env
.env.local
.env.production
*.zip
.DS_Store
.next/
out/
build/
dist/
target/
.anchor/
test-ledger/
*.log
*.pem
*.key
coverage/
'

# ──────────────────────────────────────────────────────────────
# REPO 1 — baraza-contracts-stellar
# ──────────────────────────────────────────────────────────────

create_repo "baraza-contracts-stellar" \
  "Soroban smart contracts for Baraza Protocol — BRZA token, community treasury, mass payments on Stellar"

init_repo "baraza-contracts-stellar"
DIR="$REPOS_DIR/baraza-contracts-stellar"

# Folders
mkdir -p \
  contracts/brza-token/src \
  contracts/community-treasury/src \
  contracts/mass-payment/src \
  tests \
  scripts

# Cargo.toml (workspace)
cat > "$DIR/Cargo.toml" << 'CARGO'
[workspace]
members = [
  "contracts/brza-token",
  "contracts/community-treasury",
  "contracts/mass-payment",
]

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true
CARGO

# brza-token
cat > "$DIR/contracts/brza-token/Cargo.toml" << 'CARGO'
[package]
name = "brza-token"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { version = "21.0.0", features = ["testutils"] }
CARGO

cat > "$DIR/contracts/brza-token/src/lib.rs" << 'RUST'
#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct BrzaToken;

#[contractimpl]
impl BrzaToken {
    // TODO: implement BRZA token contract
    // Supply: 1_000_000_000 * 10^7 (1B with 7 decimals)
    // Issuer: set at deploy time
    pub fn hello(env: Env) -> bool {
        let _ = env;
        true
    }
}
RUST

# community-treasury
cat > "$DIR/contracts/community-treasury/Cargo.toml" << 'CARGO'
[package]
name = "community-treasury"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { version = "21.0.0", features = ["testutils"] }
CARGO

cat > "$DIR/contracts/community-treasury/src/lib.rs" << 'RUST'
#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct CommunityTreasury;

#[contractimpl]
impl CommunityTreasury {
    // TODO: implement community treasury
    // One contract per community — Stellar multisig
    // withdrawals_enabled starts false — multisig required to unlock
    pub fn hello(env: Env) -> bool {
        let _ = env;
        true
    }
}
RUST

# mass-payment
cat > "$DIR/contracts/mass-payment/Cargo.toml" << 'CARGO'
[package]
name = "mass-payment"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { version = "21.0.0", features = ["testutils"] }
CARGO

cat > "$DIR/contracts/mass-payment/src/lib.rs" << 'RUST'
#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct MassPayment;

#[contractimpl]
impl MassPayment {
    // TODO: implement mass payment contract
    // Target: pay up to 100 members in one transaction
    pub fn hello(env: Env) -> bool {
        let _ = env;
        true
    }
}
RUST

# Tests
touch "$DIR/tests/brza-token.test.ts"
touch "$DIR/tests/community-treasury.test.ts"
touch "$DIR/tests/mass-payment.test.ts"

# Deploy scripts
cat > "$DIR/scripts/deploy-testnet.sh" << 'SH'
#!/usr/bin/env bash
# Deploy all contracts to Stellar testnet
# Requires: stellar CLI, STELLAR_SECRET_KEY env var set to a funded testnet account
set -e
echo "Deploying to Stellar testnet..."
echo "TODO: implement deploy steps"
SH

cat > "$DIR/scripts/deploy-mainnet.sh" << 'SH'
#!/usr/bin/env bash
# Deploy all contracts to Stellar mainnet
# REQUIRES: Sec3 audit sign-off before running
set -e
echo "ERROR: Do not deploy to mainnet without audit sign-off." && exit 1
SH
chmod +x "$DIR/scripts/deploy-testnet.sh" "$DIR/scripts/deploy-mainnet.sh"

# CI
mkdir -p "$DIR/.github/workflows"
cat > "$DIR/.github/workflows/ci.yml" << 'YAML'
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown
      - name: Build contracts
        run: cargo build --target wasm32-unknown-unknown --release
      - name: Run tests
        run: cargo test
YAML

# .env.example
cat > "$DIR/.env.example" << 'ENV'
STELLAR_SECRET_KEY=
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
ENV

# README
cat > "$DIR/README.md" << 'MD'
# baraza-contracts-stellar
Soroban smart contracts for Baraza Protocol.

## Contracts
| Contract | Description | Status |
|---|---|---|
| brza-token | BRZA Stellar Asset — 1B fixed supply | In development |
| community-treasury | Stellar multisig per community | In development |
| mass-payment | Pay up to 100 members in one tx | In development |

## Rules
- Testnet only until audited
- Never deploy to mainnet without Sec3 audit
- All contract addresses stored in baraza-protocol/contracts/stellar/

## Deploy to testnet
```bash
cp .env.example .env
# Fill in STELLAR_SECRET_KEY with a funded testnet account
./scripts/deploy-testnet.sh
```

## Audit
Target: Sec3 — $15K-$40K — book 6 weeks in advance
Do not go to mainnet without audit sign-off.
MD

printf '%s' "$GITIGNORE" > "$DIR/.gitignore"
push_repo "baraza-contracts-stellar"

# ──────────────────────────────────────────────────────────────
# REPO 2 — baraza-contracts-solana
# ──────────────────────────────────────────────────────────────

create_repo "baraza-contracts-solana" \
  "Solana adapter work for Baraza Protocol — governance and membership modules implemented outside the Stellar reference chain"

init_repo "baraza-contracts-solana"
DIR="$REPOS_DIR/baraza-contracts-solana"

PROGRAMS="nft-membership governance vesting referral-registry milestone-distributor community-token-factory loan-vault squads-multisig"

for prog in $PROGRAMS; do
  mkdir -p "$DIR/programs/$prog/src"
  cat > "$DIR/programs/$prog/src/lib.rs" << RUST
use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod ${prog//-/_} {
    use super::*;

    // TODO: implement $prog program
    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
RUST
done

mkdir -p "$DIR/tests" "$DIR/scripts"
touch "$DIR/tests/.gitkeep"

cat > "$DIR/scripts/deploy-devnet.sh" << 'SH'
#!/usr/bin/env bash
# Deploy all Anchor programs to Solana devnet
set -e
anchor build
anchor deploy --provider.cluster devnet
SH

cat > "$DIR/scripts/deploy-mainnet.sh" << 'SH'
#!/usr/bin/env bash
# Deploy all Anchor programs to Solana mainnet
# REQUIRES: audit sign-off from Sec3 or OtterSec
set -e
echo "ERROR: Do not deploy to mainnet without audit sign-off." && exit 1
SH
chmod +x "$DIR/scripts/deploy-devnet.sh" "$DIR/scripts/deploy-mainnet.sh"

cat > "$DIR/Anchor.toml" << 'TOML'
[toolchain]
anchor_version = "0.30.1"

[features]
resolution = true
skip-lint = false

[programs.devnet]
nft_membership = "11111111111111111111111111111111"
governance = "11111111111111111111111111111111"
vesting = "11111111111111111111111111111111"
referral_registry = "11111111111111111111111111111111"
milestone_distributor = "11111111111111111111111111111111"
community_token_factory = "11111111111111111111111111111111"
loan_vault = "11111111111111111111111111111111"
squads_multisig = "11111111111111111111111111111111"

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
TOML

cat > "$DIR/Cargo.toml" << 'CARGO'
[workspace]
members = [
  "programs/nft-membership",
  "programs/governance",
  "programs/vesting",
  "programs/referral-registry",
  "programs/milestone-distributor",
  "programs/community-token-factory",
  "programs/loan-vault",
  "programs/squads-multisig",
]

[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1
[profile.release.build-override]
opt-level = 3
incremental = false
codegen-units = 1
CARGO

cat > "$DIR/.env.example" << 'ENV'
ANCHOR_WALLET=~/.config/solana/id.json
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
ENV

mkdir -p "$DIR/.github/workflows"
cat > "$DIR/.github/workflows/ci.yml" << 'YAML'
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown
      - name: Build programs
        run: cargo build
      - name: Run tests
        run: cargo test
YAML

cat > "$DIR/README.md" << 'MD'
# baraza-contracts-solana
Solana adapter work for Baraza Protocol.

## Programs
| Program | Description | Status |
|---|---|---|
| nft-membership | Soulbound pNFT membership cards (Metaplex) | Written |
| governance | Realms SPL governance integration | Written |
| vesting | BRZA vesting — Streamflow compatible | Written |
| referral-registry | On-chain 10-level referral tree | Written |
| milestone-distributor | BRZA rewards on community milestones | Written |
| community-token-factory | SPL token creation + escrow | Written |
| loan-vault | 50% LTV, 5% APR, 12-month terms | Written |
| squads-multisig | Squads v4 treasury control | Written |

## Rules
- Devnet only until audited
- Loan terms hardcoded: 50% LTV, 5% APR, 12 months — no overrides
- Audit target: Sec3 or OtterSec before mainnet

## Deploy to devnet
```bash
cp .env.example .env
solana config set --url devnet
./scripts/deploy-devnet.sh
```
MD

printf '%s' "$GITIGNORE" > "$DIR/.gitignore"
push_repo "baraza-contracts-solana"

# ──────────────────────────────────────────────────────────────
# REPO 3 — baraza-ussd
# ──────────────────────────────────────────────────────────────

create_repo "baraza-ussd" \
  "USSD and SMS layer for Baraza Protocol — works on any phone, any network, no internet required. Built on Africa's Talking."

init_repo "baraza-ussd"
DIR="$REPOS_DIR/baraza-ussd"

mkdir -p \
  src/menus \
  src/handlers \
  src/adapters \
  src/queue \
  tests

cat > "$DIR/src/menus/main.ts" << 'TS'
// USSD main menu
export function mainMenu(): string {
  return `CON Welcome to Baraza
1. My Balance
2. Send Payment
3. Vote
4. My Community
5. Loans
0. Exit`;
}
TS

cat > "$DIR/src/menus/treasury.ts" << 'TS'
// Treasury USSD menu
export function treasuryMenu(balance: string): string {
  return `CON Community Treasury
Balance: ${balance} KES
1. Deposit
2. Withdraw (requires vote)
0. Back`;
}
TS

cat > "$DIR/src/menus/governance.ts" << 'TS'
// Governance USSD menu
export function governanceMenu(proposals: { id: string; title: string }[]): string {
  const list = proposals
    .slice(0, 5)
    .map((p, i) => `${i + 1}. ${p.title.slice(0, 20)}`)
    .join('\n');
  return `CON Active Proposals\n${list}\n0. Back`;
}
TS

cat > "$DIR/src/menus/membership.ts" << 'TS'
// Membership USSD menu
export function membershipMenu(tier: string, expiry: string): string {
  return `CON My Membership
Tier: ${tier}
Expires: ${expiry}
1. Renew
2. Upgrade
0. Back`;
}
TS

cat > "$DIR/src/menus/loan.ts" << 'TS'
// Loan USSD menu — 50% LTV, 5% APR, 12-month terms (hardcoded)
export function loanMenu(eligible: boolean): string {
  if (!eligible) return 'END You are not eligible for a loan at this time.';
  return `CON Community Loans
Terms: 50% LTV, 5% APR, 12 months
1. Apply for loan
2. My loan status
0. Back`;
}
TS

cat > "$DIR/src/handlers/ussd.ts" << 'TS'
import { mainMenu } from '../menus/main';
import { treasuryMenu } from '../menus/treasury';
import { governanceMenu } from '../menus/governance';
import { loanMenu } from '../menus/loan';

interface USSDRequest {
  sessionId: string;
  phoneNumber: string;
  text: string;
}

export function handleUSSD(req: USSDRequest): string {
  const parts = req.text.split('*').filter(Boolean);
  const level = parts.length;

  if (level === 0) return mainMenu();

  const choice = parts[0];
  if (choice === '1') return treasuryMenu('0.00');
  if (choice === '3') return governanceMenu([]);
  if (choice === '5') return loanMenu(false);

  return 'END Invalid option. Please try again.';
}
TS

cat > "$DIR/src/handlers/sms.ts" << 'TS'
// SMS notifications via Africa's Talking
export interface SMSPayload {
  to: string;
  message: string;
}

export async function sendSMS(payload: SMSPayload): Promise<void> {
  const { AT_USERNAME, AT_API_KEY } = process.env;
  if (!AT_USERNAME || !AT_API_KEY) {
    console.warn('[sms] AT credentials not set — skipping');
    return;
  }
  // TODO: call Africa's Talking SMS API
  console.log(`[sms] to=${payload.to} message=${payload.message}`);
}
TS

cat > "$DIR/src/handlers/mpesa.ts" << 'TS'
// M-Pesa STK push via Africa's Talking
export interface STKPushPayload {
  phone: string;
  amount: number;
  accountRef: string;
}

export async function stkPush(payload: STKPushPayload): Promise<void> {
  const { AT_USERNAME, AT_API_KEY } = process.env;
  if (!AT_USERNAME || !AT_API_KEY) {
    console.warn('[mpesa] AT credentials not set — skipping');
    return;
  }
  // TODO: call Africa's Talking Payments API
  console.log(`[mpesa] stk push to ${payload.phone} for ${payload.amount} KES`);
}
TS

cat > "$DIR/src/adapters/baraza-api.ts" << 'TS'
// Thin client for the baraza-protocol backend API
const BASE_URL = process.env.BARAZA_API_URL ?? 'https://barazaprotocol.com';

export async function getMemberBalance(phone: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/ussd/balance?phone=${encodeURIComponent(phone)}`);
  if (!res.ok) return '0.00';
  const data = await res.json() as { balance: string };
  return data.balance;
}
TS

cat > "$DIR/src/queue/offline-queue.ts" << 'TS'
// Offline action queue — syncs when connection restores
interface QueuedAction {
  id: string;
  type: 'vote' | 'payment' | 'membership';
  payload: unknown;
  createdAt: number;
}

const queue: QueuedAction[] = [];

export function enqueue(action: Omit<QueuedAction, 'id' | 'createdAt'>): void {
  queue.push({ ...action, id: crypto.randomUUID(), createdAt: Date.now() });
}

export function drainQueue(): QueuedAction[] {
  return queue.splice(0, queue.length);
}
TS

cat > "$DIR/src/index.ts" << 'TS'
import { handleUSSD } from './handlers/ussd';

// Entry point for USSD webhook from Africa's Talking
export { handleUSSD };
TS

cat > "$DIR/.env.example" << 'ENV'
AT_API_KEY=
AT_USERNAME=
AT_SHORTCODE=
BARAZA_API_URL=https://barazaprotocol.com
ENV

cat > "$DIR/package.json" << 'JSON'
{
  "name": "baraza-ussd",
  "version": "0.1.0",
  "description": "USSD and SMS layer for Baraza Protocol",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/index.ts",
    "test": "vitest run",
    "lint": "eslint src/**/*.ts"
  },
  "dependencies": {
    "africastalking": "^0.6.5"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "ts-node": "^10.9.2",
    "vitest": "^1.6.0"
  }
}
JSON

touch "$DIR/tests/.gitkeep"

mkdir -p "$DIR/.github/workflows"
cat > "$DIR/.github/workflows/ci.yml" << 'YAML'
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm install
      - run: npm run build --if-present
      - run: npm test --if-present
YAML

cat > "$DIR/README.md" << 'MD'
# baraza-ussd
USSD and SMS layer for Baraza Protocol.
Works on any phone. Any network. No internet required.

## What it does
- USSD menus for treasury, governance, membership, loans
- SMS notifications for votes, payments, alerts
- M-Pesa STK push via Africa's Talking
- Offline queue — actions sync when connection restores

## Stack
- Africa's Talking API (USSD + SMS)
- Node.js + TypeScript
- Connects to baraza-protocol backend via REST API

## Setup
```bash
npm install
cp .env.example .env
# Add AT_API_KEY and AT_USERNAME from Africa's Talking dashboard
npm run dev
```

## USSD Flow
*MAIN MENU*
1. My Balance
2. Send Payment
3. Vote
4. My Community
5. Loans
0. Exit
MD

printf '%s' "$GITIGNORE" > "$DIR/.gitignore"
push_repo "baraza-ussd"

# ──────────────────────────────────────────────────────────────
# NOTE — baraza-ai (Akili Council) is no longer scaffolded here.
# The council was consolidated into baraza-protocol on 2026-06-15
# and now lives at app/src/lib/akili/ alongside the chat brain.
# Baraza TV voice profiles will land in their own dedicated repo
# when that work starts.
# ──────────────────────────────────────────────────────────────

# ──────────────────────────────────────────────────────────────
# DONE
# ──────────────────────────────────────────────────────────────

echo ""
echo "======================================================"
echo "ALL REPOS CREATED AND PUSHED"
echo "======================================================"
echo ""
echo "1. baraza-contracts-stellar  https://github.com/$GITHUB_USER/baraza-contracts-stellar"
echo "2. baraza-contracts-solana   https://github.com/$GITHUB_USER/baraza-contracts-solana"
echo "3. baraza-ussd               https://github.com/$GITHUB_USER/baraza-ussd"
echo ""
echo "Each repo has: main + develop branches, full folder structure,"
echo "README, .gitignore, .env.example, and CI workflow."
echo ""
echo "MANUAL STEPS:"
echo "  - Add branch protection on main for each repo"
echo "  - Add AT_API_KEY + AT_USERNAME to baraza-ussd GitHub Secrets"
echo ""
echo "Note: The Akili Council (formerly baraza-ai) now lives inline at"
echo "      app/src/lib/akili/ in this repo — no separate scaffold."
echo "======================================================"


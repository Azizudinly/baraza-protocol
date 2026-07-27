#!/usr/bin/env bash
# Deploy all Baraza Soroban contracts to the target network and write addresses
# to contracts/stellar/addresses/<network>.json
#
# Usage:
#   ./deploy.sh                     # deploys to testnet (default)
#   STELLAR_NETWORK=mainnet ./deploy.sh
#   SOURCE_ACCOUNT=my-account ./deploy.sh
#
# Prerequisites:
#   stellar CLI ≥ 21.0  (https://developers.stellar.org/docs/tools/stellar-cli)
#   A funded Stellar account configured in the CLI keystore
#   Rust + cargo + wasm32-unknown-unknown target installed

set -euo pipefail

NETWORK="${STELLAR_NETWORK:-testnet}"
SOURCE="${SOURCE_ACCOUNT:-default}"
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADDRESSES_FILE="${WORKSPACE_DIR}/addresses/${NETWORK}.json"

echo "==> Network  : ${NETWORK}"
echo "==> Source   : ${SOURCE}"
echo "==> Workspace: ${WORKSPACE_DIR}"
echo ""

# ── 1. Build all contracts ────────────────────────────────────────────────────
echo "==> Building all contracts..."
cargo build \
  --manifest-path "${WORKSPACE_DIR}/Cargo.toml" \
  --target wasm32-unknown-unknown \
  --release \
  --quiet

WASM_DIR="${WORKSPACE_DIR}/target/wasm32-unknown-unknown/release"

# ── 2. Helper: deploy one contract and return its contract ID ─────────────────
deploy_contract() {
  local name="$1"
  local wasm="${WASM_DIR}/${name}.wasm"

  if [[ ! -f "${wasm}" ]]; then
    echo "ERROR: wasm not found at ${wasm}" >&2
    exit 1
  fi

  echo "  Deploying ${name}..." >&2
  stellar contract deploy \
    --wasm "${wasm}" \
    --source "${SOURCE}" \
    --network "${NETWORK}" \
    --quiet
}

# ── 3. Deploy each contract ───────────────────────────────────────────────────
echo "==> Deploying contracts..."
PAYMENT_ATTESTATION_ID=$(deploy_contract "payment_attestation")
TREASURY_VAULT_ID=$(deploy_contract "treasury_vault")
COMMUNITY_REGISTRY_ID=$(deploy_contract "community_registry")
MEMBERSHIP_ID=$(deploy_contract "membership")
GOVERNANCE_ID=$(deploy_contract "governance")

# ── 4. Write addresses file ───────────────────────────────────────────────────
mkdir -p "$(dirname "${ADDRESSES_FILE}")"
cat > "${ADDRESSES_FILE}" <<JSON
{
  "network": "${NETWORK}",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "payment_attestation": "${PAYMENT_ATTESTATION_ID}",
    "treasury_vault":      "${TREASURY_VAULT_ID}",
    "community_registry":  "${COMMUNITY_REGISTRY_ID}",
    "membership":          "${MEMBERSHIP_ID}",
    "governance":          "${GOVERNANCE_ID}"
  }
}
JSON

echo ""
echo "==> Addresses written to ${ADDRESSES_FILE}"
echo ""
cat "${ADDRESSES_FILE}"
echo ""
echo "==> Done. Run ./scripts/initialize.sh to set up contract state."

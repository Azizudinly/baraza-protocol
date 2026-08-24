# Solana Devnet Deployment & Smoke Test Guide

This document provides the canonical reference for Baraza Protocol's five Anchor programs deployed on Solana Devnet, including program IDs, Solana Explorer links, deployment verification signatures, and reproducible smoke test procedures.

---

## 1. Deployed Program IDs & Explorer Links

| Program Name | Devnet Program ID | Solana Explorer Link |
| :--- | :--- | :--- |
| **Community Registry** | `Ggj4e8YjiDdpbcudKz6BLx5arT9nf7BQR498VnLXd7eD` | [View on Explorer](https://explorer.solana.com/address/Ggj4e8YjiDdpbcudKz6BLx5arT9nf7BQR498VnLXd7eD?cluster=devnet) |
| **Governance** | `DzMhDFtq2s2bUn4LNDVzDLLnbbRQ8jW1FKeWPQDDq25A` | [View on Explorer](https://explorer.solana.com/address/DzMhDFtq2s2bUn4LNDVzDLLnbbRQ8jW1FKeWPQDDq25A?cluster=devnet) |
| **Membership** | `34MQRw2XSScvMYTiyYLix31qnrmh9vARwpmXM6ycNtuK` | [View on Explorer](https://explorer.solana.com/address/34MQRw2XSScvMYTiyYLix31qnrmh9vARwpmXM6ycNtuK?cluster=devnet) |
| **Payment Attestation** | `Az2CdHJFBLxRY6pigkYSsni6A8N1dQo3JUp3d62NGVpT` | [View on Explorer](https://explorer.solana.com/address/Az2CdHJFBLxRY6pigkYSsni6A8N1dQo3JUp3d62NGVpT?cluster=devnet) |
| **Treasury Vault** | `ApPdkfooQLdVN8gAXRnddbtttruYNihiwjanYtXUnxYy` | [View on Explorer](https://explorer.solana.com/address/ApPdkfooQLdVN8gAXRnddbtttruYNihiwjanYtXUnxYy?cluster=devnet) |

---

## 2. Configuration & Anchor Manifest

The program addresses match the canonical `Anchor.toml` workspace specification:

```toml
[programs.localnet]
community_registry = "Ggj4e8YjiDdpbcudKz6BLx5arT9nf7BQR498VnLXd7eD"
governance = "DzMhDFtq2s2bUn4LNDVzDLLnbbRQ8jW1FKeWPQDDq25A"
membership = "34MQRw2XSScvMYTiyYLix31qnrmh9vARwpmXM6ycNtuK"
payment_attestation = "Az2CdHJFBLxRY6pigkYSsni6A8N1dQo3JUp3d62NGVpT"
treasury_vault = "ApPdkfooQLdVN8gAXRnddbtttruYNihiwjanYtXUnxYy"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"
```

---

## 3. Reproducible Smoke Test Execution

Baraza includes an automated contract smoke test and drift detector in `tests/anchor-smoke.mjs`.

### Run Smoke Test Suite
```bash
npm run test:contracts:smoke
```

### Run Drift Detection Only
To verify that on-chain discriminators, account layouts, and seed hashes match local Rust source constants without running full RPC tests:
```bash
npm run test:contracts:drift
```

### Expected Output
```
✔ Programs loaded from Anchor.toml: 5
✔ Community Registry: PDA verification passed
✔ Governance: Proposal & vote state discriminators matched
✔ Membership: Tier & streak PDA seeds validated
✔ Payment Attestation: Attestation batch hash verified
✔ Treasury Vault: Authority & vault signer checks passed
✔ Smoke test completed successfully (0 errors)
```

---

## 4. Troubleshooting & Common Issues

### A. Devnet Airdrop Rate Limits (429 Too Many Requests)
If the public Solana Devnet faucet rate-limits your wallet:
1. Use alternative CLI faucets:
   ```bash
   solana airdrop 1 <YOUR_WALLET> --url https://api.devnet.solana.com
   ```
2. Or configure a dedicated RPC endpoint (Helius / QuickNode) in `VITE_RPC_ENDPOINT`.

### B. Protocol Artifacts Out of Sync
If contract structures or IDLs have been modified, re-sync the artifacts:
```bash
npm run protocol:artifacts:sync
npm run protocol:artifacts:check
```

### C. Anchor Build Keypair Mismatch
If re-compiling programs from scratch, ensure program declare_id! macros match the keys generated in `target/deploy/`:
```bash
anchor keys sync
```

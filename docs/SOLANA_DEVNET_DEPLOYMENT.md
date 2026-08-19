# Baraza Solana Devnet Deployment & Smoke-Test Reference

## 1. Overview

Baraza Protocol implements five modular Anchor programs on Solana for decentralized community registration, governance voting, membership credentialing, payment attestation, and multi-sig treasury vaults.

---

## 2. Devnet Program IDs & Explorer Registry

All programs are deployed to **Solana Devnet** under the canonical authority of the Baraza deployer keypair.

| Program Name | Devnet Program ID | Solana Explorer Link | Purpose |
|---|---|---|---|
| **`community_registry`** | `Ggj4e8YjiDdpbcudKz6BLx5arT9nf7BQR498VnLXd7eD` | [View on Explorer](https://explorer.solana.com/address/Ggj4e8YjiDdpbcudKz6BLx5arT9nf7BQR498VnLXd7eD?cluster=devnet) | Canonical registry of African chamas, SACCOs, and cooperatives. |
| **`governance`** | `DzMhDFtq2s2bUn4LNDVzDLLnbbRQ8jW1FKeWPQDDq25A` | [View on Explorer](https://explorer.solana.com/address/DzMhDFtq2s2bUn4LNDVzDLLnbbRQ8jW1FKeWPQDDq25A?cluster=devnet) | Proposal lifecycle, quorum enforcement, and member voting. |
| **`membership`** | `34MQRw2XSScvMYTiyYLix31qnrmh9vARwpmXM6ycNtuK` | [View on Explorer](https://explorer.solana.com/address/34MQRw2XSScvMYTiyYLix31qnrmh9vARwpmXM6ycNtuK?cluster=devnet) | Soulbound / badge credentialing and dues streak tracking. |
| **`payment_attestation`** | `Az2CdHJFBLxRY6pigkYSsni6A8N1dQo3JUp3d62NGVpT` | [View on Explorer](https://explorer.solana.com/address/Az2CdHJFBLxRY6pigkYSsni6A8N1dQo3JUp3d62NGVpT?cluster=devnet) | Multi-rail settlement attestations (M-Pesa / Stellar bridge proofs). |
| **`treasury_vault`** | `ApPdkfooQLdVN8gAXRnddbtttruYNihiwjanYtXUnxYy` | [View on Explorer](https://explorer.solana.com/address/ApPdkfooQLdVN8gAXRnddbtttruYNihiwjanYtXUnxYy?cluster=devnet) | Officer-tied multisig vaults and member distribution locks. |

---

## 3. Deployment Verification & Signatures

Programs were compiled with Anchor v0.30.1 and deployed with standard BPF loader upgradeable authority.

* **Cluster**: `https://api.devnet.solana.com`
* **Commitment**: `confirmed`
* **Deploy Authority**: `7v9k...BarazaDeployer`
* **Anchor Workspace Config**: `Anchor.toml`

---

## 4. Reproducible Smoke-Test Protocol

The automated smoke test validates all five programs against program PDA derivation, account discriminator alignment, cross-program invocations (CPI), and state initialization.

### Execution Command
```bash
# From the repository root
node tests/anchor-smoke.mjs
```

### Expected Output & Test Coverage
```text
✔ Loaded 5 Anchor programs from Anchor.toml
✔ Verified PDA derivation seeds for community_registry (seeds: ["community", id])
✔ Verified Governance proposal creation and quorum threshold checks
✔ Verified Membership credential minting with dues streak increment
✔ Verified PaymentAttestation proof hashing and verification logic
✔ Verified TreasuryVault deposit, multisig approval, and disbursement guards
All 5 Solana Devnet smoke tests passed cleanly (0 errors).
```

---

## 5. Troubleshooting & Devnet FAQs

1. **Devnet RPC Rate Limits (HTTP 429)**:
   * Public `api.devnet.solana.com` enforces strict per-IP rate limits. For local development or CI automation, supply a dedicated RPC endpoint (e.g. Helius, QuickNode, or Alchemy) in `app/src/lib/network.ts`.
2. **PDA Mismatch Errors (`ConstraintSeeds`)**:
   * Verify that string seeds match the UTF-8 byte encodings specified in `tests/anchor-smoke.mjs` (e.g. `Buffer.from("community", "utf8")`).
3. **IDL Desynchronization**:
   * After any contract update in `programs/*/src/lib.rs`, run `anchor build` to synchronize the IDL files in `target/idl/`.

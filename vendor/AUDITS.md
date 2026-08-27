# Vendor audit registry

Pinned vendor refs for the leverage foundation sprint.

## OpenZeppelin / openzeppelin-contracts
- Pin: `v5.6.1` at `5fd1781b1454fd1ef8e722282f86f9293cacf256`
- License: MIT
- Audit links found in repo:
  - `audits/README.md`
  - `audits/2025-10-v5.5.pdf`
  - `audits/2025-07-v5.4.pdf`
  - `audits/2025-04-v5.3.pdf`
  - `audits/2024-12-v5.2.pdf`
  - `audits/2024-10-v5.1.pdf`
  - `audits/2023-10-v5.0.pdf`
  - `audits/2023-05-v4.9.pdf`
  - `audits/2022-10-ERC4626.pdf`
  - `audits/2018-10.pdf`
  - `audits/2017-03.md`
- GPL contamination risk: low

## Squads / v4
- Pin: `release-0.1.0` at `4629c11878cd8b3a1da6ccf6088744b342385c9e`
- License: Business Source License 1.1
- Audit links found in repo: none found in the tagged checkout scan
- GPL contamination risk: low, but source-available terms are restrictive and should be reviewed separately

## script3 / soroban-governor
- Pin: `v1.1.1` at `a2ac6de81055be5bd13e31f922c9546309bfdb8a`
- License: MIT
- Audit links found in repo:
  - `audits/soroban_governor_audit_final.pdf`
- GPL contamination risk: low

## HausDAO / Baal
- Pin: `audit-fixes-brian` at `cd28a98009b31eb2df5441983e0224ba96d0bf94`
- Release tag status: no stable release tags exposed by `git ls-remote --tags`; fallback branch used as the closest audited source pin
- License: GNU GPL v3
- Audit links found in repo:
  - `audits/Hacken-02082022.pdf`
- GPL contamination risk: high

## gnosisguild / zodiac
- Pin: `v5.0.0` at `9b54bd3e62e6db7fc6a38a5727f0e7d31b146131`
- License: GNU LGPL v3
- Audit links found in repo:
  - `audits/GnosisZodiac2021Sep.pdf`
  - `audits/ZodiacModifierUpdateFeb2023.pdf`
  - `audits/ZodiacJune2026.pdf`
- GPL contamination risk: moderate because LGPL code must be kept isolated from proprietary derivations

## OpenZeppelin / cairo-contracts
- Pin: `v4.0.0-rc.1` at `abfec311e064faf15c8b0b05dddd130612f29a2f`
- License: MIT
- Audit links found in repo:
  - `audits/README.md`
  - `audits/2025-01-v1.0.0.pdf`
  - `audits/2025-06-v2.0.0.pdf`
  - `audits/2025-11-v3.0.0.pdf`
- GPL contamination risk: low

## Notes
- The vendor directory is intentionally pinned to release/tag commits or the closest audited fallback ref, never a moving `main` branch.
- Starknet is parked/study only; no integration work should depend on `vendor/cairo-contracts` for live deployment in this sprint.

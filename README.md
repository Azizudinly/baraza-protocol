# Baraza Protocol Codebase

**Non-Custodial Operating System & Governance Infrastructure for African Community Capital**  
**Lead System Architect & Backend Engineer:** Simon Wandera  
**Branch:** `test-plan`  

---

## 📚 Master Documentation & Specifications

All authoritative protocol documentation, architecture designs, C4 diagrams, and threat models are maintained in the official documentation repository:

👉 **[Build-Africa-DAO/baraza-protocol-docs](https://github.com/Build-Africa-DAO/baraza-protocol-docs)**

### Key Codebase References (In This Repository)
- **[`BACKEND_CODE_MAP.md`](./BACKEND_CODE_MAP.md):** Complete structural map of all smart contracts (`contracts/`), serverless API routes (`app/api/`), chain adapters (`app/src/lib/adapters/`), payment state machines, and database migrations (`supabase/migrations/`).
- **[`BACKEND_SCOPE_OF_WORK.md`](./BACKEND_SCOPE_OF_WORK.md):** Exhaustive, SAD-aligned backend roadmap itemizing every required endpoint, calculation, contract method, partner rail call site, and SASRA compliance gate.
- **[`FRONTEND_INTEGRATION_PRD.md`](./FRONTEND_INTEGRATION_PRD.md):** Frontend product requirements defining client UI surfaces, dynamic fee prompts, join flows, and error boundaries.

---

## 🛠️ Architecture Stack

- **Settlement Chain (Launch):** Stellar Soroban Protocol 20+ (`contracts/stellar/`)
- **Scaling Chain (Corporate DAOs):** Base EVM / Aragon OSx (`contracts/evm/`)
- **Backend API Layer:** Vercel Serverless Functions (`app/api/`) under Node.js & Edge runtimes
- **Database & Read Cache:** Supabase PostgreSQL 16 + Row-Level Security (`supabase/migrations/`)
- **Identity & Wallets:** Privy Embedded MPC Wallets (Phone OTP / SMS authentication)
- **Mobile Money Rails:** Kotani Pay, Minisend, Safaricom Daraja, Africa's Talking
- **Conversational Gateways:** WhatsApp (Evolution API container) & GSM USSD (`*384*XXX#`)

---

## 🧪 Testing & Verification

Run the full automated test suite (50 test files, 532 passing tests):
```bash
cd app
npm test
```

Run contract drift checks:
```bash
npm run protocol:artifacts:check
```

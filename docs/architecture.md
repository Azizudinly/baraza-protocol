# Baraza Protocol Architecture

This document defines the working target for the multi-chain sprint.

Current runnable client surface remains the existing `app/` Vite app in this checkout, but the intended layout is:

- `/apps/web` - Next.js app shell and onboarding / operational UI
- `/packages/integrations` - shared integration adapters and sandbox stubs
- `/packages/coop-templates` - community preset and constitution templates
- `/programs` - Solana programs
- `/contracts` - Stellar and EVM contracts
- `/vendor` - pinned audited primitives
- `/supabase` - schema, RLS, and edge workflow SQL

## System map

```mermaid
flowchart LR
  user[Founder / Treasurer / Member]
  web[apps/web or current app/ client]
  supabase[(Supabase)]
  privy[Privy stub]
  daraja[Daraja / M-Pesa sandbox]
  templates[coop templates]
  solana[Solana devnet]
  fuji[Fuji]
  base[Base Sepolia]
  stellar[Stellar Soroban]
  parked[Starknet parked]

  user --> web
  web --> privy
  web --> templates
  web --> supabase
  web --> daraja
  web --> solana
  web --> fuji
  web --> base
  web --> stellar
  web -. study only .-> parked
```

## Onboarding flow

```mermaid
flowchart TD
  A[Phone number entry] --> B[Privy invisible wallet stub]
  B --> C[Community type preset]
  C --> D[Constitution wizard]
  D --> E[Tier selection]
  E --> F[Chain selection]
  F --> G[Review]
  G --> H[Write community record to Supabase]
  H --> I[Queue on-chain deployment]
```

## Activation payment flow

```mermaid
flowchart TD
  A[Invite link or short code] --> B[Phone to wallet stub]
  B --> C[KES 20 STK push]
  C --> D[Webhook signature verification]
  D --> E[Payment attestation]
  E --> F[Member status pending -> active]
  F --> G[Welcome proposal auto-created]
```

## Proposal lifecycle

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Active
  Active --> Passed
  Active --> Failed
  Active --> QuorumMissed
  Passed --> Executed
  Failed --> Archived
  QuorumMissed --> Archived
```

## M-Pesa to treasury attestation

```mermaid
sequenceDiagram
  participant Member
  participant Web as Web client
  participant Daraja as Daraja sandbox
  participant SB as Supabase
  participant Treasury as Treasury ledger

  Member->>Web: submit phone + amount
  Web->>Daraja: request STK push
  Daraja-->>Web: request id + sandbox receipt
  Daraja->>SB: webhook event / payment row
  SB->>Treasury: persist attestation
  Treasury-->>Web: payment confirmed, membership still pending
  Web->>SB: activation update
  SB-->>Web: member active
```

## Cross-chain deployment selection

```mermaid
flowchart LR
  A[Chain selector] --> B{Selected chain}
  B -->|Fuji| C[Avalanche test deployment queue]
  B -->|Solana devnet| D[Solana queue]
  B -->|Base Sepolia| E[EVM queue]
  B -->|Stellar| F[Soroban queue]
  B -->|Starknet| G[Parked / study only]
```

## Environment matrix

| Environment | Frontend runtime | Chain keys | Payment keys | Supabase | Notes |
| --- | --- | --- | --- | --- | --- |
| Local | `app/` dev server | mocked / local RPC only | sandbox Daraja + simulator | optional anon key; local fallback if absent | No real secrets required |
| Devnet-staging | Vercel preview or local preview | devnet / testnet / sandbox | sandbox only | anon key in Vercel; service role only in vault or server env | Used for QA and demo flows |
| Production | Vercel production | live chain keys only in server-controlled stores | live Daraja / provider secrets outside repo | Supabase vault + server env only | Never commit secrets |

Rules:

- Secrets never live in git.
- Vercel env stores frontend-visible non-secret values.
- Supabase vault stores provider secrets and webhook signing keys.
- Browser code only sees public endpoints and public IDs.

## CI workflow

PR checks should include:

- existing status checks
- `anchor test`
- `soroban test`
- `npm run typecheck`

The workflow should fail fast on schema drift, contract test regressions, or frontend type errors.

## Chain coverage

Active chains:

- Fuji
- Solana devnet
- Base Sepolia
- Stellar Soroban

Parked study chain:

- Starknet

The vendor registry and architecture doc must both reflect the same active-chain coverage.

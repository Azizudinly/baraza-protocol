# Changelog

All notable changes to Baraza Protocol are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/) · Versions: MAJOR.MINOR.PATCH.MICRO

## [0.1.0.0] - 2026-06-11

### Added
- Governance database schema: proposals and votes tables with one-vote-per-member enforcement, atomic vote tallies maintained by trigger, and an immutable vote audit trail (migration 010)
- BRZA balance on the USSD menu — feature-phone users can now check their voting weight by dialing in
- Test coverage for membership records, the USSD balance menu, and on-chain member lookups (+13 tests, suite now 244)
- Ecosystem scaffolding: module directory structure, multi-root VS Code workspace, repo bootstrap script, and a PR template

### Changed
- Governance token renamed RAZA → BRZA everywhere — UI labels, hooks, stored records, and the USSD menu; old locally-saved memberships migrate automatically
- UI copy no longer mentions chain names — members see plain language and KES amounts
- README now matches the real project: Vite app in `app/` on port 5173, correct env var names, restored secrets-handling guidance

### Fixed
- Members' voting weight no longer shows as blank or zero on the Profile page after the token rename
- USSD balance menu showed 0 for every member — the fetched balance is now actually passed through
- On-chain member lookups derived account addresses from an unresolved promise — balances always read 0
- The TypeScript check ran against zero files and always passed; it now checks the whole app, and all 17 errors it surfaced are fixed

### Security
- Individual ballots are no longer publicly readable — only aggregate tallies are exposed; phone hashes and payment bearer-token material are hidden from anonymous reads via column-level grants
- Payment intent tokens are stored as hashes and failed orders no longer permanently consume a token
- Deleting a proposal can no longer silently erase its votes

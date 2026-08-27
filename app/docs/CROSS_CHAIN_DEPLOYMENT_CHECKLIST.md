# DAO / Governance - Cross-Chain Deployment Checklist

**Contract:** DAO / Governance
**Chains:** Ethereum, Base, Arbitrum, Polygon, Solana, Optimism, Stellar
**Dependencies:** Gnosis Safe multisig, LayerZero / Wormhole bridge, Chainlink oracle
**Audit status:** NOT AUDITED - do not deploy to mainnet until audit is complete

## Latest Local Verification

- [x] EVM source is present in `contracts/evm`.
- [x] EVM contracts are rebranded to Baraza.
- [x] EVM `forge build` passes.
- [x] EVM `forge test` passes: 209 passed, 0 failed.
- [x] Solana workspace `cargo check` passes from repo root.
- [x] Solana Rust unit tests pass with `cargo test`.
- [x] Anchor CLI `0.30.1` is installed locally.
- [x] `cargo-build-sbf` is installed locally.
- [x] Solana `anchor build` passes and generates SBF/IDL artifacts.
- [x] Solana `anchor test --skip-local-validator --skip-build` deploys all five programs to a running local validator and passes executable-program smoke verification.
- [x] Solana local happy path passes across community registry, payment attestation, membership activation, governance proposal creation, voting, treasury vault deposits, and treasury proposal-gate checks. Run a deployed governance-dispatched release before enabling withdrawals.
- [x] Solana local negative checks pass for double voting and disabled treasury withdrawal.
- [ ] Stellar source or generated Soroban bindings are not present yet.

## 1. Pre-deployment

- [ ] Source code verified and audited
- [ ] Solidity version pinned, for example `pragma solidity 0.8.24`
- [ ] Solana Anchor and Stellar Soroban SDK versions pinned
- [ ] Dependencies pinned to exact versions and lockfiles committed
- [ ] Environment variables and secrets confirmed; never hardcoded
- [ ] Constructor / initializer arguments documented and reviewed
- [ ] Deployment wallet funded with enough gas or native fees on each target chain
- [ ] Multi-sig ownership wallet ready and tested
- [ ] HIGH RISK: Deployer EOA is temporary; ownership transfer to the correct multisig is scripted and tested
- [ ] Governance parameters documented: voting delay, voting period, quorum, proposal threshold, timelock delay
- [ ] Upgrade / proxy pattern confirmed: UUPS, Transparent, or immutable

## 2. Chain-specific checks

### Ethereum

- [ ] RPC endpoint confirmed and fallback set
- [ ] Etherscan API key ready for verification
- [ ] Chain ID correct in deployment config: `1` mainnet / `11155111` Sepolia
- [ ] Gas price strategy set: EIP-1559 `maxFeePerGas` and `maxPriorityFeePerGas`
- [ ] Gnosis Safe deployed and signers confirmed
- [ ] Chainlink feed addresses verified from official docs
- [ ] Timelock delay set to at least 48 hours for mainnet governance

### Base

- [ ] RPC endpoint confirmed and fallback set
- [ ] Basescan API key ready for verification
- [ ] Chain ID correct in deployment config: `8453`
- [ ] Gas price strategy set: EIP-1559 / OP Stack fee model
- [ ] HIGH RISK: OP Stack sequencer liveness assumption reviewed in proposal execution logic
- [ ] Gnosis Safe address confirmed
- [ ] Chainlink feed availability verified on Base

### Arbitrum

- [ ] RPC endpoint confirmed and fallback set
- [ ] Arbiscan API key ready for verification
- [ ] Chain ID correct in deployment config: `42161`
- [ ] Gas price strategy set for Arbitrum fee model
- [ ] HIGH RISK: Block-dependent logic reviewed; use `ArbSys.arbBlockNumber()` if Arbitrum block number is required
- [ ] Sequencer uptime oracle integrated if using Chainlink
- [ ] Gnosis Safe deployed and tested

### Polygon

- [ ] RPC endpoint confirmed and fallback set
- [ ] Polygonscan API key ready for verification
- [ ] Chain ID correct in deployment config: `137`
- [ ] Gas price strategy set dynamically due to frequent gas spikes
- [ ] HIGH RISK: Chainlink feed heartbeat confirmed; some Polygon feeds update less frequently
- [ ] Gnosis Safe deployed and tested

### Optimism

- [ ] RPC endpoint confirmed and fallback set
- [ ] Optimistic Etherscan API key ready for verification
- [ ] Chain ID correct in deployment config: `10`
- [ ] Gas price strategy set for OP Stack fee model
- [ ] HIGH RISK: OP Stack sequencer dependency reviewed in proposal execution logic
- [ ] `block.timestamp` behavior confirmed for governance timing assumptions
- [ ] Gnosis Safe deployed and tested

### Solana

- [ ] RPC endpoint confirmed and fallback set
- [ ] N/A - EVM-style block explorer API key; use Solana explorer/program metadata process instead
- [ ] N/A - EVM chain ID; use Solana cluster and program IDs
- [ ] N/A - EIP-1559 / legacy gas; confirm compute budget and priority fee strategy instead
- [x] Anchor framework version installed locally
- [x] Anchor IDL generation fixed for local build through patched local `anchor-syn 0.30.1`
- [x] Local validator configured for Anchor deploy smoke verification
- [x] Happy-path instruction-level Anchor integration test written and passing
- [x] Treasury Anchor integration coverage written and passing
- [x] Negative-path checks for double voting and disabled treasury withdrawal written and passing
- [ ] Remaining negative-path checks for signer, attestation, inactive-member, and proposal-transition failures written and passing
- [ ] Program derived addresses documented for all accounts
- [ ] HIGH RISK: CPI attack surface reviewed even though EVM reentrancy does not apply directly
- [ ] Rent-exempt minimum balance pre-funded for all required accounts
- [ ] HIGH RISK: Gnosis Safe is EVM-only; Squads or native multisig replacement confirmed
- [ ] Chainlink Data Feeds on Solana verified; limited feed availability checked
- [ ] Program upgrade authority transferred to multisig after deploy

### Stellar

- [ ] RPC endpoint confirmed and fallback set
- [ ] N/A - EVM-style block explorer API key; use Stellar/Soroban verification process instead
- [ ] N/A - EVM chain ID; use Stellar network passphrase and contract IDs
- [ ] N/A - EIP-1559 / legacy gas; confirm Soroban resource fees and base reserves instead
- [ ] Soroban SDK version pinned
- [ ] HIGH RISK: Stellar / Soroban is not EVM; LayerZero and Wormhole support must be explicitly verified
- [ ] HIGH RISK: Chainlink does not natively support Stellar; alternative oracle strategy required
- [ ] HIGH RISK: Gnosis Safe is not available on Stellar; use Stellar multisig accounts with threshold signatures
- [ ] Stellar account funded with XLM for base reserves
- [ ] Contract footprint estimated and pre-funded
- [ ] Soroban contract size within network limit
- [ ] Stellar testnet deployment validated before mainnet

## 3. Contract configuration

- [ ] Access control roles assigned correctly
- [ ] Governor contract linked to correct token or voting weight source
- [ ] Timelock controller deployed and set as executor
- [ ] Proposer role assigned to Governor contract only
- [ ] Canceller role assigned to emergency multisig
- [ ] Quorum numerator set and documented
- [ ] Voting delay, voting period, and proposal threshold set per chain
- [ ] Timelocks and multisig thresholds set per chain
- [ ] Proxy / upgrade pattern confirmed, if applicable
- [ ] Initializer called exactly once; not in constructor for upgradeable contracts
- [ ] All state variables initialized; no uninitialized storage slots
- [ ] HIGH RISK: Cross-chain proposal execution path tested end-to-end on testnet

## 4. Cross-chain wiring

- [ ] Bridge choice finalized per chain pair: LayerZero, Wormhole, or both
- [ ] Bridge addresses confirmed on each chain
- [ ] HIGH RISK: Trusted remote / peer addresses set correctly on every chain; mismatch can silently drop messages
- [ ] LayerZero endpoint addresses verified from official docs
- [ ] Wormhole guardian set and VAA verification logic reviewed
- [ ] Message passing / relayer configured and funded
- [ ] Chain IDs and domain selectors match across all contracts
- [ ] Token address mappings verified end-to-end
- [ ] HIGH RISK: Replay protection enabled with nonces, unique message IDs, or domain separators
- [ ] Cross-chain domain separators include chain ID where applicable
- [ ] Message delivery failure fallback logic implemented
- [ ] HIGH RISK: Stellar bridge support explicitly confirmed with LayerZero / Wormhole before relying on it

## 5. Chainlink oracle integration

- [ ] All feed addresses sourced from official Chainlink docs
- [ ] Staleness check implemented: `require(block.timestamp - updatedAt < heartbeat)`
- [ ] HIGH RISK: Answer range validated: `require(answer > minAnswer && answer < maxAnswer)`
- [ ] Sequencer uptime feed integrated on Arbitrum, Base, and Optimism
- [ ] Fallback behavior defined if oracle returns stale or invalid data
- [ ] Decimal normalization confirmed across all feeds used
- [ ] N/A - Stellar native Chainlink integration; alternative oracle required

## 6. Post-deployment verification

- [ ] Contract verified on each chain's block explorer or native verification mechanism
- [ ] HIGH RISK: Ownership transferred to multisig, not deployer EOA
- [ ] All events firing correctly on testnet replay
- [ ] Governance proposal lifecycle tested: propose, vote, queue, execute
- [ ] Emergency pause tested, if implemented
- [ ] Frontend / SDK updated with new contract addresses
- [ ] Monitoring and alerting configured, for example OpenZeppelin Defender or Tenderly on EVM chains
- [ ] Incident response runbook updated with new addresses

## 7. Promote decision

Before promoting to mainnet, confirm:

- [ ] Testnet deployment passed all checks above
- [ ] Internal review signed off
- [ ] HIGH RISK: External audit completed and all critical / high findings remediated
- [ ] HIGH RISK: Bug bounty program live before mainnet governance is active
- [ ] Cross-chain message round-trip tested with real bridge on testnet
- [ ] Multisig signers tested signing and executing a real proposal
- [ ] Emergency pause / kill switch tested and documented
- [ ] Rollback plan documented and reviewed

## Deployment readiness verdict

**NOT READY - audit not started; remaining Solana negative-path integration tests not yet written; Stellar oracle and bridge support unconfirmed; Gnosis Safe replacement on Solana and Stellar not yet decided.**

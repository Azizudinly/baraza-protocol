// SPDX-License-Identifier: BUSL-1.1
#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token,
    Address, Env, String, Vec,
};

const MAX_SIGNERS: u32 = 20;

#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub community_id: String,
    /// Token contract address — use the native XLM token or BRZA token address.
    pub token: Address,
    pub signers: Vec<Address>,
    pub threshold: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct Proposal {
    pub id: u64,
    pub to: Address,
    pub amount: i128,
    pub memo: String,
    pub approvals: Vec<Address>,
    pub executed: bool,
    pub encumbered: bool,
    pub created_at: u64,
}

#[contracttype]
pub enum DataKey {
    Config,
    NextId,
    Proposal(u64),
    EncumberedBalance,
}

#[contract]
pub struct TreasuryVaultContract;

#[contractimpl]
impl TreasuryVaultContract {
    /// Initialize the vault. `signers` are the multisig participants; `threshold` is
    /// the minimum number of approvals required to execute a payment proposal.
    pub fn initialize(
        env: Env,
        community_id: String,
        token: Address,
        signers: Vec<Address>,
        threshold: u32,
    ) {
        if env.storage().instance().has(&DataKey::Config) {
            panic!("already initialized");
        }
        if signers.is_empty() {
            panic!("at least one signer required");
        }
        if signers.len() > MAX_SIGNERS {
            panic!("too many signers");
        }
        if threshold == 0 || threshold > signers.len() {
            panic!("threshold out of range");
        }

        env.storage().instance().set(&DataKey::Config, &Config {
            community_id,
            token,
            signers,
            threshold,
        });
        env.storage().instance().set(&DataKey::NextId, &0u64);
        env.storage().instance().set(&DataKey::EncumberedBalance, &0i128);
    }

    /// Propose a payment. Any signer can propose; the proposer counts as the first approval.
    pub fn propose(env: Env, proposer: Address, to: Address, amount: i128, memo: String) -> u64 {
        proposer.require_auth();
        let config = Self::load_config(&env);
        Self::assert_signer(&config.signers, &proposer);

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap();
        let mut approvals: Vec<Address> = Vec::new(&env);
        approvals.push_back(proposer.clone());

        let proposal = Proposal {
            id,
            to: to.clone(),
            amount,
            memo,
            approvals,
            executed: false,
            encumbered: false,
            created_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&DataKey::Proposal(id), &proposal);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        env.events()
            .publish((symbol_short!("proposed"), id), (proposer, to, amount));
        id
    }

    /// Approve an open proposal. Each signer may approve at most once.
    pub fn approve(env: Env, signer: Address, proposal_id: u64) {
        signer.require_auth();
        let config = Self::load_config(&env);
        Self::assert_signer(&config.signers, &signer);

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic!("proposal not found"));

        if proposal.executed {
            panic!("already executed");
        }
        if Self::vec_contains(&proposal.approvals, &signer) {
            panic!("already approved");
        }

        proposal.approvals.push_back(signer.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);

        env.events()
            .publish((symbol_short!("approved"), proposal_id), signer);
    }

    /// Encumber funds for a passed proposal prior to final execution (RT-02 Fix).
    /// Locks the amount into `EncumberedBalance` so concurrent proposals cannot overspend available vault liquidity.
    pub fn encumber_payout(env: Env, caller: Address, proposal_id: u64) {
        caller.require_auth();
        let config = Self::load_config(&env);
        Self::assert_signer(&config.signers, &caller);

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic!("proposal not found"));

        if proposal.executed {
            panic!("already executed");
        }
        if proposal.encumbered {
            panic!("already encumbered");
        }

        let avail = Self::available_balance(env.clone());
        if proposal.amount > avail {
            panic!("insufficient available balance");
        }

        let current_enc: i128 = env
            .storage()
            .instance()
            .get(&DataKey::EncumberedBalance)
            .unwrap_or(0);
        let new_enc = current_enc + proposal.amount;
        env.storage()
            .instance()
            .set(&DataKey::EncumberedBalance, &new_enc);

        proposal.encumbered = true;
        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);

        env.events()
            .publish((symbol_short!("encumber"), proposal_id), proposal.amount);
    }

    /// Execute a proposal once it has reached the approval threshold.
    /// Anyone can call this after enough approvals are in.
    pub fn execute(env: Env, proposal_id: u64) {
        let config = Self::load_config(&env);

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic!("proposal not found"));

        if proposal.executed {
            panic!("already executed");
        }
        if proposal.approvals.len() < config.threshold {
            panic!("insufficient approvals");
        }

        let vault_bal = Self::balance(env.clone());
        if proposal.amount > vault_bal {
            panic!("insufficient vault liquidity");
        }

        // Release encumbrance if the proposal was encumbered
        if proposal.encumbered {
            let current_enc: i128 = env
                .storage()
                .instance()
                .get(&DataKey::EncumberedBalance)
                .unwrap_or(0);
            let new_enc = if current_enc >= proposal.amount {
                current_enc - proposal.amount
            } else {
                0
            };
            env.storage()
                .instance()
                .set(&DataKey::EncumberedBalance, &new_enc);
            proposal.encumbered = false;
        }

        proposal.executed = true;
        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);

        token::Client::new(&env, &config.token).transfer(
            &env.current_contract_address(),
            &proposal.to,
            &proposal.amount,
        );

        env.events()
            .publish((symbol_short!("executed"), proposal_id), proposal.amount);
    }

    /// Deposit tokens into the treasury. Any address can fund it.
    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let config = Self::load_config(&env);
        token::Client::new(&env, &config.token)
            .transfer(&from, &env.current_contract_address(), &amount);

        env.events()
            .publish((symbol_short!("deposit"),), (from, amount));
    }

    /// Update multisig signers and approval threshold.
    /// Caller must be an existing signer and provide authorization.
    pub fn set_signers(
        env: Env,
        caller: Address,
        new_signers: Vec<Address>,
        new_threshold: u32,
    ) {
        caller.require_auth();
        let config = Self::load_config(&env);
        Self::assert_signer(&config.signers, &caller);

        if new_signers.is_empty() {
            panic!("at least one signer required");
        }
        if new_signers.len() > MAX_SIGNERS {
            panic!("too many signers");
        }
        if new_threshold == 0 || new_threshold > new_signers.len() {
            panic!("threshold out of range");
        }

        env.storage().instance().set(&DataKey::Config, &Config {
            community_id: config.community_id,
            token: config.token,
            signers: new_signers,
            threshold: new_threshold,
        });

        env.events()
            .publish((symbol_short!("signers"),), (caller, new_threshold));
    }

    pub fn balance(env: Env) -> i128 {
        let config = Self::load_config(&env);
        token::Client::new(&env, &config.token)
            .balance(&env.current_contract_address())
    }

    pub fn encumbered_balance(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::EncumberedBalance)
            .unwrap_or(0)
    }

    pub fn available_balance(env: Env) -> i128 {
        let total = Self::balance(env.clone());
        let enc = Self::encumbered_balance(env);
        if total >= enc {
            total - enc
        } else {
            0
        }
    }

    pub fn get_proposal(env: Env, proposal_id: u64) -> Option<Proposal> {
        env.storage().persistent().get(&DataKey::Proposal(proposal_id))
    }

    pub fn get_config(env: Env) -> Config {
        Self::load_config(&env)
    }

    fn load_config(env: &Env) -> Config {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .unwrap_or_else(|| panic!("not initialized"))
    }

    fn assert_signer(signers: &Vec<Address>, address: &Address) {
        if !Self::vec_contains(signers, address) {
            panic!("not a signer");
        }
    }

    fn vec_contains(vec: &Vec<Address>, target: &Address) -> bool {
        for item in vec.iter() {
            if item == *target {
                return true;
            }
        }
        false
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::Address as _,
        token::{Client as TokenClient, StellarAssetClient},
        vec, Env,
    };

    struct Harness<'a> {
        env: Env,
        client: TreasuryVaultContractClient<'a>,
        token: Address,
        token_admin_client: StellarAssetClient<'a>,
        vault_address: Address,
        signers: Vec<Address>,
    }

    fn setup(threshold: u32, signer_count: u32) -> Harness<'static> {
        let env = Env::default();
        env.mock_all_auths();

        let token_admin = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(token_admin);
        let token = sac.address();
        let token_admin_client = StellarAssetClient::new(&env, &token);

        let vault_address = env.register(TreasuryVaultContract, ());
        let client = TreasuryVaultContractClient::new(&env, &vault_address);

        let mut signers: Vec<Address> = Vec::new(&env);
        for _ in 0..signer_count {
            signers.push_back(Address::generate(&env));
        }

        client.initialize(
            &String::from_str(&env, "baraza-kisumu"),
            &token,
            &signers,
            &threshold,
        );

        Harness {
            env,
            client,
            token,
            token_admin_client,
            vault_address,
            signers,
        }
    }

    #[test]
    fn test_full_multisig_flow_executes_token_transfer() {
        let h = setup(2, 3);

        // Fund the vault so it can pay out.
        h.token_admin_client.mint(&h.vault_address, &1_000);

        let recipient = Address::generate(&h.env);
        let memo = String::from_str(&h.env, "operational payout");

        let proposal_id = h.client.propose(&h.signers.get(0).unwrap(), &recipient, &400, &memo);
        // Proposer counts as the first approval; one more reaches threshold=2.
        h.client.approve(&h.signers.get(1).unwrap(), &proposal_id);

        h.client.execute(&proposal_id);

        let token_client = TokenClient::new(&h.env, &h.token);
        assert_eq!(token_client.balance(&recipient), 400);
        assert_eq!(token_client.balance(&h.vault_address), 600);

        let proposal = h.client.get_proposal(&proposal_id).unwrap();
        assert!(proposal.executed);
    }

    #[test]
    fn test_encumbrance_locks_available_balance_and_prevents_overdraft_race() {
        let h = setup(1, 1);
        let signer = h.signers.get(0).unwrap();
        h.token_admin_client.mint(&h.vault_address, &1_000);

        assert_eq!(h.client.balance(), 1_000);
        assert_eq!(h.client.available_balance(), 1_000);
        assert_eq!(h.client.encumbered_balance(), 0);

        let recipient_a = Address::generate(&h.env);
        let prop_a = h.client.propose(
            &signer,
            &recipient_a,
            &600,
            &String::from_str(&h.env, "Prop A"),
        );

        // Encumber Proposal A (600 out of 1000)
        h.client.encumber_payout(&signer, &prop_a);
        assert_eq!(h.client.encumbered_balance(), 600);
        assert_eq!(h.client.available_balance(), 400);

        // Proposal B requesting 500 should fail encumbrance because available balance is only 400
        let recipient_b = Address::generate(&h.env);
        let _prop_b = h.client.propose(
            &signer,
            &recipient_b,
            &500,
            &String::from_str(&h.env, "Prop B"),
        );

        // Try encumbering Proposal B -> should fail
        // Once Prop A executes, 600 is released and balance becomes 400
        h.client.execute(&prop_a);
        assert_eq!(h.client.balance(), 400);
        assert_eq!(h.client.encumbered_balance(), 0);
        assert_eq!(h.client.available_balance(), 400);

        let token_client = TokenClient::new(&h.env, &h.token);
        assert_eq!(token_client.balance(&recipient_a), 600);
    }

    #[test]
    #[should_panic(expected = "insufficient available balance")]
    fn test_encumber_exceeding_available_balance_fails() {
        let h = setup(1, 1);
        let signer = h.signers.get(0).unwrap();
        h.token_admin_client.mint(&h.vault_address, &500);

        let recipient = Address::generate(&h.env);
        let prop_id = h.client.propose(
            &signer,
            &recipient,
            &600,
            &String::from_str(&h.env, "Too big"),
        );
        h.client.encumber_payout(&signer, &prop_id);
    }

    #[test]
    #[should_panic(expected = "insufficient approvals")]
    fn test_execute_below_threshold_rejected() {
        let h = setup(3, 3);
        h.token_admin_client.mint(&h.vault_address, &500);

        let recipient = Address::generate(&h.env);
        let proposal_id = h.client.propose(
            &h.signers.get(0).unwrap(),
            &recipient,
            &100,
            &String::from_str(&h.env, "early"),
        );
        // Only 1 approval (proposer) — threshold is 3.
        h.client.execute(&proposal_id);
    }

    #[test]
    #[should_panic(expected = "already approved")]
    fn test_double_approval_by_same_signer_rejected() {
        let h = setup(2, 3);
        let recipient = Address::generate(&h.env);
        let proposal_id = h.client.propose(
            &h.signers.get(0).unwrap(),
            &recipient,
            &50,
            &String::from_str(&h.env, "dup"),
        );
        // Proposer already counts as approval 1 — re-approving must fail.
        h.client.approve(&h.signers.get(0).unwrap(), &proposal_id);
    }

    #[test]
    #[should_panic(expected = "not a signer")]
    fn test_propose_by_non_signer_rejected() {
        let h = setup(2, 3);
        let outsider = Address::generate(&h.env);
        let recipient = Address::generate(&h.env);
        h.client.propose(
            &outsider,
            &recipient,
            &10,
            &String::from_str(&h.env, "outsider"),
        );
    }

    #[test]
    #[should_panic(expected = "not a signer")]
    fn test_approve_by_non_signer_rejected() {
        let h = setup(2, 3);
        let recipient = Address::generate(&h.env);
        let proposal_id = h.client.propose(
            &h.signers.get(0).unwrap(),
            &recipient,
            &10,
            &String::from_str(&h.env, "p"),
        );
        let outsider = Address::generate(&h.env);
        h.client.approve(&outsider, &proposal_id);
    }

    #[test]
    #[should_panic(expected = "already executed")]
    fn test_execute_twice_rejected() {
        let h = setup(2, 2);
        h.token_admin_client.mint(&h.vault_address, &500);
        let recipient = Address::generate(&h.env);
        let proposal_id = h.client.propose(
            &h.signers.get(0).unwrap(),
            &recipient,
            &50,
            &String::from_str(&h.env, "once"),
        );
        h.client.approve(&h.signers.get(1).unwrap(), &proposal_id);
        h.client.execute(&proposal_id);
        // Second execute must trip the executed flag.
        h.client.execute(&proposal_id);
    }

    #[test]
    #[should_panic(expected = "amount must be positive")]
    fn test_propose_non_positive_amount_rejected() {
        let h = setup(2, 2);
        let recipient = Address::generate(&h.env);
        h.client.propose(
            &h.signers.get(0).unwrap(),
            &recipient,
            &0,
            &String::from_str(&h.env, "zero"),
        );
    }

    #[test]
    fn test_deposit_increases_balance() {
        let h = setup(2, 2);
        let depositor = Address::generate(&h.env);
        h.token_admin_client.mint(&depositor, &900);

        h.client.deposit(&depositor, &900);
        assert_eq!(h.client.balance(), 900);

        let token_client = TokenClient::new(&h.env, &h.token);
        assert_eq!(token_client.balance(&depositor), 0);
    }

    #[test]
    #[should_panic(expected = "threshold out of range")]
    fn test_initialize_threshold_above_signer_count_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let token_admin = Address::generate(&env);
        let token = env.register_stellar_asset_contract_v2(token_admin).address();

        let vault = env.register(TreasuryVaultContract, ());
        let client = TreasuryVaultContractClient::new(&env, &vault);

        let signers = vec![&env, Address::generate(&env), Address::generate(&env)];
        client.initialize(
            &String::from_str(&env, "x"),
            &token,
            &signers,
            &4, // threshold > signers.len()
        );
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_initialize_twice_rejected() {
        let h = setup(1, 1);
        h.client.initialize(
            &String::from_str(&h.env, "y"),
            &h.token,
            &h.signers,
            &1,
        );
    }

    #[test]
    fn test_set_signers_progressive_upgrade() {
        // Step 1: Initialize Founder 1-of-1 vault
        let h = setup(1, 1);
        h.token_admin_client.mint(&h.vault_address, &2_000);

        let founder = h.signers.get(0).unwrap();
        let config = h.client.get_config();
        assert_eq!(config.threshold, 1);
        assert_eq!(config.signers.len(), 1);

        // Step 2: Progressive upgrade to 2-of-3 with community officers
        let officer1 = Address::generate(&h.env);
        let officer2 = Address::generate(&h.env);
        let new_signers = vec![&h.env, founder.clone(), officer1.clone(), officer2.clone()];
        h.client.set_signers(&founder, &new_signers, &2);

        let updated_config = h.client.get_config();
        assert_eq!(updated_config.threshold, 2);
        assert_eq!(updated_config.signers.len(), 3);

        // Step 3: Propose payout under 2-of-3 rules
        let recipient = Address::generate(&h.env);
        let proposal_id = h.client.propose(
            &founder,
            &recipient,
            &500,
            &String::from_str(&h.env, "grant payout"),
        );

        // Proposer approval only (1 of 2) -> execution fails
        let prop = h.client.get_proposal(&proposal_id).unwrap();
        assert_eq!(prop.approvals.len(), 1);

        // Second officer approves -> execution succeeds
        h.client.approve(&officer1, &proposal_id);
        h.client.execute(&proposal_id);

        let token_client = TokenClient::new(&h.env, &h.token);
        assert_eq!(token_client.balance(&recipient), 500);
        assert_eq!(token_client.balance(&h.vault_address), 1_500);
    }

    #[test]
    #[should_panic(expected = "not a signer")]
    fn test_set_signers_non_signer_rejected() {
        let h = setup(2, 2);
        let outsider = Address::generate(&h.env);
        let new_signers = vec![&h.env, Address::generate(&h.env)];
        h.client.set_signers(&outsider, &new_signers, &1);
    }
}

// SPDX-License-Identifier: BUSL-1.1
#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, IntoVal, String, Symbol, Val, Vec,
};

fn require_member(env: &Env, community_id: &String, voter: &Address) {
    let membership: Address = env.storage().instance().get(&DataKey::Membership).unwrap();
    let args: Vec<Val> = soroban_sdk::vec![
        env,
        community_id.into_val(env),
        voter.into_val(env),
    ];
    let is_member: bool = env.invoke_contract(&membership, &Symbol::new(env, "is_member"), args);
    if !is_member {
        panic!("not a member");
    }
}

fn fetch_snapshot_member_count(env: &Env, community_id: &String) -> u32 {
    let membership: Address = env.storage().instance().get(&DataKey::Membership).unwrap();
    let args: Vec<Val> = soroban_sdk::vec![
        env,
        community_id.into_val(env),
    ];
    let count: u32 = env.invoke_contract(&membership, &Symbol::new(env, "member_count"), args);
    if count == 0 {
        1
    } else {
        count
    }
}

/// 7 days in seconds — default voting window.
const DEFAULT_VOTING_PERIOD: u64 = 7 * 24 * 60 * 60;
/// 48 hours in seconds — deadlock resolution deliberation window.
const TIE_EXTENSION_SECONDS: u64 = 48 * 60 * 60;
/// Default quorum threshold in basis points (2000 bps = 20.00%).
const DEFAULT_QUORUM_BPS: u32 = 2000;

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ProposalStatus {
    Active,
    Passed,
    Failed,
    Tied,
    Executed,
    Cancelled,
}

#[contracttype]
#[derive(Clone)]
pub struct Proposal {
    pub id: u64,
    pub community_id: String,
    pub title: String,
    pub description: String,
    pub proposer: Address,
    pub for_votes: u32,
    pub against_votes: u32,
    pub status: ProposalStatus,
    pub deadline: u64,
    pub executed: bool,
    pub snapshot_member_count: u32,
    pub quorum_threshold_bps: u32,
    pub tie_extended: bool,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Membership,
    VotingPeriod,
    NextId,
    Proposal(u64),
    Voted(u64, Address),
}

#[contract]
pub struct GovernanceContract;

#[contractimpl]
impl GovernanceContract {
    /// One-time setup.
    /// `membership` is the address of the deployed membership contract.
    /// `voting_period` overrides the default 7-day window (in seconds).
    pub fn initialize(
        env: Env,
        admin: Address,
        membership: Address,
        voting_period: Option<u64>,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Membership, &membership);
        env.storage().instance().set(
            &DataKey::VotingPeriod,
            &voting_period.unwrap_or(DEFAULT_VOTING_PERIOD),
        );
        env.storage().instance().set(&DataKey::NextId, &0u64);
    }

    /// Create a governance proposal for a community with default 20% quorum.
    pub fn create_proposal(
        env: Env,
        proposer: Address,
        community_id: String,
        title: String,
        description: String,
    ) -> u64 {
        Self::create_proposal_with_quorum(
            env,
            proposer,
            community_id,
            title,
            description,
            DEFAULT_QUORUM_BPS,
        )
    }

    /// Create a governance proposal with custom quorum in basis points (e.g. 2000 = 20%).
    pub fn create_proposal_with_quorum(
        env: Env,
        proposer: Address,
        community_id: String,
        title: String,
        description: String,
        quorum_threshold_bps: u32,
    ) -> u64 {
        proposer.require_auth();

        if title.len() == 0 {
            panic!("title required");
        }

        require_member(&env, &community_id, &proposer);

        let id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap();
        let period: u64 = env.storage().instance().get(&DataKey::VotingPeriod).unwrap();
        let deadline = env.ledger().timestamp() + period;

        // Snapshot total member weight denominator at creation time (RT-01 Fix)
        let snapshot_count = fetch_snapshot_member_count(&env, &community_id);

        let proposal = Proposal {
            id,
            community_id: community_id.clone(),
            title,
            description,
            proposer: proposer.clone(),
            for_votes: 0,
            against_votes: 0,
            status: ProposalStatus::Active,
            deadline,
            executed: false,
            snapshot_member_count: snapshot_count,
            quorum_threshold_bps,
            tie_extended: false,
        };

        env.storage().persistent().set(&DataKey::Proposal(id), &proposal);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));

        env.events()
            .publish((symbol_short!("proposed"), id), (proposer, community_id));
        id
    }

    /// Cast a vote on an active proposal.
    /// `support = true` is a FOR vote; `false` is AGAINST.
    pub fn vote(env: Env, voter: Address, proposal_id: u64, support: bool) {
        voter.require_auth();

        let voted_key = DataKey::Voted(proposal_id, voter.clone());
        if env
            .storage()
            .persistent()
            .get::<DataKey, bool>(&voted_key)
            .unwrap_or(false)
        {
            panic!("already voted");
        }

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic!("proposal not found"));

        require_member(&env, &proposal.community_id, &voter);

        if proposal.status != ProposalStatus::Active {
            panic!("proposal not active");
        }
        if env.ledger().timestamp() > proposal.deadline {
            panic!("voting period ended");
        }

        if support {
            proposal.for_votes += 1;
        } else {
            proposal.against_votes += 1;
        }

        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage().persistent().set(&voted_key, &true);

        env.events()
            .publish((symbol_short!("voted"), proposal_id), (voter, support));
    }

    /// Finalize a proposal once its deadline has passed.
    /// Evaluates snapshotted quorum threshold and non-silent tie extension.
    pub fn finalize(env: Env, proposal_id: u64) -> ProposalStatus {
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic!("proposal not found"));

        if proposal.status != ProposalStatus::Active {
            panic!("already finalized");
        }
        if env.ledger().timestamp() <= proposal.deadline {
            panic!("voting period not ended");
        }

        let total_votes: u64 = (proposal.for_votes + proposal.against_votes) as u64;
        let mut min_quorum_votes: u64 = (proposal.snapshot_member_count as u64
            * proposal.quorum_threshold_bps as u64)
            / 10_000;

        // Quorum decay window for unanimous high-consensus proposals (SAD §8.1 / Manifest §4.1)
        if proposal.against_votes == 0 && proposal.for_votes > 0 && min_quorum_votes > 1 {
            min_quorum_votes = (min_quorum_votes + 1) / 2;
        }

        // Quorum Check: If participation < required threshold -> FAILED
        if total_votes < min_quorum_votes {
            proposal.status = ProposalStatus::Failed;
        } else if proposal.for_votes > proposal.against_votes {
            proposal.status = ProposalStatus::Passed;
        } else if proposal.against_votes > proposal.for_votes {
            proposal.status = ProposalStatus::Failed;
        } else {
            // Equal FOR and AGAINST votes: Non-Silent Tie Handling (RT-06 Fix)
            if !proposal.tie_extended {
                // First tie: Grant 48-Hour Deliberation Window Extension
                proposal.deadline = env.ledger().timestamp() + TIE_EXTENSION_SECONDS;
                proposal.tie_extended = true;
                proposal.status = ProposalStatus::Active; // Keep active for deliberation
                env.storage()
                    .persistent()
                    .set(&DataKey::Proposal(proposal_id), &proposal.clone());
                env.events()
                    .publish((symbol_short!("tie_ext"), proposal_id), proposal.deadline);
                return proposal.status;
            } else {
                // Second tie after extension: Terminal Tied State
                proposal.status = ProposalStatus::Tied;
            }
        }

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal.clone());

        env.events()
            .publish((symbol_short!("final"), proposal_id), proposal.for_votes);

        proposal.status
    }

    /// Mark a passed proposal as executed. Admin only.
    /// Call this after any on-chain or off-chain action the proposal authorized has been taken.
    pub fn mark_executed(env: Env, proposal_id: u64) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic!("proposal not found"));

        if proposal.status != ProposalStatus::Passed {
            panic!("proposal has not passed");
        }

        proposal.status = ProposalStatus::Executed;
        proposal.executed = true;
        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);

        env.events()
            .publish((symbol_short!("executed"), proposal_id), proposal_id);
    }

    /// Cancel an active proposal. Proposer or admin only.
    pub fn cancel(env: Env, caller: Address, proposal_id: u64) {
        caller.require_auth();

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic!("proposal not found"));

        if proposal.status != ProposalStatus::Active {
            panic!("can only cancel active proposals");
        }

        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != proposal.proposer && caller != admin {
            panic!("only the proposer or admin can cancel");
        }

        proposal.status = ProposalStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);

        env.events()
            .publish((symbol_short!("cancel"), proposal_id), caller);
    }

    pub fn get_proposal(env: Env, proposal_id: u64) -> Option<Proposal> {
        env.storage().persistent().get(&DataKey::Proposal(proposal_id))
    }

    pub fn has_voted(env: Env, proposal_id: u64, voter: Address) -> bool {
        env.storage()
            .persistent()
            .get::<DataKey, bool>(&DataKey::Voted(proposal_id, voter))
            .unwrap_or(false)
        }

    pub fn set_voting_period(env: Env, period: u64) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if period == 0 {
            panic!("voting period must be positive");
        }
        env.storage().instance().set(&DataKey::VotingPeriod, &period);
    }

    pub fn voting_period(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::VotingPeriod).unwrap()
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        contract as sdk_contract, contractimpl as sdk_contractimpl,
        testutils::{Address as _, Ledger as _},
        Env,
    };

    #[sdk_contract]
    pub struct MockMembership;

    #[sdk_contractimpl]
    impl MockMembership {
        pub fn is_member(_env: Env, _community_id: String, _member: Address) -> bool {
            true
        }

        pub fn member_count(_env: Env, _community_id: String) -> u32 {
            5
        }
    }

    fn setup() -> (Env, GovernanceContractClient<'static>, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let membership_id = env.register(MockMembership, ());
        let governance_id = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &governance_id);
        (env, client, membership_id)
    }

    #[test]
    fn test_full_proposal_lifecycle_with_quorum() {
        let (env, client, membership) = setup();
        let admin = Address::generate(&env);
        client.initialize(&admin, &membership, &None);

        let proposer = Address::generate(&env);
        let community_id = String::from_str(&env, "baraza-dar");
        let title = String::from_str(&env, "Fund the well");
        let desc = String::from_str(&env, "Build a water well in the community centre.");

        let proposal_id = client.create_proposal(&proposer, &community_id, &title, &desc);
        assert_eq!(proposal_id, 0);

        let prop = client.get_proposal(&proposal_id).unwrap();
        assert_eq!(prop.snapshot_member_count, 5);
        assert_eq!(prop.quorum_threshold_bps, 2000);

        let voter_a = Address::generate(&env);
        let voter_b = Address::generate(&env);
        let voter_c = Address::generate(&env);

        client.vote(&voter_a, &proposal_id, &true);
        client.vote(&voter_b, &proposal_id, &true);
        client.vote(&voter_c, &proposal_id, &false);

        assert!(client.has_voted(&proposal_id, &voter_a));

        // Advance ledger time past the voting deadline.
        let period = client.voting_period();
        env.ledger().with_mut(|l| l.timestamp += period + 1);

        let status = client.finalize(&proposal_id);
        assert_eq!(status, ProposalStatus::Passed);

        client.mark_executed(&proposal_id);
        let proposal = client.get_proposal(&proposal_id).unwrap();
        assert_eq!(proposal.status, ProposalStatus::Executed);
        assert!(proposal.executed);
    }

    #[test]
    fn test_quorum_starvation_causes_proposal_failure() {
        let (env, client, membership) = setup();
        let admin = Address::generate(&env);
        client.initialize(&admin, &membership, &None);

        let proposer = Address::generate(&env);
        let community_id = String::from_str(&env, "baraza-nakuru");
        let title = String::from_str(&env, "High Quorum Proposal");
        let desc = String::from_str(&env, "Requires 80% quorum.");

        // 80% quorum of 5 members = 4 votes required.
        let proposal_id = client.create_proposal_with_quorum(
            &proposer,
            &community_id,
            &title,
            &desc,
            &8000,
        );

        let voter_a = Address::generate(&env);
        client.vote(&voter_a, &proposal_id, &true); // Only 1 vote cast

        let period = client.voting_period();
        env.ledger().with_mut(|l| l.timestamp += period + 1);

        let status = client.finalize(&proposal_id);
        // Quorum unmet: fails despite 100% FOR ratio
        assert_eq!(status, ProposalStatus::Failed);
    }

    #[test]
    fn test_tied_proposal_triggers_extension_then_terminal_tie() {
        let (env, client, membership) = setup();
        let admin = Address::generate(&env);
        client.initialize(&admin, &membership, &None);

        let proposer = Address::generate(&env);
        let community_id = String::from_str(&env, "baraza-nairobi");
        let title = String::from_str(&env, "Split the room");
        let desc = String::from_str(&env, "One for, one against.");

        let proposal_id = client.create_proposal(&proposer, &community_id, &title, &desc);
        let voter_a = Address::generate(&env);
        let voter_b = Address::generate(&env);
        client.vote(&voter_a, &proposal_id, &true);
        client.vote(&voter_b, &proposal_id, &false);

        let period = client.voting_period();
        env.ledger().with_mut(|l| l.timestamp += period + 1);

        // First finalization: triggers 48h extension (RT-06)
        let status = client.finalize(&proposal_id);
        assert_eq!(status, ProposalStatus::Active);

        let prop = client.get_proposal(&proposal_id).unwrap();
        assert!(prop.tie_extended);

        // Advance past the 48h extension window
        env.ledger().with_mut(|l| l.timestamp += TIE_EXTENSION_SECONDS + 1);

        // Second finalization: transitions to terminal Tied
        let status_second = client.finalize(&proposal_id);
        assert_eq!(status_second, ProposalStatus::Tied);
    }

    #[test]
    #[should_panic(expected = "already voted")]
    fn test_double_vote_rejected() {
        let (env, client, membership) = setup();
        let admin = Address::generate(&env);
        client.initialize(&admin, &membership, &None);

        let proposer = Address::generate(&env);
        let community_id = String::from_str(&env, "baraza-kigali");
        let title = String::from_str(&env, "New rule");
        let desc = String::from_str(&env, "Proposal description.");

        let proposal_id = client.create_proposal(&proposer, &community_id, &title, &desc);
        let voter = Address::generate(&env);
        client.vote(&voter, &proposal_id, &true);
        client.vote(&voter, &proposal_id, &true);
    }

    #[test]
    #[should_panic(expected = "proposal has not passed")]
    fn test_tied_proposal_cannot_be_executed() {
        let (env, client, membership) = setup();
        let admin = Address::generate(&env);
        client.initialize(&admin, &membership, &None);

        let proposer = Address::generate(&env);
        let community_id = String::from_str(&env, "baraza-mombasa");
        let title = String::from_str(&env, "Deadlocked");
        let desc = String::from_str(&env, "One for, one against.");

        let proposal_id = client.create_proposal(&proposer, &community_id, &title, &desc);

        let voter_a = Address::generate(&env);
        let voter_b = Address::generate(&env);
        client.vote(&voter_a, &proposal_id, &true);
        client.vote(&voter_b, &proposal_id, &false);

        let period = client.voting_period();
        env.ledger().with_mut(|l| l.timestamp += period + 1);

        // First finalization extends
        client.finalize(&proposal_id);
        env.ledger().with_mut(|l| l.timestamp += TIE_EXTENSION_SECONDS + 1);

        // Second finalization sets Tied
        let status = client.finalize(&proposal_id);
        assert_eq!(status, ProposalStatus::Tied);

        client.mark_executed(&proposal_id);
    }

    #[test]
    fn test_failed_proposal_when_against_wins() {
        let (env, client, membership) = setup();
        let admin = Address::generate(&env);
        client.initialize(&admin, &membership, &None);

        let proposer = Address::generate(&env);
        let community_id = String::from_str(&env, "baraza-lusaka");
        let title = String::from_str(&env, "Rejected idea");
        let desc = String::from_str(&env, "This will not pass.");

        let proposal_id = client.create_proposal(&proposer, &community_id, &title, &desc);
        let voter_a = Address::generate(&env);
        let voter_b = Address::generate(&env);
        client.vote(&voter_a, &proposal_id, &false);
        client.vote(&voter_b, &proposal_id, &false);

        let period = client.voting_period();
        env.ledger().with_mut(|l| l.timestamp += period + 1);

        let status = client.finalize(&proposal_id);
        assert_eq!(status, ProposalStatus::Failed);
    }
}

// SPDX-License-Identifier: BUSL-1.1
#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, String,
};

#[contracttype]
pub enum DataKey {
    Admin,
    Registry,                  // community_registry contract address
    Member(String, Address),   // (community_id, member) -> bool
    Count(String),             // community_id -> u32
}

#[contract]
pub struct MembershipContract;

#[contractimpl]
impl MembershipContract {
    /// One-time setup.
    /// `registry` is the address of the deployed community_registry contract —
    /// used for membership-gated cross-contract calls in future extensions.
    pub fn initialize(env: Env, admin: Address, registry: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Registry, &registry);
    }

    /// Join a community. The joining address must authorize this call.
    pub fn join(env: Env, community_id: String, member: Address) {
        member.require_auth();

        let key = DataKey::Member(community_id.clone(), member.clone());
        if env
            .storage()
            .persistent()
            .get::<DataKey, bool>(&key)
            .unwrap_or(false)
        {
            panic!("already a member");
        }

        env.storage().persistent().set(&key, &true);
        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::Count(community_id.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Count(community_id.clone()), &(count + 1));

        env.events()
            .publish((symbol_short!("join"), community_id), member);
    }

    /// Leave a community. Only the member can remove themselves.
    pub fn leave(env: Env, community_id: String, member: Address) {
        member.require_auth();

        let key = DataKey::Member(community_id.clone(), member.clone());
        if !env
            .storage()
            .persistent()
            .get::<DataKey, bool>(&key)
            .unwrap_or(false)
        {
            panic!("not a member");
        }

        env.storage().persistent().remove(&key);
        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::Count(community_id.clone()))
            .unwrap_or(0);
        if count > 0 {
            env.storage()
                .persistent()
                .set(&DataKey::Count(community_id.clone()), &(count - 1));
        }

        env.events()
            .publish((symbol_short!("leave"), community_id), member);
    }

    /// Remove a member. Admin only — for moderation.
    pub fn kick(env: Env, community_id: String, member: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let key = DataKey::Member(community_id.clone(), member.clone());
        if !env
            .storage()
            .persistent()
            .get::<DataKey, bool>(&key)
            .unwrap_or(false)
        {
            panic!("not a member");
        }

        env.storage().persistent().remove(&key);
        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::Count(community_id.clone()))
            .unwrap_or(0);
        if count > 0 {
            env.storage()
                .persistent()
                .set(&DataKey::Count(community_id.clone()), &(count - 1));
        }

        env.events()
            .publish((symbol_short!("kick"), community_id), member);
    }

    pub fn is_member(env: Env, community_id: String, member: Address) -> bool {
        env.storage()
            .persistent()
            .get::<DataKey, bool>(&DataKey::Member(community_id, member))
            .unwrap_or(false)
    }

    pub fn member_count(env: Env, community_id: String) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Count(community_id))
            .unwrap_or(0)
    }

    pub fn active_count(env: Env, community_id: String) -> u32 {
        Self::member_count(env, community_id)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_join_leave_count() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register_contract(None, MembershipContract);
        let client = MembershipContractClient::new(&env, &id);

        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        client.initialize(&admin, &registry);

        let community_id = String::from_str(&env, "baraza-kampala");
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.join(&community_id, &alice);
        client.join(&community_id, &bob);
        assert_eq!(client.member_count(&community_id), 2);
        assert!(client.is_member(&community_id, &alice));

        client.leave(&community_id, &alice);
        assert_eq!(client.member_count(&community_id), 1);
        assert!(!client.is_member(&community_id, &alice));
    }

    #[test]
    #[should_panic(expected = "already a member")]
    fn test_double_join_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register_contract(None, MembershipContract);
        let client = MembershipContractClient::new(&env, &id);

        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        client.initialize(&admin, &registry);

        let community_id = String::from_str(&env, "baraza-accra");
        let alice = Address::generate(&env);
        client.join(&community_id, &alice);
        client.join(&community_id, &alice);
    }
}



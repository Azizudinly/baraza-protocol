/**
 * Soroban contract client for Baraza's v2 five-contract workspace, mirroring
 * `lib/programs/client.ts` (the Solana Anchor client) so `CreateCommunity.tsx`
 * and the governance pages can call Stellar and Solana through a similar
 * shape.
 *
 * IMPORTANT — unlike the Solana client, this has NOT been exercised against
 * a live deployment. There is no Anchor-style pre-generated IDL for Soroban
 * here; `contract.Client.from()` fetches the contract's published spec from
 * the RPC at call time, and TypeScript therefore cannot statically know the
 * per-contract method names — `callContractMethod` below does a runtime
 * lookup and throws a clear error if the deployed contract's spec doesn't
 * have the expected method, rather than silently failing. Every method name
 * and argument list here was taken directly from the Rust source
 * (`contracts/stellar/{community_registry,governance}/src/lib.rs`), not
 * from a working round-trip test, because live network access to Stellar
 * testnet was unavailable in the environment this was written in (see PR
 * description). Verify the first live call carefully.
 */
import { Client as SorobanClient, type AssembledTransaction } from '@stellar/stellar-sdk/contract';
import {
  STELLAR_NETWORK,
  STELLAR_NETWORK_PASSPHRASE,
  STELLAR_SOROBAN_RPC_URL,
} from '@/lib/network';
import { getStellarContractAddresses, isStellarContractDeployed } from './stellarAddresses';
import type { FreighterApi } from '@/hooks/useStellarWallet';

export interface StellarSigner {
  publicKey: string;
  signTransaction: NonNullable<FreighterApi['signTransaction']>;
}

type ContractMethodInvoker = (
  args: Record<string, unknown>,
) => Promise<AssembledTransaction<unknown>>;

async function callContractMethod(
  client: SorobanClient,
  method: string,
  args: Record<string, unknown>,
): Promise<AssembledTransaction<unknown>> {
  const invoker = (client as unknown as Record<string, ContractMethodInvoker>)[method];
  if (typeof invoker !== 'function') {
    throw new Error(
      `Soroban contract ${client.options.contractId} has no "${method}" method in its published spec.`,
    );
  }
  return invoker(args);
}

async function signAndSendTx(tx: AssembledTransaction<unknown>, signer: StellarSigner): Promise<string> {
  const sent = await tx.signAndSend({
    signTransaction: (xdr, opts) =>
      signer.signTransaction(xdr, { networkPassphrase: STELLAR_NETWORK_PASSPHRASE, ...opts }),
  });
  return (
    sent.getTransactionResponse && 'txHash' in sent.getTransactionResponse
      ? (sent.getTransactionResponse as { txHash: string }).txHash
      : sent.sendTransactionResponse?.hash
  ) ?? '';
}

export class BarazaStellarClient {
  private addresses = getStellarContractAddresses(STELLAR_NETWORK);

  constructor(private signer: StellarSigner) {}

  get isCommunityRegistryDeployed(): boolean {
    return isStellarContractDeployed(this.addresses.communityRegistry);
  }

  get communityRegistryContractId(): string {
    return this.addresses.communityRegistry;
  }

  get isGovernanceDeployed(): boolean {
    return isStellarContractDeployed(this.addresses.governance);
  }

  get governanceContractId(): string {
    return this.addresses.governance;
  }

  private async loadClient(contractId: string): Promise<SorobanClient> {
    return SorobanClient.from({
      contractId,
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      rpcUrl: STELLAR_SOROBAN_RPC_URL,
      publicKey: this.signer.publicKey,
    });
  }

  /**
   * Registers a community on the deployed `community_registry` contract —
   * Rust signature: `register(env, community_id: String, name: String, admin: Address)`.
   * Mirrors `BarazaChainClient.createCommunity` on the Solana side.
   */
  async registerCommunity(communityId: string, name: string): Promise<string> {
    if (!this.isCommunityRegistryDeployed) {
      throw new Error('community_registry Soroban contract is not deployed on this network yet.');
    }
    const client = await this.loadClient(this.addresses.communityRegistry);
    const tx = await callContractMethod(client, 'register', {
      community_id: communityId,
      name,
      admin: this.signer.publicKey,
    });
    return signAndSendTx(tx, this.signer);
  }

  /**
   * Creates a governance proposal on-chain — Rust signature:
   * `create_proposal(env, proposer: Address, community_id: String, title: String, description: String) -> u64`.
   * Title and description are stored directly by the contract (not a hash);
   * there is no off-chain-body/on-chain-hash pattern documented anywhere in
   * this repo to mirror, so this calls the contract's actual shape.
   */
  async createProposal(
    communityId: string,
    title: string,
    description: string,
  ): Promise<{ txHash: string; proposalId: string }> {
    if (!this.isGovernanceDeployed) {
      throw new Error('governance Soroban contract is not deployed on this network yet.');
    }
    const client = await this.loadClient(this.addresses.governance);
    const tx = await callContractMethod(client, 'create_proposal', {
      proposer: this.signer.publicKey,
      community_id: communityId,
      title,
      description,
    });
    const txHash = await signAndSendTx(tx, this.signer);
    return { txHash, proposalId: String(tx.result ?? '') };
  }

  /**
   * Casts a vote — Rust signature: `vote(env, voter: Address, proposal_id: u64, support: bool)`.
   * This contract and `treasury_vault` (which owns fund execution) are
   * separate contracts — voting does not touch `withdrawals_enabled`.
   */
  async castVote(proposalId: string, support: boolean): Promise<string> {
    if (!this.isGovernanceDeployed) {
      throw new Error('governance Soroban contract is not deployed on this network yet.');
    }
    const client = await this.loadClient(this.addresses.governance);
    const tx = await callContractMethod(client, 'vote', {
      voter: this.signer.publicKey,
      proposal_id: BigInt(proposalId),
      support,
    });
    return signAndSendTx(tx, this.signer);
  }
}

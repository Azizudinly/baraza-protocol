import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { getPublicEnv } from '@/lib/env';

type NetworkName = 'mainnet' | 'devnet' | 'testnet';
export type ProductEnvironment = 'test' | 'live';

const ENVIRONMENT_STORAGE_KEY = 'baraza:environment';
const publicEnv = getPublicEnv();

function normaliseNetwork(raw: string): NetworkName {
  return raw === 'mainnet' || raw === 'mainnet-beta'
    ? 'mainnet'
    : raw === 'testnet'
      ? 'testnet'
      : 'devnet';
}

export function readStoredEnvironment(): ProductEnvironment {
  if (typeof window === 'undefined') return 'test';
  return window.localStorage.getItem(ENVIRONMENT_STORAGE_KEY) === 'live' ? 'live' : 'test';
}

export function writeStoredEnvironment(environment: ProductEnvironment): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ENVIRONMENT_STORAGE_KEY, environment);
}

export const PRODUCT_ENVIRONMENT = readStoredEnvironment();
const CONFIGURED_NETWORK = normaliseNetwork(publicEnv.VITE_SOLANA_NETWORK.toLowerCase());
const NETWORK: NetworkName =
  PRODUCT_ENVIRONMENT === 'live'
    ? 'mainnet'
    : CONFIGURED_NETWORK === 'mainnet'
      ? 'devnet'
      : CONFIGURED_NETWORK;

const GENESIS_BY_NETWORK: Record<NetworkName, string> = {
  mainnet: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
  devnet: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
  testnet: '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY',
};

const LABEL_BY_NETWORK: Record<NetworkName, string> = {
  mainnet: 'Mainnet',
  devnet: 'Devnet',
  testnet: 'Testnet',
};

const ADAPTER_BY_NETWORK: Record<NetworkName, WalletAdapterNetwork> = {
  mainnet: WalletAdapterNetwork.Mainnet,
  devnet: WalletAdapterNetwork.Devnet,
  testnet: WalletAdapterNetwork.Testnet,
};

export const SOLANA_NETWORK = NETWORK;
export const EXPECTED_GENESIS = GENESIS_BY_NETWORK[NETWORK];
export const NETWORK_LABEL = LABEL_BY_NETWORK[NETWORK];
export const WALLET_ADAPTER_NETWORK = ADAPTER_BY_NETWORK[NETWORK];
export const RPC_ENDPOINT =
  PRODUCT_ENVIRONMENT === 'live'
    ? 'https://api.mainnet-beta.solana.com'
    : CONFIGURED_NETWORK === 'mainnet'
      ? 'https://api.devnet.solana.com'
      : publicEnv.VITE_RPC_ENDPOINT;
export const RPC_ENDPOINTS = [...new Set([RPC_ENDPOINT])];
export const STELLAR_NETWORK = PRODUCT_ENVIRONMENT === 'live' ? 'mainnet' : 'testnet';
export const STELLAR_HORIZON_URL =
  STELLAR_NETWORK === 'mainnet'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org';
export const STELLAR_NETWORK_PASSPHRASE =
  STELLAR_NETWORK === 'mainnet'
    ? 'Public Global Stellar Network ; September 2015'
    : 'Test SDF Network ; September 2015';
// Soroban contract calls (simulate/send) go through the RPC endpoint, not
// Horizon — Horizon serves classic-operation history only.
export const STELLAR_SOROBAN_RPC_URL =
  STELLAR_NETWORK === 'mainnet'
    ? 'https://soroban-rpc.mainnet.stellar.org'
    : 'https://soroban-testnet.stellar.org';

/**
 * Chain selection.
 *
 * Distinct from `lib/network.ts`, which selects test or live infrastructure.
 * BRZA is the native Baraza asset. This module models the rail underneath it:
 * Solana first for membership and governance, Stellar for settlement, and Celo
 * as the first visible EVM route. M-Pesa is a phone payment path into BRZA and
 * is intentionally not represented as a blockchain.
 */

export type Chain =
  | 'solana'
  | 'mpesa'
  | 'stellar'
  | 'ethereum'
  | 'base'
  | 'arbitrum'
  | 'optimism'
  | 'polygon'
  | 'bnb'
  | 'celo'
  | 'xdc';

export interface ChainMeta {
  id: Chain;
  label: string;
  short: string;
  railType: string;
  accountLabel: string;
  suggestedWallet: string;
  walletExamples: string;
  accountCta: string;
  testnet: {
    label: string;
    chainId?: number;
    nativeSymbol: string;
    explorerUrl: string;
  };
  currency: {
    code: string;
    symbol: string;
    locale: string;
    decimals: number;
    kesPerUnit: number;
  };
  timeZone: string;
  badgeBg: string;
  badgeText: string;
  enabled: boolean;
  comingSoon?: string;
}

const INTEGRATION_PENDING = 'Integration pending';
const GOVERNANCE_REVIEW = 'Governance review';

// Ethereum, Polygon, and BNB stay blocked until a concrete app/client path is
// selected. Base, Arbitrum, Optimism, and Celo are selectable for planning and
// persistence, with real execution gated by contract review.
export const CHAINS: Record<Chain, ChainMeta> = {
  solana: {
    id: 'solana',
    label: 'Solana',
    short: 'SOL',
    railType: 'Primary rail',
    accountLabel: 'Solana account',
    suggestedWallet: 'Phantom',
    walletExamples: 'Phantom, Solflare, or Coinbase Wallet',
    accountCta: 'Connect Solana account with Phantom',
    testnet: {
      label: 'Solana Devnet',
      nativeSymbol: 'SOL',
      explorerUrl: 'https://explorer.solana.com/?cluster=devnet',
    },
    currency: {
      code: 'BRZA',
      symbol: 'BRZA',
      locale: 'en-KE',
      decimals: 2,
      kesPerUnit: 2.6,
    },
    timeZone: 'America/Los_Angeles',
    badgeBg: '#14F195',
    badgeText: '#0B132B',
    enabled: true,
  },
  mpesa: {
    id: 'mpesa',
    label: 'M-Pesa',
    short: 'KSh',
    railType: 'Mobile money onramp',
    accountLabel: 'Wallet account',
    suggestedWallet: 'Phantom',
    walletExamples: 'Phantom, Freighter, Coinbase Wallet, or any supported account wallet',
    accountCta: 'Connect Phantom wallet for M-Pesa onramp',
    testnet: {
      label: 'M-Pesa Sandbox',
      nativeSymbol: 'KES',
      explorerUrl: 'https://developer.safaricom.co.ke',
    },
    currency: {
      code: 'KES',
      symbol: 'KSh',
      locale: 'en-KE',
      decimals: 0,
      kesPerUnit: 1,
    },
    timeZone: 'Africa/Nairobi',
    badgeBg: '#00A651',
    badgeText: '#FFFFFF',
    enabled: true,
  },
  stellar: {
    id: 'stellar',
    label: 'Stellar',
    short: 'XLM',
    railType: 'Settlement rail',
    accountLabel: 'Stellar account',
    suggestedWallet: 'Freighter',
    walletExamples: 'Freighter, Lobstr, or Albedo',
    accountCta: 'Connect Freighter',
    testnet: {
      label: 'Stellar Testnet',
      nativeSymbol: 'XLM',
      explorerUrl: 'https://stellar.expert/explorer/testnet',
    },
    currency: {
      code: 'XLM',
      symbol: 'XLM',
      locale: 'en-US',
      decimals: 2,
      kesPerUnit: 16,
    },
    timeZone: 'UTC',
    badgeBg: '#0066FF',
    badgeText: '#FFFFFF',
    enabled: true,
  },
  ethereum: {
    id: 'ethereum',
    label: 'Ethereum',
    short: 'ETH',
    railType: 'EVM rail',
    accountLabel: 'Ethereum account',
    suggestedWallet: 'MetaMask',
    walletExamples: 'MetaMask, Coinbase Wallet, Rabby, or WalletConnect',
    accountCta: 'Connect MetaMask or EVM account',
    testnet: {
      label: 'Sepolia',
      chainId: 11155111,
      nativeSymbol: 'ETH',
      explorerUrl: 'https://sepolia.etherscan.io',
    },
    currency: {
      code: 'ETH',
      symbol: 'ETH',
      locale: 'en-US',
      decimals: 5,
      kesPerUnit: 450000,
    },
    timeZone: 'UTC',
    badgeBg: '#627EEA',
    badgeText: '#FFFFFF',
    enabled: true,
    comingSoon: GOVERNANCE_REVIEW,
  },
  base: {
    id: 'base',
    label: 'Base',
    short: 'BASE',
    railType: 'EVM rail',
    accountLabel: 'Base account',
    suggestedWallet: 'Coinbase Wallet',
    walletExamples: 'MetaMask, Coinbase Wallet, Rabby, or WalletConnect',
    accountCta: 'Connect Coinbase Wallet or EVM account',
    testnet: {
      label: 'Base Sepolia',
      chainId: 84532,
      nativeSymbol: 'ETH',
      explorerUrl: 'https://sepolia.basescan.org',
    },
    currency: {
      code: 'ETH',
      symbol: 'ETH',
      locale: 'en-US',
      decimals: 5,
      kesPerUnit: 450000,
    },
    timeZone: 'America/Los_Angeles',
    badgeBg: '#0052FF',
    badgeText: '#FFFFFF',
    enabled: true,
    comingSoon: GOVERNANCE_REVIEW,
  },
  arbitrum: {
    id: 'arbitrum',
    label: 'Arbitrum',
    short: 'ARB',
    railType: 'EVM rail',
    accountLabel: 'Arbitrum account',
    suggestedWallet: 'Rabby',
    walletExamples: 'MetaMask, Coinbase Wallet, Rabby, or WalletConnect',
    accountCta: 'Connect Rabby or EVM account',
    testnet: {
      label: 'Arbitrum Sepolia',
      chainId: 421614,
      nativeSymbol: 'ETH',
      explorerUrl: 'https://sepolia.arbiscan.io',
    },
    currency: {
      code: 'ETH',
      symbol: 'ETH',
      locale: 'en-US',
      decimals: 5,
      kesPerUnit: 450000,
    },
    timeZone: 'UTC',
    badgeBg: '#28A0F0',
    badgeText: '#FFFFFF',
    enabled: true,
    comingSoon: GOVERNANCE_REVIEW,
  },
  optimism: {
    id: 'optimism',
    label: 'Optimism',
    short: 'OP',
    railType: 'EVM rail',
    accountLabel: 'Optimism account',
    suggestedWallet: 'MetaMask',
    walletExamples: 'MetaMask, Coinbase Wallet, Rabby, or WalletConnect',
    accountCta: 'Connect MetaMask or EVM account',
    testnet: {
      label: 'OP Sepolia',
      chainId: 11155420,
      nativeSymbol: 'ETH',
      explorerUrl: 'https://sepolia-optimism.etherscan.io',
    },
    currency: {
      code: 'ETH',
      symbol: 'ETH',
      locale: 'en-US',
      decimals: 5,
      kesPerUnit: 450000,
    },
    timeZone: 'UTC',
    badgeBg: '#FF0420',
    badgeText: '#FFFFFF',
    enabled: true,
    comingSoon: GOVERNANCE_REVIEW,
  },
  polygon: {
    id: 'polygon',
    label: 'Polygon',
    short: 'POL',
    railType: 'EVM rail',
    accountLabel: 'Polygon account',
    suggestedWallet: 'MetaMask',
    walletExamples: 'MetaMask, Coinbase Wallet, Rabby, or WalletConnect',
    accountCta: 'Connect MetaMask or EVM account',
    testnet: {
      label: 'Polygon Amoy',
      chainId: 80002,
      nativeSymbol: 'POL',
      explorerUrl: 'https://amoy.polygonscan.com',
    },
    currency: {
      code: 'POL',
      symbol: 'POL',
      locale: 'en-US',
      decimals: 2,
      kesPerUnit: 30,
    },
    timeZone: 'Asia/Kolkata',
    badgeBg: '#8247E5',
    badgeText: '#FFFFFF',
    enabled: true,
    comingSoon: GOVERNANCE_REVIEW,
  },
  bnb: {
    id: 'bnb',
    label: 'BNB Chain',
    short: 'BNB',
    railType: 'EVM rail',
    accountLabel: 'BNB Chain account',
    suggestedWallet: 'Trust Wallet',
    walletExamples: 'MetaMask, Trust Wallet, Binance Wallet, or WalletConnect',
    accountCta: 'Connect Trust Wallet or EVM account',
    testnet: {
      label: 'BNB Smart Chain Testnet',
      chainId: 97,
      nativeSymbol: 'tBNB',
      explorerUrl: 'https://testnet.bscscan.com',
    },
    currency: {
      code: 'tBNB',
      symbol: 'tBNB',
      locale: 'en-US',
      decimals: 5,
      kesPerUnit: 85000,
    },
    timeZone: 'Asia/Singapore',
    badgeBg: '#F3BA2F',
    badgeText: '#0B132B',
    enabled: false,
    comingSoon: INTEGRATION_PENDING,
  },
  celo: {
    // Mobile-first L1, designed for emerging markets. It is the strongest EVM
    // fit for Baraza's chama / SACCO users once EVM app support is wired.
    id: 'celo',
    label: 'Celo',
    short: 'CELO',
    railType: 'EVM rail',
    accountLabel: 'Celo account',
    suggestedWallet: 'Valora',
    walletExamples: 'Valora, MetaMask, Coinbase Wallet, or WalletConnect',
    accountCta: 'Connect Valora or EVM account',
    testnet: {
      label: 'Celo Alfajores',
      chainId: 44787,
      nativeSymbol: 'CELO',
      explorerUrl: 'https://alfajores.celoscan.io',
    },
    currency: {
      code: 'CELO',
      symbol: 'CELO',
      locale: 'en-KE',
      decimals: 2,
      kesPerUnit: 90,
    },
    timeZone: 'Africa/Nairobi',
    badgeBg: '#35D07F',
    badgeText: '#0B132B',
    enabled: true,
    comingSoon: GOVERNANCE_REVIEW,
  },
  xdc: {
    id: 'xdc',
    label: 'XDC',
    short: 'XDC',
    railType: 'EVM rail',
    accountLabel: 'XDC account',
    suggestedWallet: 'MetaMask',
    walletExamples: 'MetaMask, XDC Pay, or WalletConnect',
    accountCta: 'Connect MetaMask or EVM account',
    testnet: {
      label: 'XDC Apothem',
      chainId: 51,
      nativeSymbol: 'TXDC',
      explorerUrl: 'https://apothem.xinfinscan.com',
    },
    currency: {
      code: 'TXDC',
      symbol: 'TXDC',
      locale: 'en-US',
      decimals: 2,
      kesPerUnit: 8,
    },
    timeZone: 'UTC',
    badgeBg: '#2A6DF4',
    badgeText: '#FFFFFF',
    enabled: false,
    comingSoon: 'G$ ecosystem review',
  },
};

export const CHAIN_LIST: ChainMeta[] = [
  CHAINS.solana,
  CHAINS.mpesa,
  CHAINS.stellar,
  CHAINS.ethereum,
  CHAINS.base,
  CHAINS.arbitrum,
  CHAINS.optimism,
  CHAINS.polygon,
  CHAINS.bnb,
  CHAINS.celo,
  CHAINS.xdc,
];

// Keep roadmap metadata available to internal review surfaces without exposing
// placeholder rails in normal product pickers.
export const VISIBLE_CHAIN_LIST: ChainMeta[] = [
  CHAINS.solana,
  CHAINS.mpesa,
  CHAINS.stellar,
  CHAINS.celo,
];

const STORAGE_KEY = 'baraza:chain';
// Stellar is the only chain with contracts actually live and initialized on
// testnet today (see contracts/stellar/addresses/testnet.json). Solana's
// Anchor program is written but not deployed to devnet, so defaulting new
// users there means every community creation silently falls back to
// off-chain/record-only with no visible indication. Default to the chain
// that genuinely works; solana remains selectable once its devnet deploy
// lands.
const DEFAULT_CHAIN: Chain = 'stellar';
const VISIBLE_CHAIN_IDS = new Set<Chain>(VISIBLE_CHAIN_LIST.map((chain) => chain.id));

export function readStoredChain(): Chain {
  if (typeof window === 'undefined') return DEFAULT_CHAIN;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (VISIBLE_CHAIN_IDS.has(raw as Chain)) return raw as Chain;
  } catch {
    /* ignore */
  }
  return DEFAULT_CHAIN;
}

export function writeStoredChain(chain: Chain): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, chain);
  } catch {
    /* ignore */
  }
}

import { describe, expect, it } from 'vitest';
import { CHAINS, CHAIN_LIST, VISIBLE_CHAIN_LIST, readStoredChain, writeStoredChain } from '@/lib/chain';
import { CHAIN_NAME_TO_ID } from '@/lib/programs/evmAddresses';

describe('CHAINS metadata', () => {
  it('exposes all supported rail entries', () => {
    for (const id of ['solana', 'mpesa', 'stellar', 'ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'bnb', 'celo', 'xdc'] as const) {
      expect(CHAINS[id]).toBeDefined();
    }
  });

  it('marks supported review rails as enabled', () => {
    for (const id of ['solana', 'mpesa', 'stellar', 'ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'celo'] as const) {
      expect(CHAINS[id].enabled).toBe(true);
    }
    expect(CHAINS.bnb.enabled).toBe(false);
    expect(CHAINS.bnb.comingSoon).toBeTruthy();
    expect(CHAINS.xdc.enabled).toBe(false);
    expect(CHAINS.xdc.comingSoon).toBeTruthy();
  });

  it('uses integration-pending labels for disabled chains', () => {
    expect(CHAINS.bnb.comingSoon).toBe('Integration pending');
  });

  it('marks enabled EVM rails as governance-review gated', () => {
    for (const id of ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'celo'] as const) {
      expect(CHAINS[id].comingSoon).toBe('Governance review');
    }
  });

  it('uses brand-correct badge colors', () => {
    expect(CHAINS.solana.badgeBg.toUpperCase()).toBe('#14F195');
    expect(CHAINS.stellar.badgeBg.toUpperCase()).toBe('#0066FF');
    expect(CHAINS.ethereum.badgeBg.toUpperCase()).toBe('#627EEA');
    expect(CHAINS.base.badgeBg.toUpperCase()).toBe('#0052FF');
    expect(CHAINS.arbitrum.badgeBg.toUpperCase()).toBe('#28A0F0');
    expect(CHAINS.optimism.badgeBg.toUpperCase()).toBe('#FF0420');
    expect(CHAINS.polygon.badgeBg.toUpperCase()).toBe('#8247E5');
    expect(CHAINS.bnb.badgeBg.toUpperCase()).toBe('#F3BA2F');
    expect(CHAINS.celo.badgeBg.toUpperCase()).toBe('#35D07F');
  });

  it('defines a suggested wallet for every chain', () => {
    for (const chain of CHAIN_LIST) {
      expect(chain.railType.length).toBeGreaterThan(0);
      expect(chain.suggestedWallet.length).toBeGreaterThan(0);
      expect(chain.walletExamples).toContain(chain.suggestedWallet);
      expect(chain.accountCta).toContain(chain.suggestedWallet);
    }
  });

  it('keeps the BRZA asset separate from the Solana rail label', () => {
    expect(CHAINS.solana.label).toBe('Solana');
    expect(CHAINS.solana.currency.code).toBe('BRZA');
    expect(CHAINS.celo.railType).toBe('EVM rail');
    expect(CHAINS.mpesa.railType).toBe('Mobile money onramp');
  });

  it('defines testnet metadata for every chain', () => {
    for (const chain of CHAIN_LIST) {
      expect(chain.testnet.label.length).toBeGreaterThan(0);
      expect(chain.testnet.nativeSymbol.length).toBeGreaterThan(0);
      expect(chain.testnet.explorerUrl).toMatch(/^https:\/\//);
      expect(chain.currency.code.length).toBeGreaterThan(0);
      expect(chain.currency.kesPerUnit).toBeGreaterThan(0);
      expect(chain.timeZone.length).toBeGreaterThan(0);
    }

    expect(CHAINS.ethereum.testnet.chainId).toBe(11155111);
    expect(CHAINS.base.testnet.chainId).toBe(84532);
    expect(CHAINS.arbitrum.testnet.chainId).toBe(421614);
    expect(CHAINS.optimism.testnet.chainId).toBe(11155420);
    expect(CHAINS.polygon.testnet.chainId).toBe(80002);
    expect(CHAINS.bnb.testnet.chainId).toBe(97);
    expect(CHAINS.celo.testnet.chainId).toBe(44787);
  });

  it('uses testnet chain IDs for EVM account switching', () => {
    for (const id of ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'bnb', 'celo'] as const) {
      expect(CHAIN_NAME_TO_ID[id]).toBe(CHAINS[id].testnet.chainId);
    }
  });

  it('CHAIN_LIST has all chains in expected order', () => {
    expect(CHAIN_LIST.map((c) => c.id)).toEqual([
      'solana',
      'mpesa',
      'stellar',
      'ethereum',
      'base',
      'arbitrum',
      'optimism',
      'polygon',
      'bnb',
      'celo',
      'xdc',
    ]);
  });

  it('shows only product-ready rails in normal pickers', () => {
    expect(VISIBLE_CHAIN_LIST.map((chain) => chain.id)).toEqual(['solana', 'mpesa', 'stellar', 'celo']);
  });
});

describe('readStoredChain', () => {
  it('returns stellar as default when localStorage is empty', () => {
    expect(readStoredChain()).toBe('stellar');
  });

  it('returns stored solana when set', () => {
    writeStoredChain('solana');
    expect(readStoredChain()).toBe('solana');
  });

  it('returns stored stellar when set', () => {
    writeStoredChain('stellar');
    expect(readStoredChain()).toBe('stellar');
  });

  it('returns stored M-Pesa when set', () => {
    writeStoredChain('mpesa');
    expect(readStoredChain()).toBe('mpesa');
  });

  it('returns stored Celo when set', () => {
    writeStoredChain('celo');
    expect(readStoredChain()).toBe('celo');
  });

  it('falls back to Stellar for hidden roadmap rails', () => {
    writeStoredChain('base');
    expect(readStoredChain()).toBe('stellar');
  });

  it('falls back to stellar when localStorage holds a garbage value', () => {
    window.localStorage.setItem('baraza:chain', 'garbage');
    expect(readStoredChain()).toBe('stellar');
  });

  it('falls back to stellar when localStorage holds an empty string', () => {
    window.localStorage.setItem('baraza:chain', '');
    expect(readStoredChain()).toBe('stellar');
  });
});

describe('writeStoredChain', () => {
  it('persists the chain under the baraza:chain key', () => {
    writeStoredChain('stellar');
    expect(window.localStorage.getItem('baraza:chain')).toBe('stellar');
  });

  it('overwrites a previous value', () => {
    writeStoredChain('solana');
    writeStoredChain('stellar');
    expect(readStoredChain()).toBe('stellar');
  });
});

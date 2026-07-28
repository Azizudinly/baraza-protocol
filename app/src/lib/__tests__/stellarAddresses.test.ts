import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NOT_DEPLOYED,
  getStellarContractAddresses,
  isStellarContractDeployed,
} from '@/lib/programs/stellarAddresses';

// Guards the testnet contract IDs in stellarAddresses.ts against drifting from
// the deploy script's own output. `deploy.sh` writes addresses/testnet.json; the
// app inlines those IDs as build-time defaults. Nothing but this test connects
// the two, and a silent drift means the app calls contracts that aren't the ones
// actually deployed — which fails at runtime, on-chain, in front of a member.
// Reads the real JSON rather than re-declaring the IDs so it fails the moment
// a redeploy updates the file without updating the app.
const ADDRESSES_PATH = resolve(
  __dirname,
  '../../../../contracts/stellar/addresses/testnet.json',
);

interface DeployArtifact {
  network: string;
  deployedAt: string;
  contracts: Record<string, string>;
}

function readDeployedAddresses(): DeployArtifact {
  return JSON.parse(readFileSync(ADDRESSES_PATH, 'utf-8')) as DeployArtifact;
}

// deploy.sh writes snake_case keys; the app uses camelCase fields.
const KEY_MAP = {
  community_registry: 'communityRegistry',
  governance: 'governance',
  membership: 'membership',
  payment_attestation: 'paymentAttestation',
  treasury_vault: 'treasuryVault',
} as const;

describe('Stellar testnet contract addresses', () => {
  it('matches every ID in contracts/stellar/addresses/testnet.json', () => {
    const deployed = readDeployedAddresses();
    const app = getStellarContractAddresses('testnet');

    expect(deployed.network).toBe('testnet');

    for (const [jsonKey, appKey] of Object.entries(KEY_MAP)) {
      const onDisk = deployed.contracts[jsonKey];
      expect(onDisk, `${jsonKey} missing from testnet.json`).toBeTruthy();
      expect(app[appKey], `${appKey} drifted from testnet.json`).toBe(onDisk);
    }
  });

  it('treats every testnet contract as deployed', () => {
    const app = getStellarContractAddresses('testnet');
    for (const appKey of Object.values(KEY_MAP)) {
      expect(isStellarContractDeployed(app[appKey]), `${appKey} should be deployed`).toBe(true);
    }
  });

  it('keeps mainnet undeployed until a real mainnet deploy lands', () => {
    const app = getStellarContractAddresses('mainnet');
    for (const appKey of Object.values(KEY_MAP)) {
      expect(app[appKey], `${appKey} must not carry a mainnet ID`).toBe(NOT_DEPLOYED);
      expect(isStellarContractDeployed(app[appKey])).toBe(false);
    }
  });

  it('uses well-formed Soroban contract strkeys on testnet', () => {
    const app = getStellarContractAddresses('testnet');
    for (const appKey of Object.values(KEY_MAP)) {
      expect(app[appKey], `${appKey} is not a C… contract strkey`).toMatch(/^C[A-Z2-7]{55}$/);
    }
  });
});

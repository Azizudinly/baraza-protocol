export interface PrivyWalletBootstrapInput {
  phone: string;
  communityType: string;
  mode?: 'sandbox' | 'live';
}

export interface PrivyWalletBootstrapResult {
  provider: 'privy';
  mode: 'sandbox' | 'live';
  walletAddress: string;
  embeddedWalletId: string;
  createdAt: string;
}

function pseudoAddress(seed: string): string {
  const bytes = new TextEncoder().encode(seed);
  let value = 0;
  for (const byte of bytes) value = (value * 33 + byte) % 10_000_000;
  return `0x${value.toString(16).padStart(40, '0').slice(0, 40)}`;
}

export async function bootstrapInvisibleWallet(input: PrivyWalletBootstrapInput): Promise<PrivyWalletBootstrapResult> {
  // Caller decides live vs sandbox (e.g. from import.meta.env.VITE_PRIVY_APP_ID
  // in a Vite app). This package never reads env itself so it stays safe to
  // import server-side.
  const mode = input.mode ?? 'sandbox';
  const seed = `${input.phone}:${input.communityType}:${mode}`;

  return {
    provider: 'privy',
    mode,
    walletAddress: pseudoAddress(seed),
    embeddedWalletId: `privy_${seed.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`,
    createdAt: new Date().toISOString(),
  };
}


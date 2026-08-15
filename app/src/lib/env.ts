import { z } from 'zod';

const urlField = z
  .string()
  .trim()
  .url()
  .transform((value) => value.replace(/\/$/, ''));

const optionalUrlField = urlField.optional().catch(undefined);

const envSchema = z.object({
  VITE_SITE_URL: optionalUrlField,
  VITE_SOLANA_NETWORK: z.enum(['devnet', 'testnet', 'mainnet', 'mainnet-beta']).default('devnet'),
  VITE_RPC_ENDPOINT: optionalUrlField,
  VITE_STELLAR_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  VITE_STELLAR_HORIZON_URL: optionalUrlField,
  VITE_STELLAR_NETWORK_PASSPHRASE: z.string().trim().min(1).optional().catch(undefined),
  VITE_WALLETCONNECT_PROJECT_ID: z.string().trim().optional(),
  VITE_SUPABASE_URL: z.string().trim().url().optional().or(z.literal('')),
  VITE_SUPABASE_ANON_KEY: z.string().trim().optional(),
}).transform((env) => {
  const solanaNetwork = env.VITE_SOLANA_NETWORK === 'mainnet' ? 'mainnet-beta' : env.VITE_SOLANA_NETWORK;
  const solanaRpc = solanaNetwork === 'mainnet-beta'
    ? 'https://api.mainnet-beta.solana.com'
    : `https://api.${solanaNetwork}.solana.com`;
  const stellarMainnet = env.VITE_STELLAR_NETWORK === 'mainnet';

  return {
    ...env,
    VITE_SITE_URL: env.VITE_SITE_URL ?? 'https://barazaprotocol.com',
    VITE_RPC_ENDPOINT: env.VITE_RPC_ENDPOINT ?? solanaRpc,
    VITE_STELLAR_HORIZON_URL: env.VITE_STELLAR_HORIZON_URL ??
      (stellarMainnet ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'),
    VITE_STELLAR_NETWORK_PASSPHRASE: env.VITE_STELLAR_NETWORK_PASSPHRASE ??
      (stellarMainnet ? 'Public Global Stellar Network ; September 2015' : 'Test SDF Network ; September 2015'),
  };
});

export type PublicEnv = z.infer<typeof envSchema>;

export function validatePublicEnv(): PublicEnv {
  const result = envSchema.safeParse(import.meta.env);
  if (result.success) {
    const warnings: string[] = [];
    if (!result.data.VITE_WALLETCONNECT_PROJECT_ID) {
      warnings.push('VITE_WALLETCONNECT_PROJECT_ID is not set; mobile wallet deep-link support may be limited.');
    }
    if (!result.data.VITE_SUPABASE_URL || !result.data.VITE_SUPABASE_ANON_KEY) {
      warnings.push('Supabase public env is not set; deployed data persistence will fall back to local/mock data.');
    }
    warnings.forEach((warning) => console.warn(`[baraza env] ${warning}`));
    return result.data;
  }

  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Baraza testnet env is incomplete:\n${details}`);
}

let publicEnv: PublicEnv | undefined;

export function getPublicEnv(): PublicEnv {
  publicEnv ??= validatePublicEnv();
  return publicEnv;
}

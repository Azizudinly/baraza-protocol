import type { WalletContextState } from '@solana/wallet-adapter-react';

export type WalletProofPurpose =
  | 'create-community'
  | 'identity-claim'
  | 'retro-open'
  | 'retro-vote'
  | 'retro-settle';

export async function buildWalletProofHeaders(
  wallet: Pick<WalletContextState, 'publicKey' | 'signMessage'>,
  purpose: WalletProofPurpose,
): Promise<Record<string, string>> {
  const address = wallet.publicKey?.toBase58();
  if (!address) throw new Error('wallet_not_connected');
  if (!wallet.signMessage) throw new Error('wallet_signing_unavailable');

  const message = [
    'Baraza wallet proof',
    `purpose: ${purpose}`,
    `wallet: ${address}`,
    `issuedAt: ${new Date().toISOString()}`,
    `nonce: ${crypto.randomUUID()}`,
  ].join('\n');

  const signature = await wallet.signMessage(new TextEncoder().encode(message));
  return {
    'X-Wallet-Address': address,
    'X-Wallet-Message': encodeURIComponent(message),
    'X-Wallet-Signature': bytesToBase64(signature),
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
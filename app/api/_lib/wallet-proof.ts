import { verify } from 'node:crypto';
import { StrKey } from '@stellar/stellar-base';

const SOLANA_PUBLIC_KEY_LENGTH = 32;
const SOLANA_SIGNATURE_LENGTH = 64;
const MAX_PROOF_AGE_MS = 5 * 60 * 1000;
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export interface WalletProof {
  wallet: string;
  message: string;
  signature: string;
}

export function getWalletProof(req: Request, fallbackWallet?: string | null): WalletProof | null {
  const wallet = req.headers.get('x-wallet-address') ?? fallbackWallet ?? null;
  let message = req.headers.get('x-wallet-message');
  const signature = req.headers.get('x-wallet-signature');
  if (!wallet || !message || !signature) return null;
  if (message.startsWith('base64:')) {
    try {
      message = Buffer.from(message.slice(7), 'base64').toString('utf8');
    } catch {
      // ignore
    }
  } else if (message.includes('%0A') || message.includes('%20') || message.includes('%3A')) {
    try {
      message = decodeURIComponent(message);
    } catch {
      // ignore
    }
  }
  return { wallet, message, signature };
}

export function verifyWalletProof(
  proof: WalletProof | null,
  expectedWallet: string | null | undefined,
  expectedPurpose: string,
): boolean {
  if (!proof || !expectedWallet || proof.wallet !== expectedWallet) return false;

  const parsed = parseProofMessage(proof.message);
  if (!parsed) return false;
  if (parsed.wallet !== expectedWallet || parsed.purpose !== expectedPurpose) return false;
  if (Math.abs(Date.now() - parsed.issuedAt) > MAX_PROOF_AGE_MS) return false;

  let publicKey: Buffer;
  try {
    if (expectedWallet.startsWith('G') && expectedWallet.length === 56) {
      publicKey = Buffer.from(StrKey.decodeEd25519PublicKey(expectedWallet));
    } else {
      publicKey = decodeBase58(expectedWallet);
    }
  } catch {
    return false;
  }

  const signature = Buffer.from(proof.signature, 'base64');
  if (publicKey.length !== SOLANA_PUBLIC_KEY_LENGTH) return false;
  if (signature.length !== SOLANA_SIGNATURE_LENGTH) return false;

  const key = Buffer.concat([ED25519_SPKI_PREFIX, publicKey]);
  return verify(null, Buffer.from(proof.message, 'utf8'), {
    key,
    format: 'der',
    type: 'spki',
  }, signature);
}

function parseProofMessage(message: string): { purpose: string; wallet: string; issuedAt: number } | null {
  const lines = message.split('\n');
  if (lines[0] !== 'Baraza wallet proof') return null;
  const values = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    values.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  }
  const purpose = values.get('purpose');
  const wallet = values.get('wallet');
  const issuedAtRaw = values.get('issuedAt');
  const issuedAt = issuedAtRaw ? Date.parse(issuedAtRaw) : NaN;
  if (!purpose || !wallet || !Number.isFinite(issuedAt)) return null;
  return { purpose, wallet, issuedAt };
}

function decodeBase58(input: string): Buffer {
  const bytes = [0];
  for (const char of input) {
    const value = BASE58_ALPHABET.indexOf(char);
    if (value < 0) return Buffer.alloc(0);
    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of input) {
    if (char !== '1') break;
    bytes.push(0);
  }
  return Buffer.from(bytes.reverse());
}
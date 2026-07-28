export type MpcWalletMethod = 'email' | 'phone';

export interface MpcWalletRequest {
  method: MpcWalletMethod;
  identifier: string;
}

export interface MpcWalletSession {
  id: string;
  method: MpcWalletMethod;
  identifier: string;
  walletAddress: string | null;
  backupComplete: boolean;
  createdAt: string;
}

const STORAGE_KEY = 'baraza.mpcWalletSessions.v1';

function readSessions(): MpcWalletSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSessions(sessions: MpcWalletSession[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function getPrivyAppId(): string {
  return import.meta.env.VITE_PRIVY_APP_ID ?? '';
}

export function isPrivyPhoneAuthEnabled(): boolean {
  return import.meta.env.VITE_PRIVY_PHONE_AUTH_ENABLED !== 'false';
}

export function isMpcWalletConfigured(): boolean {
  return Boolean(getPrivyAppId());
}

export function createMpcWalletSession(input: MpcWalletRequest): MpcWalletSession {
  if (!input.identifier.trim()) {
    throw new Error(`${input.method === 'phone' ? 'Phone number' : 'Email'} is required.`);
  }

  const session: MpcWalletSession = {
    id: `mpc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    method: input.method,
    identifier: input.identifier.trim(),
    walletAddress: null,
    backupComplete: false,
    createdAt: new Date().toISOString(),
  };

  writeSessions([session, ...readSessions()]);
  return session;
}

export function markMpcBackupComplete(sessionId: string, walletAddress?: string): MpcWalletSession | null {
  const sessions = readSessions();
  const index = sessions.findIndex((session) => session.id === sessionId);
  if (index < 0) return null;

  sessions[index] = {
    ...sessions[index],
    walletAddress: walletAddress ?? sessions[index].walletAddress,
    backupComplete: true,
  };
  writeSessions(sessions);
  return sessions[index];
}

export function listMpcWalletSessions(): MpcWalletSession[] {
  return readSessions();
}

export function getMpcRecoveryStatus(identifier: string): {
  configured: boolean;
  hasSession: boolean;
  backupComplete: boolean;
} {
  const session = readSessions().find((item) => item.identifier === identifier);
  return {
    configured: isMpcWalletConfigured(),
    hasSession: Boolean(session),
    backupComplete: Boolean(session?.backupComplete),
  };
}

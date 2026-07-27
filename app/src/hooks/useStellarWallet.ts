import { useCallback, useEffect, useState } from 'react';

/**
 * Freighter's injected API. `signTransaction` is required for Soroban
 * contract calls (see `lib/programs/stellarClient.ts`) — `WalletStatus.tsx`'s
 * local Freighter typing only declared the read-only surface it needed.
 */
export interface FreighterApi {
  isConnected?: () => Promise<boolean> | boolean;
  getPublicKey?: () => Promise<string> | string;
  requestAccess?: () => Promise<string> | string;
  signTransaction?: (
    xdr: string,
    opts?: { networkPassphrase?: string; address?: string },
  ) => Promise<{ signedTxXdr: string; signerAddress?: string }>;
}

declare global {
  interface Window {
    freighterApi?: FreighterApi;
    freighter?: FreighterApi;
  }
}

export interface StellarWalletState {
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<string | null>;
  disconnect: () => void;
  /** Present only once an address is connected — Soroban calls require it. */
  signTransaction: FreighterApi['signTransaction'];
}

/**
 * Shared Stellar/Freighter account hook. Previously this connection state
 * lived only inside `WalletStatus.tsx`'s component state, so nothing else
 * (e.g. `CreateCommunity.tsx`, Soroban contract calls) could read the
 * connected address or request a signature. This hook is the single source
 * of truth going forward; `WalletStatus.tsx` should migrate to it rather
 * than keep its own parallel `stellarAddress` state.
 */
export function useStellarWallet(): StellarWalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const freighter = window.freighterApi ?? window.freighter;
    if (!freighter?.getPublicKey) return;
    let cancelled = false;
    Promise.resolve(freighter.getPublicKey())
      .then((existing) => {
        if (!cancelled && existing) setAddress(existing);
      })
      .catch(() => {
        // Freighter rejects this until the member grants access — not an error state.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async (): Promise<string | null> => {
    const freighter = window.freighterApi ?? window.freighter;
    if (!freighter) {
      setError('Freighter not detected. Install Freighter or use a Stellar-compatible account app.');
      return null;
    }
    setIsConnecting(true);
    setError(null);
    try {
      const newAddress = freighter.requestAccess
        ? await Promise.resolve(freighter.requestAccess())
        : await Promise.resolve(freighter.getPublicKey?.());
      if (!newAddress) {
        setError('Stellar account connection failed. Unlock Freighter and try again.');
        return null;
      }
      setAddress(newAddress);
      return newAddress;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stellar account connection was rejected.');
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setError(null);
  }, []);

  const freighter = window.freighterApi ?? window.freighter;

  return {
    address,
    isConnecting,
    error,
    connect,
    disconnect,
    signTransaction: freighter?.signTransaction,
  };
}

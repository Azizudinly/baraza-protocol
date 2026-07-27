import React, { useState, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useConnection } from '@solana/wallet-adapter-react';
import { Copy, LogOut, Mail, Phone, RefreshCw, ChevronDown, AlertTriangle, ExternalLink, X } from 'lucide-react';
import { truncateAddress } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { EXPECTED_GENESIS, NETWORK_LABEL } from '@/lib/network';
import { useChain } from '@/hooks/useChain';
import { useEvmChain } from '@/hooks/useEvmChain';
import type { Chain } from '@/lib/chain';
// `FreighterApi` + the `Window.freighterApi`/`Window.freighter` global
// augmentation live in useStellarWallet.ts (the shared connection hook) —
// removed the local duplicate here to avoid two conflicting declarations of
// the same global; TypeScript merges the one from that module program-wide.
import {
  clearPhoneAuthSession,
  formatAuthIdentifier,
  getPhoneAuthSession,
  isValidEmail,
  isValidPhone,
  saveEmailSession,
  savePhoneSession,
} from '@/lib/phoneAuth';

const EVM_CHAINS = new Set<Chain>(['ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'celo', 'bnb']);

/** Branded Solana account button + dropdown with disconnect / copy / change account */
const WalletStatus: React.FC = () => {
  const { connected, publicKey, disconnect, connecting, wallet } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const { toast } = useToast();
  const { chain, chainMeta } = useChain();
  const {
    evmAddress,
    isConnecting: isConnectingEvm,
    evmError,
    connectEvm,
    disconnectEvm,
    switchEvmChain,
  } = useEvmChain();
  const [open, setOpen] = useState(false);
  const [networkState, setNetworkState] = useState<'unknown' | 'right' | 'wrong'>('unknown');
  const [stellarAddress, setStellarAddress] = useState<string | null>(null);
  const [isConnectingStellar, setIsConnectingStellar] = useState(false);
  const [stellarError, setStellarError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Phone / email auth (lightweight, no wallet required)
  const [phoneSession, setPhoneSession] = useState(() => getPhoneAuthSession());
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [authTab, setAuthTab] = useState<'phone' | 'email'>('phone');
  const [authError, setAuthError] = useState<string | null>(null);

  // Detect wrong chain by comparing genesis hash. On RPC failure we deliberately
  // stay 'unknown' instead of asserting 'right' — silently treating an unreachable
  // RPC as the correct network is how users end up signing on the wrong chain.
  useEffect(() => {
    if (chain !== 'solana' || !connected) { setNetworkState('unknown'); return; }
    let cancelled = false;
    connection.getGenesisHash().then((hash) => {
      if (cancelled) return;
      setNetworkState(hash === EXPECTED_GENESIS ? 'right' : 'wrong');
    }).catch(() => {
      if (cancelled) return;
      setNetworkState('unknown');
    });
    return () => { cancelled = true; };
  }, [chain, connected, connection]);

  useEffect(() => {
    if (chain !== 'stellar') return;
    const freighter = window.freighterApi ?? window.freighter;
    if (!freighter?.getPublicKey) return;
    let cancelled = false;
    Promise.resolve(freighter.getPublicKey())
      .then((address) => {
        if (!cancelled && address) setStellarAddress(address);
      })
      .catch(() => {
        // Freighter may reject this until the member approves access.
      });
    return () => { cancelled = true; };
  }, [chain]);

  useEffect(() => {
    if (!EVM_CHAINS.has(chain)) return;
    void switchEvmChain(chain);
  }, [chain, switchEvmChain]);

  const wrongChain = chain === 'solana' && networkState === 'wrong';

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCopy = () => {
    const address = chain === 'solana'
      ? publicKey?.toBase58()
    : chain === 'mpesa'
        ? publicKey?.toBase58()
      : chain === 'stellar'
        ? stellarAddress
        : evmAddress;
    if (!address) return;
    void navigator.clipboard.writeText(address);
    toast({ title: 'Address copied!' });
    setOpen(false);
  };

  const handleDisconnect = () => {
    if (chain === 'solana') {
      void disconnect();
    } else if (chain === 'mpesa') {
      void disconnect();
      clearPhoneAuthSession();
      setPhoneSession({ phone: null, email: null });
    } else if (chain === 'stellar') {
      setStellarAddress(null);
      setStellarError(null);
    } else {
      disconnectEvm();
    }
    setOpen(false);
  };

  const handleConnectStellar = async () => {
    const freighter = window.freighterApi ?? window.freighter;
    if (!freighter) {
      setStellarError('Freighter not detected. Install Freighter or use a Stellar-compatible account app.');
      return;
    }
    setIsConnectingStellar(true);
    setStellarError(null);
    try {
      const address = freighter.requestAccess
        ? await Promise.resolve(freighter.requestAccess())
        : await Promise.resolve(freighter.getPublicKey?.());
      if (!address) {
        setStellarError('Stellar account connection failed. Unlock Freighter and try again.');
        return;
      }
      setStellarAddress(address);
    } catch (err) {
      setStellarError(err instanceof Error ? err.message : 'Stellar account connection was rejected.');
    } finally {
      setIsConnectingStellar(false);
    }
  };

  const handleConnect = () => {
    if (chain === 'solana') {
      setVisible(true);
      return;
    }
    if (chain === 'mpesa') {
      setVisible(true);
      return;
    }
    if (chain === 'stellar') {
      void handleConnectStellar();
      return;
    }
    void connectEvm().then(() => switchEvmChain(chain));
  };

  const isConnectingSelected = chain === 'solana'
    ? connecting
    : chain === 'mpesa'
      ? connecting
    : chain === 'stellar'
      ? isConnectingStellar
      : isConnectingEvm;

  const selectedAddress = chain === 'solana'
    ? publicKey?.toBase58() ?? null
    : chain === 'mpesa'
      ? publicKey?.toBase58() ?? null
    : chain === 'stellar'
      ? stellarAddress
      : evmAddress;

  if (isConnectingSelected) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/20 text-primary text-sm font-semibold opacity-70 cursor-not-allowed"
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        Connecting...
      </button>
    );
  }

  const handleSavePhone = () => {
    if (authTab === 'phone') {
      if (!isValidPhone(phoneInput)) { setAuthError('Enter a valid phone number (e.g. +254712345678 or 0712345678)'); return; }
      savePhoneSession(phoneInput);
    } else {
      if (!isValidEmail(emailInput)) { setAuthError('Enter a valid email address'); return; }
      saveEmailSession(emailInput);
    }
    setPhoneSession(getPhoneAuthSession());
    setShowPhoneModal(false);
    setPhoneInput('');
    setEmailInput('');
    setAuthError(null);
    toast({ title: authTab === 'phone' ? 'Phone connected' : 'Email connected', description: 'You can now interact with Baraza using M-Pesa flows.' });
  };

  const phoneIdentifier = formatAuthIdentifier(phoneSession);

  // If phone/email is connected but no wallet, show phone identity instead.
  if (!selectedAddress && phoneIdentifier && chain !== 'mpesa') {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/50"
        >
          {phoneSession.phone ? <Phone className="h-3.5 w-3.5 text-primary" /> : <Mail className="h-3.5 w-3.5 text-primary" />}
          {phoneIdentifier}
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-2 w-52 baraza-card py-1 animate-fade-in">
            {/* chain !== 'mpesa' is guaranteed by the enclosing guard */}
            <button
              onClick={handleConnect}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-surface"
            >
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              Also connect account
            </button>
            <div className="my-1 border-t border-border/50" />
            <button
              onClick={() => { clearPhoneAuthSession(); setPhoneSession({ phone: null, email: null }); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!selectedAddress) {
    return (
      <div className="relative" ref={ref}>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleConnect}
            className="rounded-md bg-secondary px-6 py-2.5 text-sm font-bold text-secondary-foreground transition-colors hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            {chainMeta.accountCta}
          </button>
          <p className="hidden text-[10px] font-semibold text-muted-foreground lg:block">
            {chain === 'mpesa'
              ? 'Wallet required for M-Pesa onramp'
              : chainMeta.suggestedWallet}
          </p>
          <button
            type="button"
            onClick={() => { setShowPhoneModal(true); setAuthError(null); }}
            className="hidden items-center gap-1 text-[10px] font-semibold text-primary underline-offset-2 hover:underline lg:flex"
          >
            <Phone className="h-2.5 w-2.5" />
            Add M-Pesa phone / email
          </button>
        </div>

        {(stellarError || evmError) && (
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-destructive/30 bg-card p-3 text-xs leading-5 text-destructive shadow-[var(--shadow-deep)]">
            {stellarError ?? evmError}
          </div>
        )}

        {/* Phone / Email modal */}
        {showPhoneModal && (
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-deep)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold">
                {chain === 'mpesa' ? 'Add M-Pesa onramp contact' : 'Connect with phone or email'}
              </p>
              <button type="button" onClick={() => setShowPhoneModal(false)} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-[11px] leading-4 text-muted-foreground">
              {chain === 'mpesa'
                ? 'Use your M-Pesa phone number for KES payments after a wallet is connected for membership and voting.'
                : 'Use your phone number for M-Pesa or email to identify yourself before account setup.'}
            </p>

            {/* Tab switcher */}
            {chain !== 'mpesa' && <div className="mb-3 flex rounded-lg border border-border/60 p-0.5">
              {(['phone', 'email'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setAuthTab(tab); setAuthError(null); }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors ${authTab === tab ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {tab === 'phone' ? <Phone className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                  {tab === 'phone' ? 'Phone' : 'Email'}
                </button>
              ))}
            </div>}

            {authTab === 'phone' ? (
              <input
                value={phoneInput}
                onChange={(e) => { setPhoneInput(e.target.value); setAuthError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSavePhone()}
                placeholder="+254712345678 or 0712345678"
                className="w-full rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50"
                autoFocus
              />
            ) : (
              <input
                value={emailInput}
                onChange={(e) => { setEmailInput(e.target.value); setAuthError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSavePhone()}
                placeholder="you@example.com"
                type="email"
                className="w-full rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50"
                autoFocus
              />
            )}

            {authError && <p className="mt-1.5 text-[11px] text-destructive">{authError}</p>}

            <button
              type="button"
              onClick={handleSavePhone}
              className="mt-2.5 w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {chain === 'mpesa' ? 'Save M-Pesa contact' : 'Save contact'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      {wrongChain && (
        <div className="absolute -top-8 right-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/15 border border-destructive/30 text-destructive text-[11px] font-medium">
          <AlertTriangle className="w-3 h-3" />
          Wrong Baraza network setup - switch to {NETWORK_LABEL}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-all ${
          wrongChain
            ? 'bg-destructive/10 border-destructive/40 text-destructive'
            : 'bg-surface border-border hover:border-primary/50 text-foreground'
        }`}
      >
        {chain === 'solana' && wallet?.adapter.icon && (
          <img
            src={wallet.adapter.icon}
            alt={wallet.adapter.name}
            className="w-4 h-4 rounded-sm"
          />
        )}
        {chain !== 'solana' && (
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ background: chainMeta.badgeBg }}
          />
        )}
        {truncateAddress(selectedAddress)}
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 baraza-card py-1 z-50 animate-fade-in">
          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-surface transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            Copy address
          </button>
          <button
            onClick={() => {
              if (chain === 'solana') setVisible(true);
              else handleConnect();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-surface transition-colors"
          >
            {chain === 'stellar' ? <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" /> : <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />}
            Switch account
          </button>
          <div className="border-t border-border/50 my-1" />
          <button
            onClick={handleDisconnect}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Disconnect account
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletStatus;

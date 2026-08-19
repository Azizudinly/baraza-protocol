import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletModalContext } from "@solana/wallet-adapter-react-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Promoted wallets match the registered adapters in WalletProviders.tsx.
// To re-add Backpack, Ledger, or Trezor, first install & register their adapter packages in WalletProviders.tsx.
const PREFERRED_WALLETS = ["Phantom", "Solflare", "Coinbase Wallet"];

interface BarazaWalletModalProviderProps {
  children: React.ReactNode;
}

function readyStateLabel(readyState: WalletReadyState): string {
  if (readyState === WalletReadyState.Installed) return "Detected";
  if (readyState === WalletReadyState.Loadable) return "Available";
  if (readyState === WalletReadyState.NotDetected) return "Install";
  return "Unsupported";
}

export default function BarazaWalletModalProvider({ children }: BarazaWalletModalProviderProps) {
  const { wallets, select, connect, wallet, connecting } = useWallet();
  const [visible, setVisible] = useState(false);
  const [pendingConnectWallet, setPendingConnectWallet] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const visibleWallets = useMemo(
    () =>
      wallets
        .sort((a, b) => {
          const aInstalled = a.readyState === WalletReadyState.Installed ? 0 : 1;
          const bInstalled = b.readyState === WalletReadyState.Installed ? 0 : 1;
          const aPreferred = PREFERRED_WALLETS.includes(a.adapter.name)
            ? PREFERRED_WALLETS.indexOf(a.adapter.name)
            : PREFERRED_WALLETS.length;
          const bPreferred = PREFERRED_WALLETS.includes(b.adapter.name)
            ? PREFERRED_WALLETS.indexOf(b.adapter.name)
            : PREFERRED_WALLETS.length;

          return aInstalled - bInstalled || aPreferred - bPreferred || a.adapter.name.localeCompare(b.adapter.name);
        }),
    [wallets]
  );

  const close = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!pendingConnectWallet || connecting || wallet?.adapter.name !== pendingConnectWallet) return;

    let cancelled = false;
    connect()
      .catch((error) => {
        if (!cancelled) console.error('[Wallet Connect Error]', error instanceof Error ? error.message : error);
      })
      .finally(() => {
        if (!cancelled) setPendingConnectWallet(null);
      });

    return () => {
      cancelled = true;
    };
  }, [connect, connecting, pendingConnectWallet, wallet]);

  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }

      if (event.key !== "Tab" || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll<HTMLButtonElement>("button");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => modalRef.current?.querySelector<HTMLButtonElement>("button")?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, visible]);

  return (
    <WalletModalContext.Provider value={{ visible, setVisible }}>
      {children}

      {visible && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="baraza-wallet-modal-title"
            className="relative w-full max-w-sm rounded-xl bg-card p-5 shadow-2xl"
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close account selector"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 id="baraza-wallet-modal-title" className="mx-auto mt-8 max-w-xs text-center font-display text-xl font-bold leading-snug">
              Connect your Baraza account to continue
            </h2>
            <p className="mx-auto mt-3 max-w-xs text-center text-sm leading-6">
              Use Phantom, Solflare, or Coinbase Wallet for Baraza actions.
            </p>

            <div className="mt-7 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {visibleWallets.map((wallet) => {
                const unsupported = wallet.readyState === WalletReadyState.Unsupported;
                return (
                  <button
                    key={wallet.adapter.name}
                    type="button"
                    disabled={unsupported}
                    onClick={() => {
                      select(wallet.adapter.name);
                      setPendingConnectWallet(wallet.adapter.name);
                      close();
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2",
                      unsupported ? "cursor-not-allowed opacity-50" : ""
                    )}
                  >
                    <img src={wallet.adapter.icon} alt="" className="h-7 w-7 rounded-md" />
                    <span className="min-w-0 flex-1 font-semibold">{wallet.adapter.name}</span>
                    <span className="text-xs font-medium">{readyStateLabel(wallet.readyState)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </WalletModalContext.Provider>
  );
}

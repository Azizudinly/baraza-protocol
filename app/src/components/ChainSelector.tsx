import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { VISIBLE_CHAIN_LIST, type Chain } from '@/lib/chain';
import { useChain } from '@/hooks/useChain';
import { cn } from '@/lib/utils';

const CHAIN_LOGOS: Partial<Record<Chain, { src: string; invertOnDark?: boolean }>> = {
  solana: { src: '/logos/solana.svg' },
  mpesa: { src: '/logos/mpesa.svg' },
  stellar: { src: '/logos/stellar.svg', invertOnDark: true },
  celo: { src: '/logos/celo.svg' },
};

interface ChainSelectorProps {
  variant?: 'desktop' | 'mobile';
  side?: 'bottom' | 'left';
  className?: string;
}

export default function ChainSelector({ variant = 'desktop', side = 'bottom', className }: ChainSelectorProps) {
  const { chain, chainMeta, setChain } = useChain();
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) {
      setFocusedIndex(-1);
      return;
    }
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const direction = e.key === 'ArrowDown' ? 1 : -1;
          const len = VISIBLE_CHAIN_LIST.length;
          // Skip disabled entries — keep advancing in the same direction.
          for (let step = 1; step <= len; step++) {
            const next = (prev + direction * step + len) % len;
            if (VISIBLE_CHAIN_LIST[next].enabled) return next;
          }
          return prev;
        });
      }
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Move DOM focus to the focused option when the index changes.
  useEffect(() => {
    if (focusedIndex >= 0) {
      optionRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  const handleSelect = (next: Chain) => {
    setChain(next);
    setOpen(false);
  };

  const isMobile = variant === 'mobile';

  return (
    <div className={cn('relative', isMobile && 'w-full', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Funding rail: ${chainMeta.label} selected. Click to switch.`}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface text-xs font-semibold text-foreground transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
          isMobile ? 'w-full justify-between px-3.5 py-3 text-sm' : 'px-3 py-2',
        )}
      >
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ background: chainMeta.badgeBg }}
          />
          <span className="font-bold text-primary">Fund</span>
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Select funding rail"
          className={cn(
            'absolute z-50 overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-[0_24px_60px_hsl(84_17%_2%/0.6)] backdrop-blur',
            side === 'left'
              ? 'right-full top-0 mr-2 w-72'
              : isMobile
                ? 'left-0 right-0 top-full mt-2'
                : 'right-0 top-full mt-2 w-72',
          )}
        >
          {VISIBLE_CHAIN_LIST.map((meta, index) => {
            const active = meta.id === chain;
            const disabled = !meta.enabled;
            return (
              <li key={meta.id}>
                <button
                  type="button"
                  role="option"
                  aria-label={disabled && meta.comingSoon ? `${meta.label} ${meta.comingSoon}` : meta.label}
                  ref={(el) => { optionRefs.current[index] = el; }}
                  aria-selected={active}
                  disabled={disabled}
                  onClick={() => !disabled && handleSelect(meta.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!disabled) handleSelect(meta.id);
                    }
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                    disabled
                      ? 'cursor-not-allowed text-muted-foreground/60'
                      : 'text-foreground hover:bg-surface',
                  )}
                  title={disabled ? meta.comingSoon : undefined}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2 w-2 rounded-full"
                      style={{ background: meta.badgeBg }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{meta.label}</span>
                      <span className="block truncate text-[11px] font-semibold text-primary">
                        {meta.id === 'mpesa' ? 'KES onramp into wallet' : `${meta.railType} wallet`}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        Suggested: {meta.suggestedWallet}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground/80">
                        Testnet: {meta.testnet.label}
                      </span>
                    </span>
                  </span>
                  {disabled ? (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                      {meta.comingSoon}
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-2">
                      {active ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> : null}
                      {CHAIN_LOGOS[meta.id] ? (
                        <img
                          src={CHAIN_LOGOS[meta.id]!.src}
                          alt=""
                          className={cn(
                            'h-6 w-auto max-w-[2.75rem] object-contain',
                            CHAIN_LOGOS[meta.id]!.invertOnDark && 'dark:invert',
                          )}
                        />
                      ) : null}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

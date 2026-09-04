import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CircleUserRound,
  LogIn,
  LogOut,
  Menu,
  Moon,
  PlusCircle,
  Sun,
  UserPlus,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import ChainSelector from "@/components/ChainSelector";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { useAccount } from "@/contexts/AccountContext";

const navLinks = [
  { label: "Groups", to: "/communities" },
  { label: "How It Works", to: "/#how-it-works", hash: "how-it-works" },
  { label: "Features", to: "/#features", hash: "features" },
  { label: "FAQ", to: "/#faq", hash: "faq" },
] as const;

function isAppRoute(pathname: string) {
  return (
    pathname.startsWith("/create") ||
    pathname.startsWith("/join") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/dao") ||
    pathname.startsWith("/profile")
  );
}

function isLinkActive(pathname: string, hash: string, link: (typeof navLinks)[number]) {
  if ("hash" in link && link.hash) return pathname === "/" && hash === `#${link.hash}`;
  return pathname === link.to || pathname.startsWith(`${link.to}/`);
}

function ProfileMenu({
  displayName,
  onLogout,
  showFund,
}: {
  displayName: string;
  onLogout: () => void;
  showFund: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="btn-icon h-10 w-10"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <CircleUserRound className="h-5 w-5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 overflow-visible rounded-xl border border-border bg-card py-2 shadow-lg"
        >
          <p className="truncate px-3 pb-2 text-xs text-muted-foreground" title={displayName}>
            {displayName}
          </p>
          <div className="border-t border-border pt-1">
            <Link
              role="menuitem"
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-surface"
            >
              <CircleUserRound className="h-4 w-4 text-primary" />
              Account
            </Link>
            <Link
              role="menuitem"
              to="/create/purpose"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-surface"
            >
              <PlusCircle className="h-4 w-4 text-primary" />
              Launch a Group
            </Link>
            {showFund && (
              <div className="border-t border-border px-3 py-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Fund
                </p>
                <ChainSelector variant="mobile" side="left" />
              </div>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-surface"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const account = useAccount();
  const showChain = account.authenticated || isAppRoute(location.pathname);

  const handleSignIn = () => {
    if (account.configured) {
      account.login();
      return;
    }
    navigate("/profile");
  };

  const handleSignUp = () => {
    if (account.configured) {
      account.createAccount();
      return;
    }
    navigate("/profile");
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.hash]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background">
      <div className="page-shell grid h-16 grid-cols-[1fr_auto] items-center gap-4 xl:grid-cols-[1fr_auto_1fr]">
        <Link to="/" className="justify-self-start" aria-label="Baraza Protocol home">
          <BrandLogo size="sm" showIcon={false} lockup="protocol" />
        </Link>

        <nav className="hidden items-center gap-7 xl:flex" aria-label="Main navigation">
          {navLinks.map((link) => {
            const active = isLinkActive(location.pathname, location.hash, link);
            return (
              <Link
                key={link.label}
                to={link.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative py-1 text-sm font-semibold transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
                {active && <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-self-end gap-2">
          <Button
            type="button"
            variant="icon"
            size="icon"
            onClick={toggleTheme}
            className="hidden sm:inline-flex"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {account.authenticated ? (
            <div className="hidden xl:block">
              <ProfileMenu
                displayName={account.displayName}
                onLogout={() => void account.logout()}
                showFund={showChain}
              />
            </div>
          ) : (
            <div className="hidden items-center gap-2 xl:flex">
              <Button type="button" variant="outline" onClick={handleSignIn} disabled={!account.ready}>
                Sign In
              </Button>
              <Button type="button" onClick={handleSignUp} disabled={!account.ready}>
                Sign Up
              </Button>
            </div>
          )}

          <Button
            type="button"
            variant="icon"
            size="icon"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="xl:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-background xl:hidden">
          <nav className="page-shell flex flex-col gap-1 py-4" aria-label="Site menu">
            {navLinks.map((link) => (
              <Link key={link.label} to={link.to} className="rounded-md px-3 py-2.5 text-sm font-semibold">
                {link.label}
              </Link>
            ))}

            <div className="my-2 border-t border-border" />

            {account.authenticated ? (
              <>
                <p className="truncate px-3 pb-1 text-xs text-muted-foreground">{account.displayName}</p>
                <Link to="/profile" className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold">
                  <CircleUserRound className="h-4 w-4 text-primary" />
                  Account
                </Link>
                <Link to="/create/purpose" className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold">
                  <PlusCircle className="h-4 w-4 text-primary" />
                  Launch a Group
                </Link>
                {showChain && (
                  <div className="px-3 py-2">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Fund
                    </p>
                    <ChainSelector variant="mobile" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void account.logout()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-left text-sm font-semibold"
                >
                  <LogOut className="h-4 w-4" />
                  Log Out
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 px-3 pt-1">
                <Button type="button" variant="outline" onClick={handleSignIn} disabled={!account.ready}>
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Button>
                <Button type="button" onClick={handleSignUp} disabled={!account.ready}>
                  <UserPlus className="h-4 w-4" />
                  Sign Up
                </Button>
              </div>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-semibold"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

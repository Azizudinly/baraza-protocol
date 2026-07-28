import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CircleUserRound, LogIn, Menu, Moon, MoreHorizontal, PlayCircle, Search, Sparkles, Sun, UserPlus, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import ChainSelector from "@/components/ChainSelector";
import { useAkiliChat } from "@/akili/useAkiliChat";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { useAccount } from "@/contexts/AccountContext";

const navLinks = [
  { path: "/", label: "Home" },
  { path: "/communities", label: "Explore" },
  { path: "/bounties", label: "Bounties" },
  { path: "/evaluate", label: "Evaluate" },
  { path: "/create/purpose", label: "Launch" },
  { path: "/profile", label: "Profile" },
];

const primaryNavLinks = navLinks.filter((link) => ["/", "/communities", "/create/purpose"].includes(link.path));
const overflowNavLinks = navLinks.filter((link) => !primaryNavLinks.includes(link));

const quickSearches = ["DAO", "SACCO", "co-operative", "governance", "savings"];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { open: openAkili } = useAkiliChat();
  const { theme, toggleTheme } = useTheme();
  const account = useAccount();

  const handleLogin = () => {
    if (account.configured) {
      account.login();
      return;
    }
    navigate("/profile");
  };

  const handleCreateAccount = () => {
    if (account.configured) {
      account.createAccount();
      return;
    }
    navigate("/profile");
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
  }, [location.pathname]);

  const submitSearch = (value = query) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setSearchOpen(false);
      return;
    }
    navigate(`/communities?q=${encodeURIComponent(trimmed)}`);
    setSearchOpen(false);
    setMobileOpen(false);
  };

  const openTutorial = () => {
    navigate("/#flow-walkthrough");
    setMobileOpen(false);
    window.setTimeout(() => {
      document.getElementById("flow-walkthrough")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const openAiGuide = () => {
    openAkili("Help me use Baraza for my DAO");
    setMobileOpen(false);
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300",
        scrolled
          ? "border-border/60 bg-background/88 shadow-[0_2px_20px_hsl(84_17%_2%/0.55)] backdrop-blur-xl"
          : "border-border/35 bg-background/82 backdrop-blur-xl",
      )}
    >
      <div className="flex h-14 w-full items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-5">
          <Link to="/" className="flex shrink-0 items-center" aria-label="Baraza home">
            <BrandLogo size="sm" />
          </Link>

          <nav className="hidden items-center gap-4 md:flex" aria-label="Main navigation">
            {primaryNavLinks.map((link) => {
              const isActive =
                location.pathname === link.path ||
                (link.path !== "/" && location.pathname.startsWith(link.path));
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative py-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                    isActive
                      ? "text-foreground"
                      : "text-foreground/80 hover:text-foreground",
                  )}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
            <div className="hidden items-center gap-4 2xl:flex">
              {overflowNavLinks.map((link) => {
                const isActive =
                  location.pathname === link.path ||
                  (link.path !== "/" && location.pathname.startsWith(link.path));
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative py-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                      isActive
                        ? "text-foreground"
                        : "text-foreground/80 hover:text-foreground",
                    )}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-primary" />
                    )}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={openTutorial}
                className="inline-flex items-center gap-1.5 py-1 text-sm font-semibold text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                <PlayCircle className="h-4 w-4" />
                Tutorial
              </button>
              <button
                type="button"
                onClick={openAiGuide}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                <Sparkles className="h-4 w-4" />
                AI Guide
              </button>
            </div>
          </nav>
        </div>

        <div className="relative flex shrink-0 items-center gap-2">
          <ChainSelector variant="desktop" className="hidden md:block" />
          <div className="hidden items-center gap-2 lg:flex">
            {account.authenticated ? (
              <Link
                to="/profile"
                className="inline-flex h-10 max-w-44 items-center gap-2 rounded-md border border-primary/35 bg-primary/10 px-3 text-sm font-semibold text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                <CircleUserRound className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{account.displayName}</span>
              </Link>
            ) : (
              <>
                <span className="hidden text-xs font-semibold text-muted-foreground xl:inline">Privy</span>
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={!account.ready}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/55 hover:bg-surface disabled:cursor-wait disabled:opacity-60"
                >
                  <LogIn className="h-4 w-4" />
                  Log in
                </button>
                <button
                  type="button"
                  onClick={handleCreateAccount}
                  disabled={!account.ready}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
                >
                  <UserPlus className="h-4 w-4" />
                  Get started
                </button>
              </>
            )}
          </div>

          {!account.authenticated && (
            <button
              type="button"
              onClick={handleCreateAccount}
              disabled={!account.ready}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60 lg:hidden"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Get started</span>
              <span className="sm:hidden">Join</span>
            </button>
          )}

          <div className="relative hidden md:block 2xl:hidden">
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border/70 bg-surface/70 px-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              aria-expanded={moreOpen}
              aria-controls="header-more-menu"
            >
              <MoreHorizontal className="h-4 w-4" />
              More
            </button>

            {moreOpen && (
              <div
                id="header-more-menu"
                className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-xl border border-border/70 bg-card p-2 shadow-[var(--shadow-deep)]"
              >
                {overflowNavLinks.map((link) => {
                  const isActive =
                    location.pathname === link.path ||
                    (link.path !== "/" && location.pathname.startsWith(link.path));
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "block rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                        isActive
                          ? "bg-primary/10 text-foreground"
                          : "text-foreground/80 hover:bg-surface hover:text-foreground",
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
                <div className="my-1 border-t border-border/50" />
                <button
                  type="button"
                  onClick={openTutorial}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-foreground/80 transition-colors hover:bg-surface hover:text-foreground"
                >
                  <PlayCircle className="h-4 w-4" />
                  Tutorial
                </button>
                <button
                  type="button"
                  onClick={openAiGuide}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  <Sparkles className="h-4 w-4" />
                  AI Guide
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            className="hidden h-10 w-10 items-center justify-center rounded-md border border-border/70 bg-surface/70 text-muted-foreground transition-colors hover:border-primary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 lg:inline-flex"
            aria-expanded={searchOpen}
            aria-controls="header-search-panel"
            aria-label="Search Baraza"
            title="Search Baraza"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="hidden h-10 w-10 items-center justify-center rounded-md border border-border/70 bg-surface/70 text-foreground transition-colors hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 sm:inline-flex"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div
          id="header-search-panel"
          className="absolute right-4 top-[calc(100%+0.5rem)] z-50 hidden w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-border/70 bg-card p-3 shadow-[var(--shadow-deep)] lg:block"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
          >
            <label className="sr-only" htmlFor="global-search">Search Baraza</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="global-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search communities, SACCOs, M-Pesa..."
                className="w-full rounded-lg border border-border bg-background/70 py-3 pl-10 pr-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                autoFocus
              />
            </div>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {quickSearches.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => submitSearch(term)}
                className="rounded-full border border-border/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {mobileOpen && (
        <div className="animate-fade-in border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden">
          <nav className="container mx-auto flex flex-col gap-1 px-4 py-4" aria-label="Mobile navigation">
            <div className="mb-3 border-b border-border/60 pb-4">
              {account.authenticated ? (
                <Link
                  to="/profile"
                  className="inline-flex min-h-11 w-full items-center gap-2 rounded-md bg-primary/10 px-3 text-sm font-semibold text-foreground"
                >
                  <CircleUserRound className="h-4 w-4 text-primary" />
                  {account.displayName}
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={!account.ready}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-background text-sm font-semibold text-foreground disabled:cursor-wait disabled:opacity-60"
                  >
                    <LogIn className="h-4 w-4" />
                    Log in
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateAccount}
                    disabled={!account.ready}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-primary-foreground disabled:cursor-wait disabled:opacity-60"
                  >
                    <UserPlus className="h-4 w-4" />
                    Get started
                  </button>
                  <p className="col-span-2 mt-1 text-xs leading-5 text-muted-foreground">
                    Continue with your phone number or email.
                  </p>
                </div>
              )}
            </div>
            <div className="mb-3 border-b border-border/60 pb-4">
              <ChainSelector variant="mobile" />
            </div>
            {navLinks.map((link) => {
              const isActive =
                location.pathname === link.path ||
                (link.path !== "/" && location.pathname.startsWith(link.path));
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                    isActive
                      ? "bg-primary/10 text-foreground"
                      : "text-foreground/80 hover:bg-surface hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={openTutorial}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-semibold text-foreground/80 transition-all hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <PlayCircle className="h-4 w-4" />
              Video tutorial
            </button>
            <button
              type="button"
              onClick={openAiGuide}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-semibold text-primary transition-all hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <Sparkles className="h-4 w-4" />
              Ask Akili
            </button>
            <form
              className="relative mt-2"
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch();
              }}
            >
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search communities"
                className="w-full rounded-lg border border-border bg-background/70 py-3 pl-10 pr-3 text-sm text-foreground outline-none focus:border-primary"
                aria-label="Search communities"
              />
            </form>
            <div className="mt-2 flex flex-col gap-2 border-t border-border/50 pt-3">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-semibold text-foreground/80 transition-all hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

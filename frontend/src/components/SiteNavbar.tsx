"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Compass,
  Languages,
  LifeBuoy,
  Menu,
  Moon,
  Search,
  Shield,
  Sun,
  UserPlus,
  X,
  ChevronDown,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { usePreferences, useTranslate } from "@/components/PreferencesProvider";
import { CommandPalette } from "@/components/CommandPalette";
import { ExploreOverlay } from "@/components/ExploreOverlay";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export interface NavItemConfig {
  id: string;
  labelKey: string;
  href: string;
  priority: number;
  roles?: ("operator" | "admin" | "volunteer")[];
  action?: "palette" | "explore" | "emergency";
  isExternal?: boolean;
}

export const PRIMARY_NAV_ITEMS: NavItemConfig[] = [
  { id: "how-it-works", labelKey: "nav.howItWorks", href: "#how-it-works", priority: 1 },
  { id: "features", labelKey: "nav.features", href: "#features", priority: 2 },
  { id: "zones", labelKey: "nav.zones", href: "#zones", priority: 3 },
  { id: "safety", labelKey: "nav.safety", href: "#safety", priority: 4 },
];

export const SECONDARY_NAV_ITEMS: NavItemConfig[] = [
  { id: "pre-register", labelKey: "nav.register", href: "/register", priority: 5 },
  { id: "explore", labelKey: "nav.explore", href: "#explore", priority: 6, action: "explore" },
  { id: "ops-dashboard", labelKey: "nav.opsDashboard", href: "/reports", priority: 7, roles: ["operator", "admin"] },
];

export function SiteNavbar({ onEmergency }: { onEmergency: () => void }) {
  const t = useTranslate();
  const { prefs, setLocale, resolvedTheme, setTheme } = usePreferences();

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const [authorizedForOps, setAuthorizedForOps] = useState(false);

  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreDropdownRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/auth")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data?.authenticated && data?.user?.role) {
          const role = data.user.role;
          setAuthorizedForOps(role === "operator" || role === "admin");
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) setActiveSection(hash);
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    const sectionIds = ["how-it-works", "features", "zones", "safety"];
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => {
      window.removeEventListener("hashchange", handleHash);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setExploreOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && focusable.length > 0) {
        focusable[0]?.focus();
      }
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (moreOpen) {
          setMoreOpen(false);
          moreButtonRef.current?.focus();
        }
        if (menuOpen) {
          setMenuOpen(false);
          menuButtonRef.current?.focus();
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        moreOpen &&
        moreDropdownRef.current &&
        !moreDropdownRef.current.contains(e.target as Node) &&
        !moreButtonRef.current?.contains(e.target as Node)
      ) {
        setMoreOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [moreOpen, menuOpen]);

  const handleFlow = useCallback(
    (flow: "find" | "report" | "lost") => {
      if (flow === "lost") {
        onEmergency();
      } else {
        window.dispatchEvent(new CustomEvent("km:flow", { detail: flow }));
      }
    },
    [onEmergency]
  );

  const trapDrawerFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleToggleLanguage = () => {
    setLocale(prefs.locale === "en" ? "hi" : "en");
  };

  const handleToggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const localeBadge =
    prefs.locale === "hi"
      ? "हि"
      : prefs.locale === "mr"
      ? "मर"
      : prefs.locale === "gu"
      ? "ગુ"
      : "EN";

  return (
    <>
      <header className="sticky top-0 z-50 w-full px-2 pt-2 sm:px-4 md:px-6 md:pt-3">
        <div
          className={cn(
            "mx-auto flex h-14 md:h-16 max-w-[1240px] items-center justify-between rounded-2xl border px-3 sm:px-4 transition-all duration-200 flex-nowrap",
            scrolled
              ? "border-border bg-background/95 shadow-md shadow-black/5 backdrop-blur-xl"
              : "border-border/80 bg-background/85 shadow-2xs backdrop-blur-md"
          )}
        >
          <div className="flex shrink-0 items-center min-w-0 pr-2">
            <Link
              href="/"
              aria-label={t("app.name")}
              className="group flex items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary shadow-xs">
                <Image
                  src="/icon.svg"
                  alt="Kumbh Milaap logo"
                  width={36}
                  height={36}
                  priority
                  className="size-full object-cover"
                />
              </span>
              <span className="font-bold text-base sm:text-lg tracking-tight text-foreground whitespace-nowrap group-hover:text-primary transition-colors">
                {t("app.name")}
              </span>
            </Link>
          </div>

          <nav
            aria-label="Primary"
            className="hidden lg:flex items-center gap-1 xl:gap-2 flex-nowrap shrink-0"
          >
            {PRIMARY_NAV_ITEMS.map((item) => {
              const targetId = item.href.replace("#", "");
              const isActive = activeSection === targetId;

              return (
                <a
                  key={item.id}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    isActive
                      ? "bg-muted text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground font-medium"
                  )}
                >
                  {t(item.labelKey)}
                </a>
              );
            })}

            <div className="relative">
              <button
                ref={moreButtonRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen(!moreOpen)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  moreOpen
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <span>{t("nav.more")}</span>
                <ChevronDown
                  size={14}
                  className={cn(
                    "transition-transform duration-200",
                    moreOpen && "rotate-180"
                  )}
                />
              </button>

              {moreOpen && (
                <div
                  ref={moreDropdownRef}
                  role="menu"
                  aria-orientation="vertical"
                  className="absolute left-0 mt-2 w-48 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 z-50"
                >
                  <Link
                    href="/register"
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors whitespace-nowrap"
                  >
                    <UserPlus size={15} className="text-muted-foreground shrink-0" />
                    <span>{t("nav.register")}</span>
                  </Link>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMoreOpen(false);
                      setExploreOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors whitespace-nowrap cursor-pointer text-left"
                  >
                    <Compass size={15} className="text-muted-foreground shrink-0" />
                    <span>{t("nav.explore")}</span>
                  </button>

                  {authorizedForOps && (
                    <Link
                      href="/reports"
                      role="menuitem"
                      onClick={() => setMoreOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
                    >
                      <Shield size={15} className="text-primary shrink-0" />
                      <span>{t("nav.opsDashboard")}</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0">
            <div className="relative hidden md:block lg:hidden">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen(!moreOpen)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card/60 px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 whitespace-nowrap transition-colors cursor-pointer"
              >
                <span>{t("nav.menu")}</span>
                <ChevronDown size={14} />
              </button>

              {moreOpen && (
                <div
                  ref={moreDropdownRef}
                  role="menu"
                  className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-popover p-1.5 shadow-lg backdrop-blur-xl animate-in fade-in duration-150 z-50"
                >
                  {PRIMARY_NAV_ITEMS.map((item) => (
                    <a
                      key={item.id}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setMoreOpen(false)}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted whitespace-nowrap transition-colors"
                    >
                      {t(item.labelKey)}
                    </a>
                  ))}
                  <div className="my-1 border-t border-border/60" />
                  <Link
                    href="/register"
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted whitespace-nowrap transition-colors"
                  >
                    <UserPlus size={15} className="text-muted-foreground shrink-0" />
                    <span>{t("nav.register")}</span>
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMoreOpen(false);
                      setExploreOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted whitespace-nowrap transition-colors text-left"
                  >
                    <Compass size={15} className="text-muted-foreground shrink-0" />
                    <span>{t("nav.explore")}</span>
                  </button>
                  {authorizedForOps && (
                    <Link
                      href="/reports"
                      role="menuitem"
                      onClick={() => setMoreOpen(false)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted whitespace-nowrap transition-colors"
                    >
                      <Shield size={15} className="text-primary shrink-0" />
                      <span>{t("nav.opsDashboard")}</span>
                    </Link>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label={t("action.search")}
              className="hidden xl:inline-flex h-9 w-36 items-center justify-between rounded-lg border border-border bg-card/60 px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 whitespace-nowrap transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <Search size={14} className="shrink-0" />
                <span className="truncate">{t("action.search")}</span>
              </span>
              <kbd className="shrink-0 rounded border border-border bg-muted/80 px-1 py-0.5 text-[10px] font-mono leading-none">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label={t("action.search")}
              title="Search (⌘K)"
              className="hidden md:inline-flex xl:hidden size-9 md:size-10 items-center justify-center rounded-lg border border-border bg-card/60 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Search size={16} strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={handleToggleLanguage}
              aria-label={
                prefs.locale === "en"
                  ? "Switch to Hindi (हिन्दी)"
                  : "Switch to English"
              }
              title={
                prefs.locale === "en"
                  ? "Switch to Hindi (हिन्दी)"
                  : "Switch to English"
              }
              className="hidden md:inline-flex h-9 px-2.5 items-center gap-1.5 rounded-lg border border-border bg-card/60 text-xs font-semibold text-foreground hover:bg-muted hover:text-foreground shrink-0 whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Languages size={15} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
              <span className="font-bold tracking-tight">{localeBadge}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label="Toggle display theme"
              title="Toggle color theme"
              className="hidden md:inline-flex size-9 md:size-10 items-center justify-center rounded-lg border border-border bg-card/60 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {resolvedTheme === "dark" ? (
                <Sun size={17} strokeWidth={1.75} className="text-primary" />
              ) : (
                <Moon size={17} strokeWidth={1.75} className="text-foreground" />
              )}
            </button>

            <button
              type="button"
              onClick={onEmergency}
              className="hidden md:inline-flex h-10 px-4 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover font-bold text-sm shadow-sm transition-colors duration-150 shrink-0 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring cursor-pointer"
            >
              {t("nav.iAmLost")}
            </button>

            <button
              type="button"
              onClick={onEmergency}
              className="md:hidden inline-flex h-9 px-3 items-center gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover font-bold text-xs sm:text-sm shadow-sm shrink-0 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring cursor-pointer"
            >
              <LifeBuoy size={14} className="shrink-0" />
              <span>{t("nav.iAmLostShort")}</span>
            </button>

            <button
              ref={menuButtonRef}
              type="button"
              aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden grid size-9 sm:size-10 place-items-center rounded-xl border border-border bg-card/60 text-foreground hover:bg-muted shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {menuOpen ? (
                <X size={18} strokeWidth={2} />
              ) : (
                <Menu size={18} strokeWidth={2} />
              )}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.menu")}
          className="fixed inset-0 z-[60] md:hidden"
        >
          <div
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
          />

          <div
            ref={drawerRef}
            onKeyDown={trapDrawerFocus}
            className="fixed inset-y-0 right-0 w-full max-w-sm border-l border-border bg-background p-5 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200 z-10"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <Link
                  href="/"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg"
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-primary">
                    <Image
                      src="/icon.svg"
                      alt="Kumbh Milaap logo"
                      width={32}
                      height={32}
                      className="size-full object-cover"
                    />
                  </span>
                  <span className="font-bold text-base tracking-tight text-foreground">
                    {t("app.name")}
                  </span>
                </Link>

                <button
                  type="button"
                  aria-label={t("nav.closeMenu")}
                  onClick={() => setMenuOpen(false)}
                  className="grid size-10 place-items-center rounded-xl border border-border text-foreground hover:bg-muted"
                >
                  <X size={20} strokeWidth={1.75} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setPaletteOpen(true);
                }}
                className="flex h-11 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Search size={18} className="shrink-0" />
                <span>{t("action.search")}</span>
                <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 text-2xs font-mono">
                  ⌘K
                </kbd>
              </button>

              <nav aria-label="Mobile Navigation" className="grid gap-1 pt-1">
                {PRIMARY_NAV_ITEMS.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 items-center rounded-lg px-3 py-2 text-base font-semibold text-foreground hover:bg-muted hover:text-primary transition-colors"
                  >
                    {t(item.labelKey)}
                  </a>
                ))}

                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-base font-semibold text-foreground hover:bg-muted hover:text-primary transition-colors"
                >
                  <UserPlus size={18} className="text-muted-foreground shrink-0" />
                  <span>{t("nav.register")}</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setExploreOpen(true);
                  }}
                  className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-base font-semibold text-foreground hover:bg-muted hover:text-primary transition-colors"
                >
                  <Compass size={18} className="text-muted-foreground shrink-0" />
                  <span>{t("nav.explore")}</span>
                </button>

                {authorizedForOps && (
                  <Link
                    href="/reports"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-base font-semibold text-foreground hover:bg-muted hover:text-primary transition-colors"
                  >
                    <Shield size={18} className="text-primary shrink-0" />
                    <span>{t("nav.opsDashboard")}</span>
                  </Link>
                )}
              </nav>
            </div>

            <div className="space-y-4 pt-6 border-t border-border mt-4">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Languages size={14} />
                  {t("prefs.language")}
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {LOCALES.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLocale(l as Locale)}
                      className={cn(
                        "h-9 rounded-lg border text-xs font-semibold transition-colors",
                        prefs.locale === l
                          ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                          : "border-border bg-card text-foreground hover:bg-muted"
                      )}
                    >
                      {LOCALE_META[l].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <span className="text-sm font-semibold text-foreground">
                  {t("prefs.display")}
                </span>
                <button
                  type="button"
                  onClick={handleToggleTheme}
                  aria-label="Toggle color theme"
                  className="flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  {resolvedTheme === "dark" ? (
                    <>
                      <Sun size={15} className="text-primary" />
                      <span>{t("prefs.themeLight")}</span>
                    </>
                  ) : (
                    <>
                      <Moon size={15} className="text-foreground" />
                      <span>{t("prefs.themeDark")}</span>
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEmergency();
                }}
                className="h-12 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover font-bold text-base flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                <LifeBuoy size={18} />
                <span>{t("nav.iAmLost")} — {t("nav.help")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onFlow={handleFlow}
      />

      <ExploreOverlay
        open={exploreOpen}
        onClose={() => setExploreOpen(false)}
      />
    </>
  );
}

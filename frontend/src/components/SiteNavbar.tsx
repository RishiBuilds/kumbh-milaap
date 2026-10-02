"use client";

import Link from "next/link";
import { Menu, X, Languages, Search, Compass } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandPalette } from "@/components/CommandPalette";
import { ExploreOverlay } from "@/components/ExploreOverlay";

export function SiteNavbar({ onEmergency }: { onEmergency: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const [explore, setExplore] = useState(false);

  const links = [
    ["How it works", "#how-it-works"],
    ["Features", "#features"],
    ["Zones", "#zones"],
    ["Safety", "#safety"],
  ] as const;

  const start = useCallback(
    (flow: "find" | "report" | "lost") => {
      if (flow === "lost") {
        onEmergency();
      } else {
        window.dispatchEvent(new CustomEvent("km:flow", { detail: flow }));
      }
    },
    [onEmergency]
  );

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);

    const shortcuts = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette(true);
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        setExplore(true);
      }
    };

    update();

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("keydown", shortcuts);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("keydown", shortcuts);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [menu]);

  return (
    <>
      <header className="sticky top-0 z-50 px-3 pt-2 md:px-5">
        <div
          className={`mx-auto flex h-[62px] max-w-[1240px] items-center justify-between rounded-2xl border px-3 transition-all duration-200 md:h-[68px] md:px-4 ${
            scrolled
              ? "border-border bg-background/90 shadow-lg shadow-black/5 backdrop-blur-xl"
              : "border-border/70 bg-background/75 backdrop-blur-md"
          }`}
        >
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <span className="grid size-9 place-items-center overflow-hidden rounded-xl bg-saffron">
              <img
                src="/icon.svg"
                alt="Kumbh Milaap logo"
                width={36}
                height={36}
                className="size-full object-cover"
              />
            </span>

            <span className="hidden items-center gap-2 text-sm font-bold tracking-tight sm:flex">
              Kumbh Milaap
              <span className="text-muted-foreground">/</span>
              <span className="font-medium text-muted-foreground">
                Kumbh Mela 2027
              </span>
            </span>
          </Link>

          <nav
            aria-label="Main navigation"
            className="hidden min-w-0 items-center justify-end gap-1 xl:flex"
          >
            {links.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {label}
              </a>
            ))}

            <span className="mx-1 h-5 w-px bg-border" />

            <button
              onClick={() => setPalette(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-2.5 text-sm text-muted-foreground hover:bg-muted"
            >
              <Search size={15} strokeWidth={1.75} />
              Search
              <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px]">
                Ctrl K
              </kbd>
            </button>

            <button
              onClick={() => setExplore(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Compass size={15} strokeWidth={1.75} />
              Explore
            </button>

            <span className="mx-1 h-5 w-px bg-border" />

            <Link
              href="/admin"
              className="rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Admin
            </Link>

            <button
              aria-label="Language options"
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
            >
              <Languages size={15} strokeWidth={1.75} />
              EN
            </button>

            <ThemeToggle />

            <button
              onClick={onEmergency}
              className="h-10 rounded-xl bg-saffron px-4 text-sm font-bold text-white transition-colors hover:bg-saffron-dark"
            >
              I Am Lost
            </button>
          </nav>

          <button
            aria-label={menu ? "Close menu" : "Open menu"}
            onClick={() => setMenu(!menu)}
            className="grid size-11 place-items-center rounded-xl border border-border xl:hidden"
          >
            {menu ? (
              <X size={21} strokeWidth={1.75} />
            ) : (
              <Menu size={21} strokeWidth={1.75} />
            )}
          </button>
        </div>
      </header>

      {menu && (
        <div className="fixed inset-0 z-[60] bg-background px-5 pt-[76px] xl:hidden">
          <nav
            aria-label="Mobile navigation"
            className="grid h-full content-start gap-1 py-6"
          >
            {links.map(([label, href]) => (
              <a
                key={href}
                onClick={() => setMenu(false)}
                href={href}
                className="min-h-12 rounded-lg px-3 py-3 text-xl font-semibold hover:bg-muted"
              >
                {label}
              </a>
            ))}

            <button
              onClick={() => {
                setMenu(false);
                setPalette(true);
              }}
              className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-3 text-left text-xl font-semibold hover:bg-muted"
            >
              <Search size={20} strokeWidth={1.75} />
              Search
            </button>

            <Link
              onClick={() => setMenu(false)}
              href="/admin"
              className="min-h-12 rounded-lg px-3 py-3 text-xl font-semibold hover:bg-muted"
            >
              Log in / Admin
            </Link>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-5">
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Languages size={17} strokeWidth={1.75} />
                EN / हिन्दी / मराठी
              </span>
              <ThemeToggle />
            </div>

            <button
              onClick={() => {
                setMenu(false);
                onEmergency();
              }}
              className="mt-5 min-h-12 rounded-xl bg-saffron px-4 text-left text-base font-bold text-white"
            >
              I Am Lost — get help
            </button>
          </nav>
        </div>
      )}

      <CommandPalette
        open={palette}
        onClose={() => setPalette(false)}
        onFlow={start}
      />

      <ExploreOverlay
        open={explore}
        onClose={() => setExplore(false)}
      />
    </>
  );
}
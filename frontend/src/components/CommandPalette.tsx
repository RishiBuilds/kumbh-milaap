"use client";

import { useEffect, useRef, useState } from "react";
import {
  Command,
  MapPin,
  Moon,
  Search,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";

type Flow = "find" | "report" | "lost";

type PaletteProps = {
  open: boolean;
  onClose: () => void;
  onFlow: (flow: Flow) => void;
};

type Action = {
  title: string;
  detail: string;
  flow: Flow;
  icon: LucideIcon;
};

const actions: Action[] = [
  {
    title: "Find a missing person",
    detail: "Search by name or case ID",
    flow: "find",
    icon: Search,
  },
  {
    title: "Report a missing person",
    detail: "Start a new missing-person report",
    flow: "report",
    icon: Command,
  },
  {
    title: "I am lost",
    detail: "Get immediate help at the nearest desk",
    flow: "lost",
    icon: MapPin,
  },
];

export function CommandPalette({
  open,
  onClose,
  onFlow,
}: PaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const actionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { resolvedTheme, setTheme } = useTheme();

  const visibleActions = actions.filter((action) =>
    `${action.title} ${action.detail}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!open) return;

    setQuery("");
    setActiveIndex(0);
    inputRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (activeIndex >= visibleActions.length) {
      setActiveIndex(Math.max(0, visibleActions.length - 1));
    }
  }, [activeIndex, visibleActions.length]);

  if (!open) return null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) =>
        visibleActions.length ? (index + 1) % visibleActions.length : 0,
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        visibleActions.length
          ? (index - 1 + visibleActions.length) % visibleActions.length
          : 0,
      );
    }

    if (event.key === "Enter" && visibleActions[activeIndex]) {
      event.preventDefault();
      onFlow(visibleActions[activeIndex].flow);
      onClose();
    }
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-start bg-black/35 px-4 pt-[14vh] backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Quick actions"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search
            size={20}
            strokeWidth={1.75}
            className="shrink-0 text-muted-foreground"
            aria-hidden="true"
          />

          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search cases, pages, or actions"
            aria-label="Search quick actions"
            aria-controls="command-palette-actions"
            className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />

          <button
            type="button"
            aria-label="Close command palette"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-2">
          <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Go to
          </p>

          <div id="command-palette-actions">
            {visibleActions.length ? (
              visibleActions.map((action, index) => {
                const Icon = action.icon;
                const isActive = index === activeIndex;

                return (
                  <button
                    key={action.flow}
                    ref={(element) => {
                      actionRefs.current[index] = element;
                    }}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      onFlow(action.flow);
                      onClose();
                    }}
                    aria-current={isActive ? "true" : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isActive ? "bg-muted" : "hover:bg-muted/60"
                    }`}
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.75}
                      className="shrink-0 text-saffron"
                      aria-hidden="true"
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {action.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {action.detail}
                      </span>
                    </span>

                    <span className="text-xs text-muted-foreground">
                      Enter
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No matching actions found.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {resolvedTheme === "dark" ? (
              <Sun
                size={18}
                strokeWidth={1.75}
                className="text-saffron"
                aria-hidden="true"
              />
            ) : (
              <Moon
                size={18}
                strokeWidth={1.75}
                className="text-saffron"
                aria-hidden="true"
              />
            )}

            <span className="flex-1 text-sm font-semibold">
              Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
            </span>
          </button>
        </div>

        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          Use ↑ ↓ to navigate, Enter to select, or Esc to close.
        </div>
      </section>
    </div>
  );
}
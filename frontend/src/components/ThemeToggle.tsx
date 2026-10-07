"use client";

import { useTheme } from "@/components/PreferencesProvider";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle color theme"
      aria-pressed={resolvedTheme === "dark"}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={`relative w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer ${className}`}
    >
      <Sun className="w-[18px] h-[18px] hidden dark:block hc-dark:block text-saffron" strokeWidth={1.75} />
      <Moon className="w-[18px] h-[18px] block dark:hidden hc-dark:hidden text-foreground" strokeWidth={1.75} />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}

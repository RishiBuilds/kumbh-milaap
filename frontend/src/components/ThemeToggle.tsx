"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle color theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={`relative w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer ${className}`}
    >
      <Sun className="w-[18px] h-[18px] hidden dark:block text-saffron" strokeWidth={1.75} />
      <Moon className="w-[18px] h-[18px] block dark:hidden text-charcoal" strokeWidth={1.75} />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}

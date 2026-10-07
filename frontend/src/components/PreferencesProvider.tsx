"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isLocale,
  type Locale,
} from "@/lib/i18n/config";
import { createTranslator, type Translate } from "@/lib/i18n/translate";
import { CORE_CATALOGUE, type Catalog } from "@/lib/i18n/messages/core";
import { SCREEN_CATALOGUES } from "@/lib/i18n/messages";

export type ThemeChoice = "light" | "dark" | "system";
export type TextScale = "normal" | "large";

export interface Preferences {
  theme: ThemeChoice;
  highContrast: boolean;
  textScale: TextScale;
  reducedMotion: boolean | null;
  locale: Locale;
}

export const PREF_STORAGE_KEY = "km.prefs.v1";

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  highContrast: false,
  textScale: "normal",
  reducedMotion: null,
  locale: DEFAULT_LOCALE,
};

function sanitise(raw: Partial<Preferences> | null | undefined): Preferences {
  const prefs = { ...DEFAULT_PREFERENCES, ...(raw ?? {}) };
  if (!isLocale(prefs.locale)) prefs.locale = DEFAULT_LOCALE;
  if (prefs.theme !== "light" && prefs.theme !== "dark") {
    prefs.theme = "system";
  }
  if (prefs.textScale !== "large") prefs.textScale = "normal";
  prefs.highContrast = prefs.highContrast === true;
  return prefs;
}

export function htmlStateFor(
  prefs: Preferences,
  systemPrefersDark: boolean
): { classes: string[]; data: Record<string, string> } {
  const isDark =
    prefs.theme === "dark" || (prefs.theme === "system" && systemPrefersDark);

  const classes: string[] = [];
  if (prefs.highContrast) {
    classes.push(isDark ? "hc-dark" : "hc-light");
  } else if (isDark) {
    classes.push("dark");
  }

  const data: Record<string, string> = {
    "data-text-scale": prefs.textScale,
    "data-contrast": prefs.highContrast ? "high" : "standard",
    "data-theme-choice": prefs.theme,
  };
  if (prefs.reducedMotion !== null) {
    data["data-reduced-motion"] = prefs.reducedMotion ? "reduce" : "no-preference";
  }

  return { classes, data };
}

export const MANAGED_CLASSES = ["dark", "hc-light", "hc-dark"] as const;

function readStoredPreferences(): Preferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREF_STORAGE_KEY);
    if (!raw) return null;
    return sanitise(JSON.parse(raw) as Partial<Preferences>);
  } catch {
    return null;
  }
}

function writeStoredPreferences(prefs: Preferences): void {
  try {
    window.localStorage.setItem(PREF_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
  }
}

function useSystemPrefersDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false
  );
}

export interface PreferencesContextValue {
  prefs: Preferences;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeChoice) => void;
  setHighContrast: (on: boolean) => void;
  setTextScale: (scale: TextScale) => void;
  setReducedMotion: (value: boolean | null) => void;
  setLocale: (locale: Locale) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const TranslateContext = createContext<Translate | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

export function ThemeProvider({ children, initialLocale }: ThemeProviderProps) {
  const [prefs, setPrefs] = useState<Preferences>(() =>
    sanitise({ locale: initialLocale })
  );
  const [adopted, setAdopted] = useState(false);
  const systemDark = useSystemPrefersDark();

  useEffect(() => {
    if (adopted) return;
    const stored = readStoredPreferences();
    setPrefs(stored ?? sanitise({ locale: initialLocale }));
    setAdopted(true);
  }, [adopted, initialLocale]);

  useEffect(() => {
    const root = document.documentElement;
    const { classes, data } = htmlStateFor(prefs, systemDark);

    for (const name of MANAGED_CLASSES) {
      root.classList.toggle(name, classes.includes(name));
    }
    for (const [key, value] of Object.entries(data)) {
      root.setAttribute(key, value);
    }
    root.lang = prefs.locale;
  }, [prefs, systemDark]);

  useEffect(() => {
    try {
      document.cookie = `${LOCALE_STORAGE_KEY}=${prefs.locale};path=/;max-age=31536000;samesite=lax`;
    } catch {
    }
  }, [prefs.locale]);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((prev) => {
      const next = sanitise({ ...prev, ...patch });
      writeStoredPreferences(next);
      return next;
    });
  }, []);

  const resolvedTheme: "light" | "dark" =
    prefs.theme === "dark" || (prefs.theme === "system" && systemDark)
      ? "dark"
      : "light";

  const value = useMemo<PreferencesContextValue>(
    () => ({
      prefs,
      resolvedTheme,
      setTheme: (theme) => update({ theme }),
      setHighContrast: (highContrast) => update({ highContrast }),
      setTextScale: (textScale) => update({ textScale }),
      setReducedMotion: (reducedMotion) => update({ reducedMotion }),
      setLocale: (locale) => update({ locale }),
    }),
    [prefs, resolvedTheme, update]
  );

  const translator = useMemo(() => {
    const localeCatalogue = SCREEN_CATALOGUES[prefs.locale] ?? {};
    return createTranslator(prefs.locale, CORE_CATALOGUE, localeCatalogue);
  }, [prefs.locale]);

  return (
    <PreferencesContext.Provider value={value}>
      <TranslateContext.Provider value={translator}>
        {children}
      </TranslateContext.Provider>
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used inside <ThemeProvider>");
  return ctx;
}

export function useTheme(): {
  theme: ThemeChoice;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: string) => void;
  systemTheme: "light" | "dark";
} {
  const ctx = useContext(PreferencesContext);
  const systemDark = useSystemPrefersDark();
  const fallbackResolved = systemDark ? "dark" : "light";

  if (!ctx) {
    return {
      theme: "system",
      resolvedTheme: fallbackResolved,
      setTheme: () => {},
      systemTheme: fallbackResolved,
    };
  }

  return {
    theme: ctx.prefs.theme,
    resolvedTheme: ctx.resolvedTheme,
    setTheme: (t: string) => {
      if (t === "light" || t === "dark" || t === "system") {
        ctx.setTheme(t);
      }
    },
    systemTheme: systemDark ? "dark" : "light",
  };
}

export function useTranslate(screen?: Catalog): Translate {
  const base = useContext(TranslateContext);
  if (!base) throw new Error("useTranslate must be used inside <ThemeProvider>");
  const locale = base.locale;

  return useMemo(() => {
    if (!screen) return base;
    const localeCatalogue = SCREEN_CATALOGUES[locale] ?? {};
    return createTranslator(locale, CORE_CATALOGUE, {
      ...localeCatalogue,
      ...screen,
    });
  }, [base, screen, locale]);
}

export function useLocale(): Locale {
  return useTranslate().locale;
}

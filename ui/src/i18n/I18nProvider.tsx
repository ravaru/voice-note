import React, { createContext, useContext, useMemo, useState } from "react";
import { STRINGS, SUPPORTED_LOCALES, type Locale } from "./strings";

const STORAGE_KEY = "voicenote.ui_language";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const getDefaultLocale = (): Locale => {
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored && STRINGS[stored]) return stored;
  const system = navigator.language?.toLowerCase() ?? "en";
  const match = SUPPORTED_LOCALES.find((lang) => system.startsWith(lang.code));
  return match?.code ?? "en";
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getDefaultLocale);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const t = useMemo(() => {
    const strings = STRINGS[locale] ?? STRINGS.en;
    return (key: string, vars?: Record<string, string>) => {
      let value = strings[key] ?? STRINGS.en[key] ?? key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          value = value.replace(new RegExp(`\\{${k}\\}`, "g"), v);
        });
      }
      return value;
    };
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

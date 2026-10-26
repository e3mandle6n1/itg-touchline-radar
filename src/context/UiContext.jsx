import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translate } from "../i18n/messages.js";
import { LANGS } from "../i18n/locales.js";
import {
  THEMES,
  applyTheme,
  persistPrefs,
  readLang,
  readThemePref,
  resolveTheme,
} from "../prefs.js";

const UiContext = createContext(null);

export function UiProvider({ children, matchId }) {
  const [theme, setTheme] = useState(readThemePref);
  const [lang, setLang] = useState(readLang);

  useEffect(() => {
    applyTheme(theme);
    persistPrefs({ theme, lang, match: matchId });
  }, [theme, lang, matchId]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({
    theme,
    setTheme: (next) => {
      if (THEMES.includes(next)) setTheme(next);
    },
    toggleTheme: () => setTheme((cur) => (cur === "dark" ? "light" : "dark")),
    resolvedTheme: resolveTheme(theme),
    lang,
    setLang: (next) => {
      if (LANGS.includes(next)) setLang(next);
    },
    t: (key) => translate(lang, key),
  }), [theme, lang]);

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used within UiProvider");
  return ctx;
}

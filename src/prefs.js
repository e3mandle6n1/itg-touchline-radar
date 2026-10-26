import { LANGS } from "./i18n/locales.js";

const THEME_KEY = "touchline.theme";
const LANG_KEY = "touchline.lang";

export const THEMES = ["light", "dark"];
export { LANGS };

function readParam(name) {
  try {
    return new URLSearchParams(window.location.search).get(name) || "";
  } catch {
    return "";
  }
}

function readStored(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function readThemePref() {
  const fromUrl = readParam("theme");
  if (THEMES.includes(fromUrl)) return fromUrl;
  const stored = readStored(THEME_KEY);
  if (stored === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  if (THEMES.includes(stored)) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readLang() {
  const fromUrl = readParam("lang");
  if (LANGS.includes(fromUrl)) return fromUrl;
  const stored = readStored(LANG_KEY);
  if (LANGS.includes(stored)) return stored;
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  return LANGS.includes(nav) ? nav : "en";
}

export function persistPrefs({ theme, lang, match }) {
  const url = new URL(window.location.href);
  if (match) url.searchParams.set("match", match);
  else url.searchParams.delete("match");

  if (theme === "dark") url.searchParams.set("theme", "dark");
  else url.searchParams.delete("theme");

  if (lang && lang !== "en") url.searchParams.set("lang", lang);
  else url.searchParams.delete("lang");

  url.searchParams.delete("live");
  url.searchParams.delete("tone");
  window.history.replaceState({}, "", url);

  if (theme) writeStored(THEME_KEY, theme);
  if (lang) writeStored(LANG_KEY, lang);
}

export function resolveTheme(pref) {
  return pref === "dark" ? "dark" : "light";
}

export function applyTheme(pref) {
  const resolved = resolveTheme(pref);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePref = resolved;
  document.documentElement.style.colorScheme = resolved;
}

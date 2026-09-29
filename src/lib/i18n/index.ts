// Simple i18n without a library: a typed dictionary per language plus locale-aware
// formatters. Components call `useI18n()`; the provider lives in `components/I18nProvider`.
import { createContext, useContext } from "react";
import { makeFormatters, type Formatters } from "../format";
import { en } from "./en";
import { id, type Messages } from "./id";

export type Lang = "id" | "en";

export const LANGS: Record<Lang, { messages: Messages; locale: string }> = {
  id: { messages: id, locale: "id-ID" },
  en: { messages: en, locale: "en-US" },
};

const STORAGE_KEY = "sweepr.lang";

function isLang(v: unknown): v is Lang {
  return v === "id" || v === "en";
}

/** Saved choice, else the Windows display language (Indonesian -> id, anything else -> en). */
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // Storage can be unavailable; fall back to the system language.
  }
  return navigator.language.toLowerCase().startsWith("id") ? "id" : "en";
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Not remembered this time; the app still works.
  }
}

export interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Messages;
  fmt: Formatters;
}

export function makeI18n(lang: Lang, setLang: (lang: Lang) => void): I18n {
  const { messages, locale } = LANGS[lang];
  return { lang, setLang, t: messages, fmt: makeFormatters(locale) };
}

export const I18nContext = createContext<I18n>(makeI18n("id", () => {}));

export function useI18n(): I18n {
  return useContext(I18nContext);
}

/** "5 items" / "5 item": a formatted count with its (plural-aware) noun. */
export function countOf(i18n: I18n, n: number, noun: (n: number) => string): string {
  return `${i18n.fmt.count(n)} ${noun(n)}`;
}

export type { Messages };

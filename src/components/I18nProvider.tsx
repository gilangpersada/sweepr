import { useEffect, useMemo, useState, type ReactNode } from "react";
import { I18nContext, initialLang, makeI18n, saveLang, type Lang } from "../lib/i18n";

/** Holds the chosen language for the whole app and remembers it between runs. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  // For screen readers and spell checking.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(
    () =>
      makeI18n(lang, (next) => {
        saveLang(next);
        setLangState(next);
      }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

import { LANGS, useI18n, type Lang } from "../lib/i18n";

export function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
      {t.common.language}
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      >
        {(Object.keys(LANGS) as Lang[]).map((l) => (
          <option key={l} value={l}>
            {LANGS[l].messages.languageName}
          </option>
        ))}
      </select>
    </label>
  );
}

import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState, type ReactNode } from "react";
import { Card } from "../components/ui/Card";
import { SECTION_TITLE } from "../components/ui/styles";
import { LANGS, useI18n, type Lang } from "../lib/i18n";
import { THEME_PREFS, useTheme, type ThemePref } from "../lib/theme";

/** A row of radio buttons drawn as Neo-Brutalism toggles. Arrow keys work (native radios). */
function Choice<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className={SECTION_TITLE}>{legend}</legend>
      <div className="flex flex-wrap gap-3">
        {options.map((o) => (
          <label
            key={o.id}
            className="cursor-pointer rounded-control border-2 border-line bg-surface px-4 py-2 font-bold shadow-hard-sm transition-[translate,box-shadow] duration-100 has-checked:bg-primary has-checked:text-on-accent has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-info-ink hover:bg-sunken has-checked:hover:bg-primary"
          >
            <input
              type="radio"
              name={name}
              value={o.id}
              checked={o.id === value}
              onChange={() => onChange(o.id)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <Card className="space-y-3 p-5">{children}</Card>;
}

export function Settings() {
  const { t, lang, setLang } = useI18n();
  const { pref, setPref } = useTheme();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then(setVersion, () => setVersion(null));
  }, []);

  const themeLabel: Record<ThemePref, string> = {
    system: t.settings.themeSystem,
    light: t.settings.themeLight,
    dark: t.settings.themeDark,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b-[3px] border-line bg-surface px-6 py-4">
        <h1 className="text-xl font-bold">{t.settings.title}</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
          <Section>
            <Choice<Lang>
              name="lang"
              legend={t.settings.language}
              value={lang}
              onChange={setLang}
              options={(Object.keys(LANGS) as Lang[]).map((l) => ({
                id: l,
                label: LANGS[l].messages.languageName,
              }))}
            />
          </Section>

          <Section>
            <Choice<ThemePref>
              name="theme"
              legend={t.settings.theme}
              value={pref}
              onChange={setPref}
              options={THEME_PREFS.map((p) => ({ id: p, label: themeLabel[p] }))}
            />
            <p className="text-sm text-muted">{t.settings.themeHint}</p>
          </Section>

          <Section>
            <h2 className={SECTION_TITLE}>{t.settings.about}</h2>
            <p className="font-bold">
              Sweepr{" "}
              {version && (
                <span className="font-mono font-normal">{t.settings.version(version)}</span>
              )}
            </p>
            <p className="text-sm text-muted">{t.settings.localOnly}</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

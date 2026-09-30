import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  darkQuery,
  initialThemePref,
  resolveTheme,
  saveThemePref,
  ThemeContext,
  type ThemePref,
} from "../lib/theme";

/** Holds the theme choice, keeps `data-theme` on <html> and the window title bar in sync. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(initialThemePref);
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);

  // Windows switching light/dark while the app runs.
  useEffect(() => {
    const query = darkQuery();
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const theme = resolveTheme(pref, systemDark);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Title bar: `null` hands it back to Windows. Fails quietly outside Tauri (vite dev in a browser).
  useEffect(() => {
    getCurrentWindow()
      .setTheme(pref === "system" ? null : pref)
      .catch(() => {});
  }, [pref]);

  const value = useMemo(
    () => ({
      pref,
      theme,
      setPref: (next: ThemePref) => {
        saveThemePref(next);
        setPrefState(next);
      },
    }),
    [pref, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

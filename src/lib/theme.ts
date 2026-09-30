// Theme choice (D-034): follow Windows, or force light/dark. `public/theme-init.js` applies
// the saved choice before React loads; keep the key and values in sync with it.
import { createContext, useContext } from "react";

export type ThemePref = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export const THEME_PREFS: ThemePref[] = ["system", "light", "dark"];

const STORAGE_KEY = "sweepr.theme";

export const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

export function initialThemePref(): ThemePref {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage can be unavailable; follow the system.
  }
  return "system";
}

export function saveThemePref(pref: ThemePref): void {
  try {
    if (pref === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Not remembered this time; the app still works.
  }
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): Theme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

export interface ThemeState {
  pref: ThemePref;
  theme: Theme;
  setPref: (pref: ThemePref) => void;
}

export const ThemeContext = createContext<ThemeState>({
  pref: "system",
  theme: "light",
  setPref: () => {},
});

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}

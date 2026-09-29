// UI labels and colors for the file categories defined in `config/cleaner-rules.<os>.json`.
// Keys missing here (added to the config later) fall back to the raw key and a gray color.
import type { Messages } from "./i18n";

interface CategoryStyle {
  label: string;
  /** Tailwind background class for bars and legend dots. */
  color: string;
}

const COLORS: Record<string, string> = {
  video: "bg-rose-500",
  photo: "bg-amber-500",
  audio: "bg-fuchsia-500",
  document: "bg-sky-500",
  archive: "bg-emerald-500",
  installer: "bg-orange-600",
  code: "bg-indigo-500",
  other: "bg-zinc-400 dark:bg-zinc-500",
};

export function categoryStyle(t: Messages, key: string): CategoryStyle {
  return {
    label: t.categories.names[key] ?? key,
    color: COLORS[key] ?? "bg-zinc-300 dark:bg-zinc-600",
  };
}

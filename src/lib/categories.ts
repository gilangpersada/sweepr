// UI labels and colors for the file categories defined in `config/cleaner-rules.<os>.json`.
// Keys missing here (added to the config later) fall back to the raw key and the "other" color.
// Colors are the `--color-cat-*` tokens in `index.css`.
import type { Messages } from "./i18n";

interface CategoryStyle {
  label: string;
  /** Tailwind background class for bars and legend swatches. */
  color: string;
}

const COLORS: Record<string, string> = {
  video: "bg-cat-video",
  photo: "bg-cat-photo",
  audio: "bg-cat-audio",
  document: "bg-cat-document",
  archive: "bg-cat-archive",
  installer: "bg-cat-installer",
  code: "bg-cat-code",
  other: "bg-cat-other",
};

export function categoryStyle(t: Messages, key: string): CategoryStyle {
  return {
    label: t.categories.names[key] ?? key,
    color: COLORS[key] ?? "bg-cat-other",
  };
}

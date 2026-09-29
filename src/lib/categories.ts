// UI labels and colors for the file categories defined in `config/cleaner-rules.<os>.json`.
// Keys missing here (added to the config later) fall back to the raw key and a gray color.

interface CategoryStyle {
  label: string;
  /** Tailwind background class for bars and legend dots. */
  color: string;
}

const STYLES: Record<string, CategoryStyle> = {
  video: { label: "Video", color: "bg-rose-500" },
  photo: { label: "Foto", color: "bg-amber-500" },
  audio: { label: "Audio", color: "bg-fuchsia-500" },
  document: { label: "Dokumen", color: "bg-sky-500" },
  archive: { label: "Arsip", color: "bg-emerald-500" },
  installer: { label: "Installer", color: "bg-orange-600" },
  code: { label: "Kode", color: "bg-indigo-500" },
  other: { label: "Lainnya", color: "bg-zinc-400 dark:bg-zinc-500" },
};

export function categoryStyle(key: string): CategoryStyle {
  return STYLES[key] ?? { label: key, color: "bg-zinc-300 dark:bg-zinc-600" };
}

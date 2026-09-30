// Number, size and date formatting for one locale. Components get a bound set through
// `useI18n().fmt`, so the output follows the chosen language ("1,5 GB" vs "1.5 GB").

const UNITS = ["B", "KB", "MB", "GB", "TB"];

export interface Formatters {
  /** 1024-based size, e.g. 1536 -> "1,5 KB". */
  bytes: (bytes: number) => string;
  count: (n: number) => string;
  /** Unix seconds -> "3 Sep 2026", or "—" when unknown. */
  date: (unixSeconds: number | null) => string;
  /** 12.345 -> "12,3%"; tiny non-zero values show as "<0,1%". */
  percent: (pct: number) => string;
  /** Milliseconds -> seconds with one decimal, e.g. 13100 -> "13,1". */
  seconds: (ms: number) => string;
  /** Time since a moment (unix milliseconds): "10 menit yang lalu" / "10 minutes ago". */
  ago: (unixMs: number, now?: number) => string;
}

export function makeFormatters(locale: string): Formatters {
  const number = (n: number, digits: number) =>
    n.toLocaleString(locale, { maximumFractionDigits: digits });
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return {
    bytes(bytes) {
      let value = bytes;
      let unit = 0;
      while (value >= 1024 && unit < UNITS.length - 1) {
        value /= 1024;
        unit++;
      }
      const digits = unit === 0 || value >= 100 ? 0 : 1;
      return `${number(value, digits)} ${UNITS[unit]}`;
    },
    count: (n) => n.toLocaleString(locale),
    date: (s) => (s === null ? "—" : dateFmt.format(new Date(s * 1000))),
    percent: (pct) => (pct > 0 && pct < 0.1 ? `<${number(0.1, 1)}%` : `${number(pct, 1)}%`),
    seconds: (ms) => number(ms / 1000, 1),
    ago(unixMs, now = Date.now()) {
      const secs = Math.max(0, Math.round((now - unixMs) / 1000));
      if (secs < 45) return relative.format(0, "second");
      const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
        secs < 3600
          ? [Math.round(secs / 60), "minute"]
          : secs < 86_400
            ? [Math.round(secs / 3600), "hour"]
            : [Math.round(secs / 86_400), "day"];
      return relative.format(-value, unit);
    },
  };
}

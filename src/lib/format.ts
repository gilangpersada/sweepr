const UNITS = ["B", "KB", "MB", "GB", "TB"];

/** Human-readable size using 1024-based units, e.g. 1536 -> "1,5 KB". */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: digits })} ${UNITS[unit]}`;
}

export function formatCount(n: number): string {
  return n.toLocaleString("id-ID");
}

const DATE_FMT = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Unix seconds -> "3 Sep 2026", or "—" when unknown. */
export function formatDate(unixSeconds: number | null): string {
  return unixSeconds === null ? "—" : DATE_FMT.format(new Date(unixSeconds * 1000));
}

/** 12.345 -> "12,3%"; tiny non-zero values show as "<0,1%". */
export function formatPercent(pct: number): string {
  if (pct > 0 && pct < 0.1) return "<0,1%";
  return `${pct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

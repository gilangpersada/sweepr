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

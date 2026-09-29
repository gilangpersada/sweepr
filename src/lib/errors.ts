import type { CleanerError, ScanError } from "./api";

type ErrorCode = ScanError["code"] | CleanerError["code"];

const MESSAGES: Record<ErrorCode, string> = {
  notFound: "Folder atau file tidak ditemukan. Mungkin sudah dipindah atau dihapus.",
  notADirectory: "Yang dipilih bukan folder.",
  isLink: "Folder ini adalah shortcut (symlink/junction) dan tidak dipindai demi keamanan.",
  io: "Tidak bisa dibaca. Mungkin akses ditolak.",
  unknownScan: "Hasil scan sudah tidak berlaku. Silakan scan ulang.",
  unknownNode: "Item tidak ditemukan di hasil scan.",
  rulesInvalid: "Aturan pembersih rusak, jadi pembersih dimatikan. Laporkan ke pengembang.",
  unknownRule: "Aturan pembersih tidak dikenal.",
  unknownPreview: "Preview sudah tidak berlaku. Muat ulang daftar.",
  previewExpired: "Preview sudah terlalu lama (lebih dari 30 menit). Muat ulang daftar.",
  tooManyItems: "Terlalu banyak item dipilih sekaligus.",
  logUnavailable: "Log pembersihan tidak bisa ditulis, jadi tidak ada yang diubah.",
  recycleBin: "Recycle Bin tidak bisa diakses.",
  internal: "Terjadi kesalahan internal.",
};

/** Why a single cleanup item was skipped (codes from `execute_cleanup`). */
const ITEM_REASONS: Record<string, string> = {
  changed: "Berubah sejak preview dibuat",
  notFound: "Sudah tidak ada",
  isLink: "Berupa shortcut/junction",
  insideLink: "Berada di dalam shortcut/junction",
  protected: "Lokasi terlindungi",
  outsideAllowedRoots: "Di luar folder yang diizinkan",
  driveRoot: "Root drive",
  notAbsolute: "Path tidak valid",
  parentComponent: "Path tidak valid",
  io: "Tidak bisa dibaca",
  unknownItem: "Tidak ada di preview",
  recycleBinDisabled: "Recycle Bin dimatikan untuk drive ini (akan terhapus permanen)",
  recycleBinUnknown: "Recycle Bin drive ini tidak bisa dipastikan",
  tooBigForRecycleBin: "Terlalu besar untuk Recycle Bin (akan terhapus permanen)",
  trashFailed: "Gagal dipindah, mungkin sedang dipakai",
  stillExists: "Masih ada setelah dipindah",
};

function hasCode(e: unknown): e is { code: string; message: string } {
  return typeof e === "object" && e !== null && "code" in e && "message" in e;
}

/** Friendly Indonesian message for anything a command can reject with. */
export function errorMessage(e: unknown): string {
  if (hasCode(e)) return MESSAGES[e.code as ErrorCode] ?? e.message;
  return String(e);
}

export function errorCode(e: unknown): string | null {
  return hasCode(e) ? e.code : null;
}

export function itemReason(code: string): string {
  return ITEM_REASONS[code] ?? code;
}

import type { ScanError } from "./api";

const MESSAGES: Record<ScanError["code"], string> = {
  notFound: "Folder atau file tidak ditemukan. Mungkin sudah dipindah atau dihapus.",
  notADirectory: "Yang dipilih bukan folder.",
  isLink: "Folder ini adalah shortcut (symlink/junction) dan tidak dipindai demi keamanan.",
  io: "Tidak bisa dibaca. Mungkin akses ditolak.",
  unknownScan: "Hasil scan sudah tidak berlaku. Silakan scan ulang.",
  unknownNode: "Item tidak ditemukan di hasil scan.",
};

function isScanError(e: unknown): e is ScanError {
  return typeof e === "object" && e !== null && "code" in e && "message" in e;
}

/** Friendly Indonesian message for anything a command can reject with. */
export function errorMessage(e: unknown): string {
  if (isScanError(e)) return MESSAGES[e.code] ?? e.message;
  return String(e);
}

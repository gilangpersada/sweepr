// Turns backend errors (`{ code, message }`) into messages in the current language.
import type { Messages } from "./i18n";

function hasCode(e: unknown): e is { code: string; message: string } {
  return typeof e === "object" && e !== null && "code" in e && "message" in e;
}

/** Friendly message for anything a command can reject with. */
export function errorMessage(t: Messages, e: unknown): string {
  if (hasCode(e)) return t.errors[e.code] ?? e.message;
  return String(e);
}

export function errorCode(e: unknown): string | null {
  return hasCode(e) ? e.code : null;
}

/** Why one cleanup item was skipped. */
export function itemReason(t: Messages, code: string): string {
  return t.itemReasons[code] ?? code;
}

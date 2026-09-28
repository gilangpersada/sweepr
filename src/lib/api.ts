// Typed wrappers around Tauri `invoke`. Components must call these, never `invoke` directly.
import { invoke } from "@tauri-apps/api/core";

export interface PingResponse {
  message: string;
  appVersion: string;
}

export function ping(): Promise<PingResponse> {
  return invoke<PingResponse>("ping");
}

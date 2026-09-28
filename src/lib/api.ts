// Typed wrappers around Tauri `invoke` and `listen`. Components must call these, never
// `invoke` directly. Types mirror the Rust structs (serialized as camelCase).
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface PingResponse {
  message: string;
  appVersion: string;
}

export function ping(): Promise<PingResponse> {
  return invoke<PingResponse>("ping");
}

// ---------- drives ----------

export interface DriveInfo {
  name: string;
  mountPoint: string;
  fileSystem: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  isRemovable: boolean;
}

export function listDrives(): Promise<DriveInfo[]> {
  return invoke<DriveInfo[]>("list_drives");
}

// ---------- scanning ----------

export type ScanId = number;

/** Error shape returned by scan commands and the `scan-failed` event. */
export interface ScanError {
  code: "notFound" | "notADirectory" | "isLink" | "io" | "unknownScan" | "unknownNode";
  message: string;
}

export interface ScanProgressEvent {
  scanId: ScanId;
  filesSeen: number;
  dirsSeen: number;
  bytesSeen: number;
  currentPath: string;
}

export interface ScanFinishedEvent {
  scanId: ScanId;
  rootPath: string;
  rootId: number;
  totalBytes: number;
  totalFiles: number;
  nodeCount: number;
  skippedCount: number;
  elapsedMs: number;
}

export interface ScanCancelledEvent {
  scanId: ScanId;
}

export interface ScanFailedEvent {
  scanId: ScanId;
  error: ScanError;
}

export interface NodeView {
  id: number;
  name: string;
  isDir: boolean;
  size: number;
  percentOfParent: number;
  fileCount: number;
  /** Unix seconds. */
  modified: number | null;
  hasChildren: boolean;
}

export interface ChildrenPage {
  total: number;
  items: NodeView[];
}

export interface FileView extends NodeView {
  path: string;
}

export type SortBy = "size" | "name" | "modified" | "fileCount";
export type SortOrder = "asc" | "desc";

/** Starts a scan; results arrive through the `onScan*` listeners below. */
export function startScan(path: string): Promise<ScanId> {
  return invoke<ScanId>("start_scan", { path });
}

export function cancelScan(scanId: ScanId): Promise<void> {
  return invoke("cancel_scan", { scanId });
}

export function getChildren(args: {
  scanId: ScanId;
  nodeId: number;
  sortBy: SortBy;
  order: SortOrder;
  offset: number;
  limit: number;
}): Promise<ChildrenPage> {
  return invoke<ChildrenPage>("get_children", args);
}

export function getLargestFiles(scanId: ScanId, limit: number): Promise<FileView[]> {
  return invoke<FileView[]>("get_largest_files", { scanId, limit });
}

export function onScanProgress(cb: (e: ScanProgressEvent) => void): Promise<UnlistenFn> {
  return listen<ScanProgressEvent>("scan-progress", (e) => cb(e.payload));
}

export function onScanFinished(cb: (e: ScanFinishedEvent) => void): Promise<UnlistenFn> {
  return listen<ScanFinishedEvent>("scan-finished", (e) => cb(e.payload));
}

export function onScanCancelled(cb: (e: ScanCancelledEvent) => void): Promise<UnlistenFn> {
  return listen<ScanCancelledEvent>("scan-cancelled", (e) => cb(e.payload));
}

export function onScanFailed(cb: (e: ScanFailedEvent) => void): Promise<UnlistenFn> {
  return listen<ScanFailedEvent>("scan-failed", (e) => cb(e.payload));
}

// Typed wrappers around Tauri `invoke` and `listen`. Components must call these, never
// `invoke` directly. Types mirror the Rust structs (serialized as camelCase).
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

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
  code:
    | "notFound"
    | "notADirectory"
    | "isLink"
    | "io"
    | "unknownScan"
    | "unknownNode"
    | "unknownCategory";
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

// ---------- scan result queries & actions ----------

export interface CategorySize {
  /** Key from `category_extensions` in the cleaner rules (e.g. "video"), or "other". */
  key: string;
  size: number;
  fileCount: number;
}

/** File size per category below a node (recursive), largest first. */
export function getCategorySummary(scanId: ScanId, nodeId: number): Promise<CategorySize[]> {
  return invoke<CategorySize[]>("get_category_summary", { scanId, nodeId });
}

export interface FilesPage {
  total: number;
  items: FileView[];
}

/** Files of one category below a node (recursive), a page at a time (D-040). */
export function getCategoryFiles(args: {
  scanId: ScanId;
  nodeId: number;
  category: string;
  sortBy: SortBy;
  order: SortOrder;
  offset: number;
  limit: number;
}): Promise<FilesPage> {
  return invoke<FilesPage>("get_category_files", args);
}

export interface SkippedPage {
  total: number;
  /** `reason` is the OS error text (in the Windows display language). */
  items: { path: string; reason: string }[];
}

/** Entries the scan could not read (FR-2), a page at a time. */
export function getSkipped(scanId: ScanId, offset: number, limit: number): Promise<SkippedPage> {
  return invoke<SkippedPage>("get_skipped", { scanId, offset, limit });
}

/** Full path of a node, for display and "copy path" only. */
export function getNodePath(scanId: ScanId, nodeId: number): Promise<string> {
  return invoke<string>("get_node_path", { scanId, nodeId });
}

/** Opens Explorer with the node selected. Sends the node id; the backend resolves the path. */
export function revealInExplorer(scanId: ScanId, nodeId: number): Promise<void> {
  return invoke("reveal_in_explorer", { scanId, nodeId });
}

/** Native "choose folder" dialog. Resolves to `null` when the user cancels. */
export async function pickFolder(): Promise<string | null> {
  const picked = await open({ directory: true, multiple: false });
  return typeof picked === "string" ? picked : null;
}

// ---------- cleaner ----------
// Only rule ids, a preview id and item ids go to the backend; never paths.

/** Error shape of cleaner commands. */
export interface CleanerError {
  code:
    | "rulesInvalid"
    | "unknownRule"
    | "unknownPreview"
    | "previewExpired"
    | "tooManyItems"
    | "logUnavailable"
    | "recycleBin"
    | "internal";
  message: string;
}

export type Risk = "low" | "medium";

/** Section of the cleaner screen. */
export type RuleGroup = "general" | "developer";

export interface RuleInfo {
  id: string;
  name: string;
  group: RuleGroup;
  description: string;
  risk: Risk;
  defaultChecked: boolean;
}

export interface PreviewItem {
  itemId: number;
  /** Display only. */
  path: string;
  isDir: boolean;
  size: number;
  /** Unix seconds. */
  modified: number | null;
  /** node_modules-style rules: when the project last changed (what the age check uses). */
  projectModified: number | null;
}

export interface RulePreview extends RuleInfo {
  /** Largest first. */
  items: PreviewItem[];
  totalBytes: number;
  truncated: boolean;
  excludedCount: number;
  unreadableCount: number;
  rootProblems: string[];
}

export interface CleanupPreview {
  previewId: number;
  maxItems: number;
  rules: RulePreview[];
}

export interface FailReason {
  code: string;
  message: string;
}

export interface ItemOutcome {
  itemId: number;
  path: string;
  size: number;
  isDir: boolean;
  /** `null` when the item is now in the Recycle Bin. */
  error: FailReason | null;
}

export interface CleanupResult {
  previewId: number;
  trashedCount: number;
  trashedBytes: number;
  failedCount: number;
  items: ItemOutcome[];
}

export interface RecycleBinInfo {
  sizeBytes: number;
  itemCount: number;
}

/** What the rules checked by default would clean now. Does not replace the open preview. */
export interface CleanupEstimate {
  totalBytes: number;
  itemCount: number;
}

// ---------- Recycle Bin contents (D-039) ----------

export interface BinItem {
  itemId: number;
  /** Original name with extension. Display only, like every path here. */
  name: string;
  originalPath: string;
  /** e.g. "C:". */
  drive: string;
  size: number;
  isDir: boolean;
  /** Unix seconds. */
  deleted: number;
}

export interface BinDrive {
  drive: string;
  size: number;
  itemCount: number;
}

export interface BinListing {
  listId: number;
  /** Newest first. */
  items: BinItem[];
  drives: BinDrive[];
  unreadableCount: number;
  maxItems: number;
}

export interface RestoreOutcome {
  itemId: number;
  path: string;
  size: number;
  /** `null` when the item is back at its original location. */
  error: FailReason | null;
}

export interface RestoreResult {
  listId: number;
  restoredCount: number;
  restoredBytes: number;
  failedCount: number;
  items: RestoreOutcome[];
}

export function listRecycleBin(): Promise<BinListing> {
  return invoke<BinListing>("list_recycle_bin");
}

/** Moves items of a list back to where they were deleted from; never replaces anything. */
export function restoreFromRecycleBin(listId: number, itemIds: number[]): Promise<RestoreResult> {
  return invoke<RestoreResult>("restore_from_recycle_bin", { listId, itemIds });
}

export function estimateCleanup(): Promise<CleanupEstimate> {
  return invoke<CleanupEstimate>("estimate_cleanup");
}

export function listCleanerRules(): Promise<RuleInfo[]> {
  return invoke<RuleInfo[]>("list_cleaner_rules");
}

export function previewCleanup(ruleIds: string[]): Promise<CleanupPreview> {
  return invoke<CleanupPreview>("preview_cleanup", { ruleIds });
}

export function executeCleanup(previewId: number, itemIds: number[]): Promise<CleanupResult> {
  return invoke<CleanupResult>("execute_cleanup", { previewId, itemIds });
}

export function getRecycleBinInfo(): Promise<RecycleBinInfo> {
  return invoke<RecycleBinInfo>("get_recycle_bin_info");
}

/** Permanently empties the Recycle Bin. Always confirm with the user first. */
export function emptyRecycleBin(): Promise<void> {
  return invoke("empty_recycle_bin");
}

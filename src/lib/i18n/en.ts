// English. Must match the shape of `id.ts` (enforced by the `Messages` type).
import type { Messages } from "./id";

const plural = (one: string, many: string) => (count: number) => (count === 1 ? one : many);

export const en: Messages = {
  languageName: "English",

  units: {
    items: plural("item", "items"),
    files: plural("file", "files"),
    folders: plural("folder", "folders"),
  },

  common: {
    cancel: "Cancel",
    close: "Close",
    retry: "Try again",
    loading: "Loading…",
    processing: "Working…",
    refresh: "Reload",
  },

  nav: {
    label: "Main menu",
    home: "Home",
    results: "Scan results",
    resultsHint: "Scan a drive or folder first",
    cleaner: "Cleaner",
    recycleBin: "Recycle Bin",
    settings: "Settings",
    scanning: "Scanning…",
    cancelScan: "Cancel scan",
  },

  splash: {
    loading: "Loading Sweepr…",
    failed: (reason: string) => `Sweepr could not load the list of drives. ${reason}`,
  },

  home: {
    tagline: "See what is using your disk space, then clean it up safely.",
    drives: "Drives",
    loadingDrives: "Loading drives…",
    noDrives: "No drives found.",
    folder: "Folder",
    chooseFolder: "Choose folder…",
    cleaner: "Cleaner",
    cleanerIntro:
      "Find temporary files, old installers and unused node_modules, then move them to the Recycle Bin after you review them.",
    openCleaner: "Open Cleaner",
    scanCancelled: "Scan cancelled.",
    scanFailed: (reason: string) => `Scan failed: ${reason}`,
    lastResult: "Last scan result",
    openResult: "View results",
  },

  drive: {
    used: (size: string) => `${size} used`,
    free: (free: string, total: string) => `${free} free of ${total}`,
    removable: "removable",
    usedLabel: (drive: string) => `${drive} used`,
  },

  progress: {
    scanning: (path: string) => `Scanning ${path}`,
    starting: "Starting…",
  },

  result: {
    finishedIn: (seconds: string) => `done in ${seconds} s`,
    unreadable: (items: string) => `${items} could not be read`,
    unreadableHint: "Usually system folders where access is denied. Their size is not counted.",
    showList: "Show list",
    rescan: "Scan again",
    tabsLabel: "Result views",
    tabFolders: "Folders",
    tabLargest: "Largest files",
    tabCategories: "Categories",
  },

  skipped: {
    title: "Items that could not be read",
    intro:
      "These folders and files were skipped during the scan, usually because Windows denied access. Their size is not counted.",
    empty: "Nothing was skipped.",
  },

  breadcrumb: {
    label: "Folder location",
    up: "Up one folder",
    upHint: "Up one folder (Backspace)",
  },

  categories: {
    label: "Category summary",
    empty: "This folder has no files.",
    category: "Category",
    share: "Share",
    files: "Files",
    names: {
      video: "Video",
      photo: "Photos",
      audio: "Audio",
      document: "Documents",
      archive: "Archives",
      installer: "Installers",
      code: "Code",
      other: "Other",
    },
  },

  table: {
    name: "Name",
    size: "Size",
    percent: "% of folder",
    files: "Files",
    modified: "Modified",
    actions: "Actions",
    loadingRow: "Loading…",
    emptyFolder: "This folder is empty.",
    nameAndLocation: "Name & location",
    noFiles: "No files.",
  },

  actions: {
    reveal: "Show in Explorer",
    copyPath: "Copy path",
    copied: "Path copied",
    copyFailed: (reason: string) => `Could not copy the path: ${reason}`,
  },

  cleaner: {
    title: "Cleaner",
    reload: "Reload",
    searching: "Looking for files to clean… (this can take a few seconds)",
    groupGeneral: "General",
    groupDeveloper: "Developer cache",
    groupDeveloperHint:
      "For developers: folders a project can rebuild (e.g. npm install). Never checked automatically; projects you are still working on are left out.",
    selected: "Selected:",
    tooMany: (max: string) => `At most ${max} items per run.`,
    next: "Continue to confirmation",
    confirmTitle: "Move to the Recycle Bin?",
    confirmButton: "Move to Recycle Bin",
    confirmLead: (items: string, size: string) =>
      `${items} totalling ${size} will be moved to the Recycle Bin.`,
    confirmNote:
      "You can still restore them from the Recycle Bin. Disk space is freed once the Recycle Bin is emptied. Items that changed since this list was made are skipped.",
    nothingFound: "Nothing to clean right now.",
  },

  rule: {
    riskLow: "Low risk",
    riskMedium: "Medium risk",
    selectAll: (name: string) => `Select all: ${name}`,
    truncated: (count: string) => `Only the ${count} largest items are shown.`,
    excluded: (items: string) => `${items} left out for safety.`,
    unreadable: (count: string) => `${count} folders/files could not be read.`,
    rootProblems: (count: number) =>
      `${count} ${count === 1 ? "location" : "locations"} skipped (missing or protected).`,
    selectedPart: (size: string) => `${size} selected`,
    showDetails: "Show details",
    hideDetails: "Hide details",
    filter: "Filter list…",
    filtered: (shown: string, total: string) => `${shown} of ${total}`,
    noMatch: "No matches.",
    projectModified: (date: string) =>
      `Project last changed ${date}. The project's age is what counts, not this folder's date.`,
    names: {
      "user-temp": {
        name: "Temporary files",
        description: "Files in your Temp folder that have not changed for a while.",
      },
      "old-installers": {
        name: "Old installers in Downloads",
        description: "Installer and archive files in Downloads untouched for more than 30 days.",
      },
      "stale-node-modules": {
        name: "node_modules of old projects",
        description:
          "node_modules folders in JavaScript/TypeScript projects unchanged for more than 60 days (searched in your user folder, Desktop and Documents). npm install rebuilds them.",
      },
    },
  },

  recycleBin: {
    title: "Recycle Bin",
    loading: "Loading Recycle Bin info…",
    size: "Size",
    items: "Contents",
    isEmpty: "The Recycle Bin is already empty.",
    explain:
      "Cleaned files are moved here and can still be restored. Disk space is only freed once the Recycle Bin is emptied.",
    empty: "Empty Recycle Bin…",
    confirmTitle: "Empty the Recycle Bin?",
    confirmButton: "Delete permanently",
    confirmLead: (items: string, size: string) =>
      `Everything in the Recycle Bin on all drives (${items}, ${size}) will be deleted permanently, including files you deleted yourself outside Sweepr.`,
    cannotUndo: "This cannot be undone.",
  },

  settings: {
    title: "Settings",
    language: "Language",
    theme: "Theme",
    themeSystem: "Follow system",
    themeLight: "Light",
    themeDark: "Dark",
    themeHint: "“Follow system” uses the Windows light/dark setting.",
    about: "About",
    version: (v: string) => `Version ${v}`,
    localOnly: "Everything runs on this computer. No data is sent to the internet.",
  },

  cleanupResult: {
    moved: (items: string, size: string) => `${items} (${size}) moved to the Recycle Bin.`,
    restoreNote:
      "You can still restore them from the Recycle Bin. Empty the Recycle Bin to actually free the space.",
    skippedTitle: (items: string) => `${items} skipped`,
    done: "Done",
  },

  errors: {
    notFound: "The folder or file was not found. It may have been moved or deleted.",
    notADirectory: "That is not a folder.",
    isLink: "This folder is a shortcut (symlink/junction) and is not scanned, for safety.",
    io: "Could not be read. Access may be denied.",
    unknownScan: "This scan result is no longer valid. Please scan again.",
    unknownNode: "The item was not found in the scan result.",
    rulesInvalid: "The cleaner rules are broken, so the cleaner is turned off. Please report this.",
    unknownRule: "Unknown cleaner rule.",
    unknownPreview: "This list is no longer valid. Reload it.",
    previewExpired: "This list is too old (more than 30 minutes). Reload it.",
    tooManyItems: "Too many items selected at once.",
    logUnavailable: "The cleanup log could not be written, so nothing was changed.",
    recycleBin: "The Recycle Bin could not be accessed.",
    internal: "An internal error occurred.",
  },

  itemReasons: {
    changed: "Changed since the list was made",
    notFound: "No longer there",
    isLink: "Is a shortcut/junction",
    insideLink: "Inside a shortcut/junction",
    protected: "Protected location",
    outsideAllowedRoots: "Outside the allowed folders",
    driveRoot: "Drive root",
    notAbsolute: "Invalid path",
    parentComponent: "Invalid path",
    io: "Could not be read",
    unknownItem: "Not in this list",
    recycleBinDisabled: "Recycle Bin is turned off for this drive (would be deleted permanently)",
    recycleBinUnknown: "Could not confirm this drive has a Recycle Bin",
    tooBigForRecycleBin: "Too large for the Recycle Bin (would be deleted permanently)",
    trashFailed: "Could not be moved, it may be in use",
    stillExists: "Still there after moving",
  },
};

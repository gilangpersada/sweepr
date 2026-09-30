// Bahasa Indonesia. This file defines the shape of every language: `en.ts` must match it
// (the type check fails on a missing or extra key). Numbers, sizes and dates are formatted
// by the caller and passed in as strings.

/** Noun for a count; Indonesian has no plural form, English does ("1 file", "2 files"). */
type Plural = (count: number) => string;

export const id = {
  languageName: "Bahasa Indonesia",

  units: {
    items: (() => "item") as Plural,
    files: (() => "file") as Plural,
    folders: (() => "folder") as Plural,
  },

  common: {
    cancel: "Batal",
    close: "Tutup",
    retry: "Coba lagi",
    loading: "Memuat…",
    processing: "Memproses…",
    refresh: "Muat ulang",
  },

  nav: {
    label: "Menu utama",
    home: "Beranda",
    results: "Hasil Scan",
    resultsHint: "Scan drive atau folder dulu",
    cleaner: "Pembersih",
    recycleBin: "Recycle Bin",
    settings: "Pengaturan",
    scanning: "Memindai…",
    cancelScan: "Batalkan scan",
  },

  splash: {
    loading: "Memuat Sweepr…",
    failed: (reason: string) => `Sweepr belum bisa memuat daftar drive. ${reason}`,
  },

  home: {
    tagline: "Lihat apa yang memakan ruang disk, lalu bersihkan dengan aman.",
    drives: "Drive",
    loadingDrives: "Memuat drive…",
    noDrives: "Tidak ada drive yang terdeteksi.",
    folder: "Folder",
    chooseFolder: "Pilih folder…",
    cleaner: "Pembersih",
    cleanerIntro:
      "Temukan file sementara, installer lama, dan node_modules yang tidak terpakai, lalu pindahkan ke Recycle Bin setelah Anda periksa.",
    openCleaner: "Buka Pembersih",
    scanCancelled: "Scan dibatalkan.",
    scanFailed: (reason: string) => `Scan gagal: ${reason}`,
    lastResult: "Hasil scan terakhir",
    openResult: "Lihat hasil",
  },

  drive: {
    used: (size: string) => `${size} terpakai`,
    free: (free: string, total: string) => `${free} sisa dari ${total}`,
    removable: "removable",
    usedLabel: (drive: string) => `${drive} terpakai`,
  },

  progress: {
    scanning: (path: string) => `Memindai ${path}`,
    starting: "Memulai…",
  },

  result: {
    finishedIn: (seconds: string) => `selesai dalam ${seconds} detik`,
    unreadable: (items: string) => `${items} tidak bisa dibaca`,
    unreadableHint: "Biasanya folder sistem yang aksesnya ditolak. Ukurannya tidak dihitung.",
    showList: "Lihat daftar",
    rescan: "Scan ulang",
    tabsLabel: "Tampilan hasil",
    tabFolders: "Folder",
    tabLargest: "File Terbesar",
    tabCategories: "Kategori",
  },

  skipped: {
    title: "Item yang tidak bisa dibaca",
    intro:
      "Folder dan file ini dilewati saat scan, biasanya karena akses ditolak oleh Windows. Ukurannya tidak ikut dihitung.",
    empty: "Tidak ada item yang dilewati.",
  },

  breadcrumb: {
    label: "Lokasi folder",
    up: "Naik satu folder",
    upHint: "Naik satu folder (Backspace)",
  },

  categories: {
    label: "Ringkasan kategori",
    empty: "Folder ini tidak berisi file.",
    category: "Kategori",
    share: "Bagian",
    files: "File",
    names: {
      video: "Video",
      photo: "Foto",
      audio: "Audio",
      document: "Dokumen",
      archive: "Arsip",
      installer: "Installer",
      code: "Kode",
      other: "Lainnya",
    } as Record<string, string>,
  },

  table: {
    name: "Nama",
    size: "Ukuran",
    percent: "% dari folder",
    files: "File",
    modified: "Diubah",
    actions: "Aksi",
    loadingRow: "Memuat…",
    emptyFolder: "Folder ini kosong.",
    nameAndLocation: "Nama & lokasi",
    noFiles: "Tidak ada file.",
  },

  actions: {
    reveal: "Buka di Explorer",
    copyPath: "Salin path",
    copied: "Path disalin",
    copyFailed: (reason: string) => `Gagal menyalin path: ${reason}`,
  },

  cleaner: {
    title: "Pembersih",
    reload: "Muat ulang",
    searching: "Mencari file yang bisa dibersihkan… (bisa beberapa detik)",
    groupGeneral: "Umum",
    groupDeveloper: "Cache Developer",
    groupDeveloperHint:
      "Untuk developer: folder yang bisa dibuat ulang dari project (mis. npm install). Tidak dicentang otomatis; project yang masih aktif tidak ikut.",
    selected: "Dipilih:",
    tooMany: (max: string) => `Maksimal ${max} item sekali jalan.`,
    next: "Lanjut ke konfirmasi",
    confirmTitle: "Pindahkan ke Recycle Bin?",
    confirmButton: "Pindahkan ke Recycle Bin",
    confirmLead: (items: string, size: string) =>
      `${items} dengan total ${size} akan dipindah ke Recycle Bin.`,
    confirmNote:
      "Item masih bisa dipulihkan dari Recycle Bin. Ruang disk baru kosong setelah Recycle Bin dikosongkan. Item yang berubah sejak daftar ini dibuat akan dilewati.",
    nothingFound: "Tidak ada yang perlu dibersihkan saat ini.",
  },

  rule: {
    riskLow: "Risiko rendah",
    riskMedium: "Risiko sedang",
    selectAll: (name: string) => `Pilih semua: ${name}`,
    truncated: (count: string) => `Hanya ${count} item terbesar ditampilkan.`,
    excluded: (items: string) => `${items} dikecualikan demi keamanan.`,
    unreadable: (count: string) => `${count} folder/file tidak bisa dibaca.`,
    rootProblems: (count: number) => `${count} lokasi dilewati (tidak ada atau terlindungi).`,
    selectedPart: (size: string) => `dipilih ${size}`,
    showDetails: "Lihat detail",
    hideDetails: "Sembunyikan detail",
    filter: "Cari di daftar…",
    filtered: (shown: string, total: string) => `${shown} dari ${total}`,
    noMatch: "Tidak ada yang cocok.",
    projectModified: (date: string) =>
      `Project terakhir diubah ${date}. Umur project inilah yang dinilai, bukan tanggal folder ini.`,
    /** Translations of the rules in `config/cleaner-rules.<os>.json`, by rule id. */
    names: {} as Record<string, { name: string; description: string }>,
  },

  recycleBin: {
    title: "Recycle Bin",
    loading: "Memuat info Recycle Bin…",
    size: "Ukuran",
    items: "Isi",
    isEmpty: "Recycle Bin sudah kosong.",
    explain:
      "File yang dibersihkan dipindah ke sini dan masih bisa dipulihkan. Ruang disk baru benar-benar kosong setelah Recycle Bin dikosongkan.",
    empty: "Kosongkan Recycle Bin…",
    confirmTitle: "Kosongkan Recycle Bin?",
    confirmButton: "Hapus permanen",
    confirmLead: (items: string, size: string) =>
      `Semua isi Recycle Bin di semua drive (${items}, ${size}) akan dihapus permanen, termasuk file yang Anda buang sendiri di luar Sweepr.`,
    cannotUndo: "Tindakan ini tidak bisa dibatalkan.",
  },

  settings: {
    title: "Pengaturan",
    language: "Bahasa",
    theme: "Tema",
    themeSystem: "Ikut sistem",
    themeLight: "Terang",
    themeDark: "Gelap",
    themeHint: "“Ikut sistem” mengikuti pengaturan terang/gelap Windows.",
    about: "Tentang",
    version: (v: string) => `Versi ${v}`,
    localOnly: "Semua proses berjalan di komputer ini. Tidak ada data yang dikirim ke internet.",
  },

  cleanupResult: {
    moved: (items: string, size: string) => `${items} (${size}) dipindah ke Recycle Bin.`,
    restoreNote:
      "Masih bisa dipulihkan dari Recycle Bin. Kosongkan Recycle Bin untuk benar-benar membebaskan ruang.",
    skippedTitle: (items: string) => `${items} dilewati`,
    done: "Selesai",
  },

  /** Messages for error codes returned by the backend (`{ code, message }`). */
  errors: {
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
  } as Record<string, string>,

  /** Why one cleanup item was skipped (codes from `execute_cleanup`). */
  itemReasons: {
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
  } as Record<string, string>,
};

export type Messages = typeof id;

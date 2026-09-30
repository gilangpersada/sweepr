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
    scan: "Scan",
    results: "Hasil Scan",
    resultsHint: "Scan drive atau folder dulu",
    cleaner: "Pembersih",
    recycleBin: "Recycle Bin",
    settings: "Pengaturan",
    scanning: "Memindai…",
    cancelScan: "Batalkan scan",
    /** Short line under each menu item: what is in there. */
    hints: {
      home: "Ringkasan & aksi cepat",
      scan: "Pilih drive atau folder",
      results: "Folder, file, kategori",
      cleaner: "File sementara & cache",
      recycleBin: "Pulihkan atau kosongkan",
      settings: "Bahasa & tema",
    },
  },

  splash: {
    loading: "Memuat Sweepr…",
    failed: (reason: string) => `Sweepr belum bisa memuat daftar drive. ${reason}`,
  },

  home: {
    tagline: "Lihat apa yang memakan ruang disk, lalu bersihkan dengan aman.",
    now: "Kondisi sekarang",
    fullestDrive: "Drive paling penuh",
    noDrives: "Tidak ada drive yang terdeteksi.",
    binTitle: "Recycle Bin",
    binTaking: (items: string) => `${items} · masih memakan ruang`,
    binEmpty: "Kosong",
    lastScan: "Scan terakhir",
    noScan: "Belum ada scan",
    scanningNow: "Sedang memindai…",
    whatNext: "Mau apa?",
    step1Title: "Scan",
    step1Text: "Cari tahu folder dan file apa yang paling besar.",
    step1Button: "Mulai scan",
    step2Title: "Lihat hasil",
    step2Text: "Telusuri folder, file terbesar, dan kategori dari scan terakhir.",
    step2Button: "Buka hasil",
    step2Disabled: "Scan dulu untuk melihat hasil.",
    step3Title: "Bersihkan",
    step3Text:
      "File sementara, installer lama, dan node_modules lama. Anda periksa dulu sebelum dipindah.",
    step3Button: "Buka Pembersih",
    estimate: (size: string) => `± ${size} bisa dibersihkan`,
    estimating: "Menghitung…",
    estimateNone: "Saat ini tidak ada yang perlu dibersihkan.",
    step4Title: "Kosongkan",
    step4Text: (size: string) =>
      `Recycle Bin masih memakan ${size}. Mengosongkan = hapus permanen, tidak bisa dibatalkan.`,
    step4Empty: "Recycle Bin sudah kosong.",
    step4Button: "Buka Recycle Bin",
    safety:
      "Sweepr hanya memindahkan file ke Recycle Bin. Hapus permanen hanya lewat “Kosongkan Recycle Bin”.",
  },

  scan: {
    title: "Scan",
    intro:
      "Pilih drive atau folder untuk melihat apa yang memakan ruang. Scan hanya membaca, tidak mengubah apa pun.",
    drives: "Drive",
    driveHint: "Klik kartu drive untuk mulai scan.",
    loadingDrives: "Memuat drive…",
    noDrives: "Tidak ada drive yang terdeteksi.",
    folder: "Folder",
    folderHint: "Scan satu folder saja, lebih cepat daripada seluruh drive.",
    chooseFolder: "Pilih folder…",
    scanCancelled: "Scan dibatalkan.",
    scanFailed: (reason: string) => `Scan gagal: ${reason}`,
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
    hint: "Klik kategori untuk melihat file-nya.",
    segment: (label: string, size: string, percent: string, files: string) =>
      `${label}: ${size} · ${percent} · ${files}`,
    showFiles: (label: string) => `Lihat file ${label}`,
    back: "← Semua kategori",
    filesOf: (label: string) => `File ${label}`,
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
    open: "Buka file",
    openBlocked: "File ini menjalankan program, jadi hanya bisa dibuka di Explorer.",
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
    listTitle: "Isi Recycle Bin",
    loadingList: "Memuat isi Recycle Bin…",
    search: "Cari nama atau lokasi…",
    allDrives: "Semua drive",
    drivesLabel: "Filter drive",
    colName: "Nama",
    colLocation: "Lokasi asal",
    colDrive: "Drive",
    colSize: "Ukuran",
    colDeleted: "Dihapus",
    selectAll: "Pilih semua yang tampil",
    selectItem: (name: string) => `Pilih ${name}`,
    selected: "Dipilih:",
    noMatch: "Tidak ada yang cocok.",
    unreadable: (count: string) =>
      `${count} item tidak bisa dibaca catatannya, jadi tidak ditampilkan dan tidak bisa dipulihkan dari sini.`,
    restore: "Pulihkan…",
    restoreTitle: "Pulihkan ke lokasi asal?",
    restoreButton: "Pulihkan",
    restoreLead: (items: string, size: string) =>
      `${items} (${size}) akan dikembalikan ke lokasi asalnya.`,
    restoreNote:
      "Item yang lokasi asalnya sudah terisi akan dilewati. Tidak ada file yang ditimpa atau diganti nama.",
    restored: (items: string, size: string) => `${items} (${size}) sudah dikembalikan.`,
    restoreSkipped: (items: string) => `${items} dilewati`,
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

  /** Why one Recycle Bin item was not restored (codes from `restore_from_recycle_bin`). */
  restoreReasons: {
    notFound: "Sudah tidak ada di Recycle Bin",
    changed: "Berubah sejak daftar dibuat",
    originalExists: "Lokasi asal sudah terisi",
    originalFolderMissing: "Folder asalnya sudah tidak ada",
    insideLink: "Folder asal berupa shortcut/junction",
    notAbsolute: "Lokasi asal tidak valid",
    io: "Tidak bisa dibaca",
    restoreFailed: "Gagal dipulihkan, mungkin sedang dipakai",
    unknownItem: "Tidak ada di daftar",
  } as Record<string, string>,

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
    unknownCategory: "Kategori tidak dikenal.",
    notAFile: "Hanya file yang bisa dibuka.",
    executable:
      "File ini menjalankan program, jadi tidak dibuka dari Sweepr. Gunakan “Buka di Explorer”.",
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

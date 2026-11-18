// Attendance rules Sulo knows. The campus minimum attendance is not
// verified yet (docs/ATURAN-AKADEMIK.md, "batas kehadiran minimal"): while
// it is null, Sulo shows numbers only, with no color, label or
// notification about a limit.
export const MIN_ATTENDANCE_PERCENT: number | null = null;

/** Attendance pages are cached this long; opening the page refreshes older data once. */
export const PRESENSI_CACHE_SEC = 24 * 3600;
/** "Perbarui" on the attendance page: at most once per this long. */
export const PRESENSI_COOLDOWN_SEC = 120;

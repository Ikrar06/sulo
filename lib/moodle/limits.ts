// Request limits. Source of truth: docs/ATURAN-REQUEST.md.
// Changing any value must be deliberate and mentioned in the commit message.

export const SIKOLA_ORIGIN = 'https://sikola-v2.unhas.ac.id';

/** Max HTTP requests to SIKOLA per local day per installation, all kinds. */
export const DAILY_BUDGET = 40;
export const BACKGROUND_INTERVAL_MIN = 180;
export const POPUP_STALE_MIN = 15;
export const JITTER_MAX_MIN = 10;
export const QUIET_HOURS = { startHour: 0, endHour: 6 } as const;
export const IDLE_THRESHOLD_SEC = 300;
export const MAX_STATE_CALLS_PER_BATCH = 10;
export const REQUEST_TIMEOUT_MS = 20_000;
export const HTML_ON_DEMAND_TTL_H = 24;
export const SESSKEY_FALLBACK_POPUP_GAP_H = 6;
export const STALE_WARNING_H = 6;
export const COURSE_LIST_MIN_GAP_H = 24;

/** Empty means the remote kill switch is skipped. */
export const REMOTE_CONFIG_URL = '';

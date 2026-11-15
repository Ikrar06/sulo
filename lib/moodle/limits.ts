// Request limits. Every value is a deliberate project limit: changing one needs
// discussion in an issue first and must be mentioned in the commit message.

export const SIKOLA_ORIGIN = 'https://sikola-v2.unhas.ac.id';

/** Max HTTP requests to SIKOLA per local day per installation, all kinds. */
export const DAILY_BUDGET = 40;
/** Max Moodle function calls per local day (all batches together). */
export const DAILY_CALL_BUDGET = 300;
export const BACKGROUND_INTERVAL_MIN = 180;
/** Fixed random offset per installation for the periodic alarm, 0..20 minutes. */
export const JITTER_MAX_MIN = 20;
/** Catch-up after the user returns (idle -> active) or the browser starts. */
export const CATCHUP_DELAY_MAX_MIN = 5;
export const CATCHUP_FRESH_MIN = 60;
/** Tasks, calendar and notifications are refreshed at most this often by background triggers. */
export const TASKS_TTL_MIN = 180;
/** Slack for alarm timing, so a 3-hour alarm is not skipped for being a few seconds early. */
export const TTL_TOLERANCE_MIN = 10;
/** Onboarding reuses data younger than this instead of a new request. */
export const ONBOARDING_FRESH_MIN = 5;
export const QUIET_HOURS = { startHour: 0, endHour: 6 } as const;
export const IDLE_THRESHOLD_SEC = 300;
export const MAX_STATE_CALLS_PER_BATCH = 10;
export const REQUEST_TIMEOUT_MS = 20_000;
export const HTML_ON_DEMAND_TTL_H = 24;
/** Min gap between GET /my/ for a missing sesskey (manual refresh or setup only). */
export const SESSKEY_FALLBACK_POPUP_GAP_H = 6;
export const STALE_WARNING_H = 6;
export const COURSE_LIST_MIN_GAP_H = 24;

/**
 * Backoff after consecutive failures (429, 5xx, timeout, network).
 * Failure 1 waits 3 h, failure 2 waits 6 h, failure 3 waits 12 h,
 * failure 4 and later wait 24 h each. One success resets the count.
 */
export const BACKOFF_STEPS_H = [3, 6, 12] as const;
export const BACKOFF_MAX_H = 24;

/** Remote kill switch. Empty URL means the feature is skipped. */
export const REMOTE_CONFIG_URL = 'https://ikrar06.github.io/sulo-data/config.json';
export const REMOTE_CONFIG_MIN_GAP_H = 24;

// Calendar window and page sizes used by the sync batch.
export const CALENDAR_LOOKBACK_DAYS = 14;
export const CALENDAR_LOOKAHEAD_DAYS = 90;
export const CALENDAR_LIMIT = 50;
/** Baseline fetch and the catch-up after a full page of new notifications. */
export const NOTIFICATIONS_LIMIT = 20;
/** Normal notification page once the baseline exists. */
export const NOTIFICATIONS_LIMIT_SMALL = 10;

/**
 * Low quota: the batch drops optional parts in this order. Session and
 * calendar stay until the budget itself refuses the request.
 */
export const QUOTA_LOW = { posts: 10, calls: 60 } as const; // drop course structures
export const QUOTA_LOWER = { posts: 6, calls: 30 } as const; // also drop the course list re-fetch
export const QUOTA_LOWEST = { posts: 3, calls: 15 } as const; // also drop notifications

/**
 * Sends nosessionupdate=true with every batch, so Sulo's checks do not keep
 * the SIKOLA session alive (project rule: never keep a session alive).
 * Set to false only to compare behaviour while verifying.
 */
export const SEND_NOSESSIONUPDATE = true;

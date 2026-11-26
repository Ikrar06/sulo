// Request limits. Every value is a deliberate project limit: changing one needs
// discussion in an issue first and must be mentioned in the commit message.

export const SIKOLA_ORIGIN = 'https://sikola-v2.unhas.ac.id';

/**
 * Soft limit: from this many POSTs today, automatic syncs switch to saver
 * mode (session and calendar, plus notifications when due; no course
 * structures, no course list unless missing; at least SAVER_MIN_GAP_MIN
 * apart). "Perbarui" still runs a full sync.
 */
export const SOFT_DAILY_POSTS = 80;
/**
 * Hard limit, a guard against bugs only: max HTTP requests to SIKOLA per
 * local day per installation. Reached, every sync stops until the daily
 * reset. The extension says nothing (dev log only); the phone shows one calm
 * line without numbers, and reminders from stored data keep running.
 */
export const DAILY_BUDGET = 150;
/** Max Moodle function calls per local day (all batches together); same guard. */
export const DAILY_CALL_BUDGET = 1000;
/**
 * The phone's background watching ("Pantau tugas baru") stops for the day
 * at this total (all sources together), so the rest of the hard limit stays
 * for what the user does: at least ACTIVE_RESERVE. What gives way as the
 * day fills up, in order: background Radar and the 40-minute interval past
 * SOFT_DAILY_POSTS, then watching itself here, and only inside the reserve
 * the optional parts of a manual sync (QUOTA_LOW and below).
 */
export const WATCH_STOP = { posts: 100, calls: 700 } as const;
/** What is always left for active use once watching has stopped. */
export const ACTIVE_RESERVE = { posts: DAILY_BUDGET - WATCH_STOP.posts, calls: DAILY_CALL_BUDGET - WATCH_STOP.calls } as const;
/** Saver mode: automatic syncs at least this far apart. */
export const SAVER_MIN_GAP_MIN = 60;
/** Loop guard: more than `posts` POSTs within `windowSec` pauses every request for `pauseSec`, silently. */
export const LOOP_GUARD = { posts: 10, windowSec: 5 * 60, pauseSec: 30 * 60 } as const;
/** "Perbarui" within this long after a successful sync sends nothing and says "Sudah terbaru". */
export const MANUAL_COOLDOWN_SEC = 120;
/** Automatic syncs check the structure of at most this many courses, in turns. */
export const RADAR_AUTO_MAX = 4;
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
/** Sync after signing in again (M7.2): skipped when a good sync happened within this long. */
export const RELOGIN_FRESH_MIN = 10;
/** While another account is detected: at most one session-only check per this many minutes, except from "Perbarui". */
export const MISMATCH_CHECK_GAP_MIN = 10;
export const QUIET_HOURS = { startHour: 0, endHour: 6 } as const;
export const IDLE_THRESHOLD_SEC = 300;
export const MAX_STATE_CALLS_PER_BATCH = 10;
export const REQUEST_TIMEOUT_MS = 20_000;
export const HTML_ON_DEMAND_TTL_H = 24;
/** Min gap between GET /my/ for a missing sesskey (manual refresh or setup only). */
export const SESSKEY_FALLBACK_POPUP_GAP_H = 6;
export const STALE_WARNING_H = 12;
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
/** Academic calendar from the same public repository (lib/calendar/remote.ts), at most once a day. */
export const CALENDAR_URL = 'https://ikrar06.github.io/sulo-data/calendar/latest.json';

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
 * calendar stay until the budget itself refuses the request. All three lie
 * inside ACTIVE_RESERVE: a manual sync is never trimmed while more than the
 * reserve is left (tested).
 */
export const QUOTA_LOW = { posts: 10, calls: 60 } as const; // drop course structures
export const QUOTA_LOWER = { posts: 6, calls: 30 } as const; // also drop the course list re-fetch
export const QUOTA_LOWEST = { posts: 3, calls: 15 } as const; // also drop notifications

/**
 * Sends nosessionupdate=true with every batch by default, so an ordinary
 * sync does not extend the SIKOLA session. The extension's "Pantau tugas
 * baru" checks (trigger watch or popup, only while the user has it on) are
 * the exception: they pass RequestOptions.keepSession (owner's decision,
 * 26 Nov 2026; docs/ATURAN-REQUEST.md rule 13). Set to false only to compare
 * behaviour while verifying.
 */
export const SEND_NOSESSIONUPDATE = true;

/**
 * "Pantau tugas baru" in the extension (1.1.0): one light check every
 * `activeMinutes` while the computer is in use, every `idleMinutes` while it
 * is idle, none while it is locked or between 00.00 and 06.00. Opening the
 * popup checks too when the last check is older than `popupFreshMinutes`.
 * The remote config may slow these down within `limits`, never speed them up.
 */
export const EXTENSION_WATCH = {
  activeMinutes: 15,
  idleMinutes: 30,
  popupFreshMinutes: 2,
  /** An alarm a few seconds early still counts as due. */
  slackMinutes: 1,
  limits: { activeMinutes: { min: 15, max: 60 }, idleMinutes: { min: 30, max: 110 } },
} as const;

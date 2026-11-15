// Brand constants used outside CSS (e.g. chrome.notifications in M3).
// Paths are relative to the extension root (files under public/).

/** System notifications use the 128 px tile icon. */
export const NOTIFICATION_ICON = '/icon/icon-128.png';

/** Badge background colors (chrome.action needs literal values). */
export const BADGE_COLORS = {
  urgent: '#B91C1C',
  neutral: '#5F5F6B',
  expired: '#B91C1C',
} as const;

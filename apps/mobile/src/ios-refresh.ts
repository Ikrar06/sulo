// "Sulo perlu disegarkan besok" (iPhone, owner's decision of 26 Nov 2026, docs/ios/PENILAIAN-IOS.md C2):
// one silent notification a day before the app's 7-day profile ends, read from the app's own bundle
// (native AppProfile). Never inside quiet hours; off with the "refreshReminder" switch. Pure apart from
// the zone helpers.
import { localParts, zonedToUnix } from '@sulo/core/reminders/zoned';

export const REFRESH_NOTICE_PREFIX = 'refresh|';
const DAY = 86_400;

export interface Quiet {
  enabled: boolean;
  startMin: number;
  endMin: number;
}

function insideQuiet(min: number, q: Quiet): boolean {
  if (!q.enabled || q.startMin === q.endMin) return false;
  return q.startMin < q.endMin ? min >= q.startMin && min < q.endMin : min >= q.startMin || min < q.endMin;
}

/** When to tell: a day before the expiry, moved to the end of quiet hours when it falls inside them; null when already past. */
export function refreshNoticeAt(expiresAt: number, now: number, timeZone: string, quiet: Quiet): number | null {
  let at = expiresAt - DAY;
  const p = localParts(at, timeZone);
  if (insideQuiet(p.minuteOfDay, quiet)) {
    // The end of quiet hours that follows: today's when it is still ahead, else tomorrow's.
    const today = zonedToUnix(p.dateKey, quiet.endMin, timeZone);
    at = today > at ? today : zonedToUnix(localParts(at + DAY, timeZone).dateKey, quiet.endMin, timeZone);
  }
  if (at >= expiresAt || at <= now) return null;
  return at;
}

// How a session row reads on screen: SIKOLA's time range in Sulo's clock
// format, and SIKOLA's own system remarks in the interface language. Text
// that is not recognized is shown as SIKOLA wrote it.

import { formatMinuteRange } from '../format/time';
import { parseTimeRange } from './parse';

/** "10:20AM - 12PM" -> "10.20–12.00" (id) or "10:20 AM–12:00 PM" (en); else the original. */
export function sessionTimeText(raw: string, locale: 'id' | 'en'): string {
  const range = parseTimeRange(raw);
  return range ? formatMinuteRange(range.start, range.end, locale) : raw;
}

/** Remarks Moodle writes itself (not a teacher's note). */
const SYSTEM_REMARKS: { re: RegExp; id: string }[] = [{ re: /^self[- ]?recorded\.?$/i, id: 'Dicatat sendiri' }];

/** A system remark in Indonesian for id; a teacher's own words stay as written. */
export function remarkText(raw: string, locale: 'id' | 'en'): string {
  if (locale === 'en') return raw;
  return SYSTEM_REMARKS.find((r) => r.re.test(raw.trim()))?.id ?? raw;
}

// Reads the all-day events of the Unhas calendar ICS. Pure. Only what the
// converter needs: SUMMARY, DESCRIPTION, DTSTART and DTEND (VALUE=DATE).
// The Unhas UID is ignored on purpose: it is a position in the list and
// shifts when the list changes (docs/KALENDER-AKADEMIK.md).

import { addDays, fromBasic } from './dates.ts';

export interface IcsEvent {
  summary: string;
  description: string;
  /** Inclusive local dates. */
  mulai: string;
  selesai: string;
  /** "perkiraan bulan." at the start of DESCRIPTION. */
  perkiraan: boolean;
}

/** RFC 5545 unfolding and text unescaping. */
export function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

export function unescapeText(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

export function parseIcsEvents(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: Record<string, string> | null = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') current = {};
    else if (line === 'END:VEVENT' && current) {
      events.push(toEvent(current));
      current = null;
    } else if (current) {
      const colon = line.indexOf(':');
      if (colon > 0) current[line.slice(0, colon).split(';')[0]!.toUpperCase()] = line.slice(colon + 1);
    }
  }
  return events;
}

function toEvent(props: Record<string, string>): IcsEvent {
  const start = props.DTSTART ?? '';
  const end = props.DTEND ?? '';
  if (!/^\d{8}$/.test(start) || !/^\d{8}$/.test(end)) throw new Error(`not an all-day event: ${props.SUMMARY ?? '?'}`);
  const description = unescapeText(props.DESCRIPTION ?? '');
  return {
    summary: unescapeText(props.SUMMARY ?? '').trim(),
    description,
    mulai: fromBasic(start),
    // ICS DTEND is exclusive; the data keeps inclusive ends.
    selesai: addDays(fromBasic(end), -1),
    perkiraan: /^perkiraan bulan/i.test(description.trim()),
  };
}

// MKPK notifications (1.1.0, docs/mkpk/RENCANA-RINCI.md E), decided purely:
//
// - a: an MKPK course in the KRS not passed in Sipakamase, from 30 days
//      before the academic calendar's "batas akhir penginputan nilai";
// - c: a course passed in Sipakamase but not programmed, while the KRS
//      window of the academic calendar is open;
// - news: an activity's status changed in Sipakamase.
//
// Each a and c notice goes out once per course and per deadline or window;
// news once. Nothing while "Pengingat MKPK" is off or in quiet hours (news
// waits in its queue). At most three notifications in one run.

import type { Kegiatan } from '../calendar/schema';
import type { SipakamaseNews } from '../sipakamase/store';
import type { MkpkReminder } from './reminders';

export const MKPK_NOTICE_SENT_KEY = 'sipakamase:noticeSent';
/** Days before the grade-entry deadline when item a starts to notify. */
export const GRADE_DEADLINE_LEAD_DAYS = 30;
const MAX_PER_RUN = 3;

export interface MkpkNoticeWords {
  title: string;
  a: (name: string, days: number) => string;
  c: (name: string) => string;
  news: (name: string, to: string) => string;
}

export interface MkpkNotice {
  key: string;
  title: string;
  body: string;
}

export interface MkpkNoticeInput {
  enabled: boolean;
  quiet: boolean;
  today: string;
  reminders: MkpkReminder[];
  news: SipakamaseNews[];
  kegiatan: readonly Kegiatan[];
  /** Keys already notified (a and c), with the day they went out. */
  sent: Readonly<Record<string, string>>;
  words: MkpkNoticeWords;
}

export interface MkpkNoticeResult {
  show: MkpkNotice[];
  sent: Record<string, string>;
  /** News that went out (the caller removes them from the queue). */
  newsShown: number;
}

const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** The next grade-entry deadline from today on, in Sulo's academic calendar. */
export function nextGradeDeadline(kegiatan: readonly Kegiatan[], today: string): string | null {
  const ends = kegiatan
    .filter((k) => k.kategori === 'nilai' && k.id.includes('batas-akhir-penginputan-nilai'))
    .map((k) => k.selesai ?? k.mulai)
    .filter((d) => d >= today)
    .sort();
  return ends[0] ?? null;
}

/** The KRS window open today, by its start date. */
export function openKrsWindow(kegiatan: readonly Kegiatan[], today: string): string | null {
  const open = kegiatan.find((k) => k.kategori === 'krs' && k.mulai <= today && (k.selesai ?? k.mulai) >= today);
  return open ? open.mulai : null;
}

export function mkpkNotices(input: MkpkNoticeInput): MkpkNoticeResult {
  const sent = { ...input.sent };
  if (!input.enabled || input.quiet) return { show: [], sent, newsShown: 0 };
  const show: MkpkNotice[] = [];
  const w = input.words;

  let newsShown = 0;
  for (const n of input.news) {
    if (show.length >= MAX_PER_RUN) break;
    show.push({ key: `news:${n.at}:${n.name}`, title: w.title, body: w.news(n.name, n.to) });
    newsShown += 1;
  }

  const deadline = nextGradeDeadline(input.kegiatan, input.today);
  const days = deadline ? dayDiff(input.today, deadline) : null;
  const krs = openKrsWindow(input.kegiatan, input.today);
  for (const r of input.reminders) {
    if (show.length >= MAX_PER_RUN) break;
    let key: string | null = null;
    let body = '';
    if (r.kind === 'a' && deadline && days !== null && days <= GRADE_DEADLINE_LEAD_DAYS) {
      key = `a:${deadline}:${r.name}`;
      body = w.a(r.name, days);
    } else if (r.kind === 'c' && krs) {
      key = `c:${krs}:${r.name}`;
      body = w.c(r.name);
    }
    if (key === null || sent[key]) continue;
    sent[key] = input.today;
    show.push({ key, title: w.title, body });
  }
  return { show, sent, newsShown };
}

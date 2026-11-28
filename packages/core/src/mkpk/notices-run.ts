// One run of the MKPK notifications (notices.ts) against storage: shared by
// the extension (after each reminders cycle) and the phone. No request.

import { readCalendar } from '../calendar/remote';
import type { Locale } from '../i18n';
import { sipakamaseWords } from '../i18n/sipakamase';
import { readSnapshots, snapshotKey } from '../neosia/store';
import { readModuleState } from '../neosia/module';
import { readPrefs } from '../prefs';
import { localParts } from '../reminders/zoned';
import { readSipakamaseModule } from '../sipakamase/module';
import { readSipakamaseData, SIPAKAMASE_NEWS_KEY, type SipakamaseNews } from '../sipakamase/store';
import type { KeyValueStore, UnixSeconds } from '../types';
import { MKPK_NOTICE_SENT_KEY, mkpkNotices } from './notices';
import { mkpkProgress } from './progress';
import { mkpkReminders } from './reminders';
import { readMkpkTranscript } from './transcript';

export interface NoticeRunDeps {
  store: KeyValueStore;
  now: UnixSeconds;
  timeZone: string;
  locale: Locale;
  show: (id: string, title: string, body: string) => Promise<void>;
}

const inQuiet = (minute: number, q: { enabled: boolean; startMin: number; endMin: number }) =>
  q.enabled && q.startMin !== q.endMin && (q.startMin < q.endMin ? minute >= q.startMin && minute < q.endMin : minute >= q.startMin || minute < q.endMin);

/** Returns how many notifications went out. */
export async function runMkpkNotices(deps: NoticeRunDeps): Promise<number> {
  const { store } = deps;
  if (!(await readSipakamaseModule(store)).enabled) return 0;
  const [prefs, data, calendar, neosiaOn] = await Promise.all([readPrefs(store), readSipakamaseData(store), readCalendar(store), readModuleState(store)]);
  const snapshots = neosiaOn.enabled ? await readSnapshots(store) : {};
  const transcript = neosiaOn.enabled ? await readMkpkTranscript(store, snapshotKey('getTranskripMahasiswa')).catch(() => null) : null;
  const local = localParts(deps.now, deps.timeZone);
  const news = (await store.get<SipakamaseNews[]>(SIPAKAMASE_NEWS_KEY)) ?? [];
  const result = mkpkNotices({
    enabled: prefs.mkpkReminders,
    quiet: inQuiet(local.minuteOfDay, prefs.reminders.quiet),
    today: local.dateKey,
    reminders: mkpkReminders(data, mkpkProgress(snapshots, transcript)),
    news,
    kegiatan: calendar.kegiatan,
    sent: (await store.get<Record<string, string>>(MKPK_NOTICE_SENT_KEY)) ?? {},
    words: sipakamaseWords(deps.locale).notice,
  });
  let shown = 0;
  for (const n of result.show) {
    try {
      await deps.show(`mkpk|${n.key}`, n.title, n.body);
      shown += 1;
    } catch {
      // A notification that could not be created is not retried this run.
    }
  }
  await store.set(MKPK_NOTICE_SENT_KEY, result.sent);
  // Off: the news is dropped (nobody asked for it); shown: removed from the queue.
  const remaining = prefs.mkpkReminders ? news.slice(result.newsShown) : [];
  if (remaining.length !== news.length) await store.set(SIPAKAMASE_NEWS_KEY, remaining);
  return shown;
}

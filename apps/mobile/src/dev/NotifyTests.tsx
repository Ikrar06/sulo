// Debug build only (DevScreen, seven taps on the version): notification
// tests. Only "Jalankan cek latar belakang sekarang" sends a request (the
// worker's own, counted in the budget); everything else is local or a
// simulation on the newest stored answer. Test titles start with "[uji]";
// the texts come from the real builders. scripts/check-no-dev-code.mjs
// fails a release build that still carries this file.

import { useEffect, useState } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { activeCourseIds } from '@sulo/core/courses/active-score';
import { courseAlias } from '@sulo/core/courses/display-name';
import { messagesFor, resolveLocale } from '@sulo/core/i18n';
import { readBudget } from '@sulo/core/moodle/budget';
import { DAILY_BUDGET, DAILY_CALL_BUDGET, SOFT_DAILY_POSTS, WATCH_STOP } from '@sulo/core/moodle/limits';
import type { Platform } from '@sulo/core/platform';
import { readPrefs } from '@sulo/core/prefs';
import { keepAliveFrom } from '@sulo/core/remote/keep-alive';
import { readRemoteConfig } from '@sulo/core/remote/remote-config';
import { previewMorning } from '@sulo/core/reminders/morning';
import { parseNotificationId } from '@sulo/core/reminders/run';
import { noticeView } from '@sulo/core/reminders/text';
import { nextLocalTime } from '@sulo/core/reminders/zoned';
import { currentUser, readUser } from '@sulo/core/storage';
import type { Task } from '@sulo/core/types';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { numericId, scheduleOnChannels } from '../platform/notifications';
import { createPreferencesStore } from '../platform/store';
import { scheduleReminders, SCHEDULED_KEY } from '../reminders';
import { SuloSession } from '../session';
import { readWatch } from '../watch';
import { readWatchStatus, type WatchTiming } from '../watch-native';

const PREFIX = '[uji] ';
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const time = (at: number) => new Date(at * 1000).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' });

/** One local notification through the same scheduling path as the real reminders (reminders.ts). */
async function schedule(id: string, title: string, body: string, inSec: number) {
  await scheduleOnChannels(createPreferencesStore(), [{ id: numericId(id), title: PREFIX + title, body, extra: { suloId: id }, schedule: { at: new Date(Date.now() + inSec * 1000), allowWhileIdle: true }, isExactNotification: false }]);
}

const KIND_NAME: Record<string, string> = { task: 'pengingat tenggat', calendar: 'kalender', morning: 'ringkasan pagi', krs: 'KRS', nudge: 'NEOSIA', summary: 'ringkasan tugas' };

export function NotifyTests({ platform }: { platform: Platform }) {
  const [line, setLine] = useState('');
  const [status, setStatus] = useState<string[]>([]);
  const [pending, setPending] = useState<string[] | null>(null);

  const refreshStatus = async () => {
    const [watch, s, budget, config, prefs] = await Promise.all([readWatch(platform), readWatchStatus(), readBudget(platform.store, platform.clock), readRemoteConfig(platform.store), readPrefs(platform.store)]);
    const last = s.timings.at(-1) as WatchTiming | undefined;
    const gaps = s.timings.slice(-11).map((t, i, a) => (i === 0 ? null : t.ranAt - a[i - 1]!.ranAt)).filter((g): g is number => g !== null);
    const median = gaps.length ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]! : null;
    const morningAt = nextLocalTime(platform.clock.now(), prefs.reminders.morning.atMin, tz());
    setStatus([
      `Pantau tugas baru: ${watch.enabled ? 'menyala' : 'mati'}; config: ${config.enabled ? 'aktif' : 'DIJEDA'}`,
      `Cek berikutnya: ${s.plannedAt > 0 ? time(s.plannedAt) : '-'}; antrean: ${s.queued}`,
      `Cek terakhir: ${last ? `${time(last.ranAt)} · ${last.outcome} · ${last.ms} ms · ${last.bytes} B · ${last.changes ?? 0} perubahan` : '-'}`,
      `Jeda nyata antar-cek (median 10 terakhir): ${median !== null ? `${Math.round(median / 60)} menit` : '-'}`,
      `Anggaran hari ini: ${budget.used}/${DAILY_BUDGET} POST, ${budget.calls ?? 0}/${DAILY_CALL_BUDGET} panggilan (lunak ${SOFT_DAILY_POSTS}; pemantauan berhenti di ${WATCH_STOP.posts} POST / ${WATCH_STOP.calls} panggilan); pemantauan ${(budget.bySource as Record<string, number> | undefined)?.watch ?? 0} POST`,
      `Config pemantauan: ${JSON.stringify(keepAliveFrom(config))}`,
      `Ringkasan pagi berikutnya: ${prefs.reminders.morning.enabled ? time(morningAt) : `mati (jamnya ${time(morningAt)})`}`,
    ]);
  };
  useEffect(() => void refreshStatus(), []);

  const reminderIn1 = async () => {
    const userId = await currentUser(platform.store);
    const prefs = await readPrefs(platform.store);
    const m = messagesFor(resolveLocale(prefs.locale, navigator.language));
    const [tasks, courses, taskState] = userId === null ? [[], [], {} as Record<string, { doneManually?: boolean }>] : await Promise.all([readUser(platform.store, userId, 'tasks'), readUser(platform.store, userId, 'courses'), readUser(platform.store, userId, 'taskState')]);
    const active = activeCourseIds(courses);
    const now = platform.clock.now();
    const real = tasks.filter((t) => t.dueAt !== null && t.dueAt > now && active.has(t.courseId) && !(taskState as Record<string, { doneManually?: boolean }>)[String(t.eventId)]?.doneManually).sort((a, b) => a.dueAt! - b.dueAt!)[0];
    const task: Task = real ?? { eventId: 1, cmId: null, courseId: 0, name: 'Contoh tugas', module: 'assign', dueAt: now + 3 * 3600, url: '', overdue: false, firstSeenAt: now, lastSeenAt: now, missingSince: null };
    const view = noticeView({ kind: 'task', key: `t:${task.eventId}:180:${task.dueAt}`, task, snoozed: false }, { now: now + 60, timeZone: tz(), m, courseName: (t) => courseAlias(courses.find((c) => c.id === t.courseId) ?? { alias: null, parsed: { name: '' } } as never) });
    await schedule(`task|${task.eventId}|uji`, view.title, view.message, 60);
    setLine(`Pengingat dijadwalkan untuk ${time(now + 60)} (${real ? 'tugas nyata' : 'contoh'}). Tutup aplikasi dan kunci HP.`);
  };

  const morning = async (inSec: number) => {
    const { view, enabled } = await previewMorning(platform.store, platform.clock.now(), tz(), navigator.language);
    if (!view) return setLine(`Ringkasan pagi kosong: tidak ada terlambat, tenggat, atau acara hari ini (tidak dikirim).${enabled ? '' : ' Setelan ringkasan pagi sedang mati.'}`);
    await schedule(`morning|uji:${platform.clock.now()}`, view.title, view.message, inSec);
    setLine(`${inSec > 5 ? `Dijadwalkan ${time(platform.clock.now() + inSec)}` : 'Dikirim'}: ${view.message}${enabled ? '' : ' (Catatan: setelan "Kirim ringkasan tugas setiap pagi" sedang mati.)'}`);
  };

  const runNow = async () => {
    const before = (await readWatchStatus()).timings.length;
    await SuloSession.watchRunNow();
    setLine('Cek latar belakang dijalankan; hasil muncul di status dalam beberapa detik.');
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const s = await readWatchStatus();
      if (s.timings.length !== before) {
        const t = s.timings.at(-1)!;
        setLine(`Hasil cek: ${t.outcome}, ${t.ms} ms, ${t.bytes} B, ${t.changes ?? 0} perubahan.`);
        break;
      }
    }
    await refreshStatus();
  };

  const simulate = async (kind: 'task' | 'due' | 'three' | 'quiet' | 'expired') => {
    const r = await SuloSession.watchSimulate({ kind, prefix: PREFIX }).catch(() => ({ status: 'error', changes: 0, notices: 0 }));
    const say: Record<string, string> = {
      sent: `${r.changes} perubahan, ${r.notices} notifikasi dikirim.`,
      held: `${r.changes} perubahan ditahan (jam tenang 2 menit); satu ringkasan dikirim sesudahnya.`,
      expired: 'Sesi ditandai habis (data Sulo tetap). Kembali ke aplikasi untuk melihat baris "Masuk lagi".',
      no_answer: 'Belum ada respons tersimpan: jalankan satu cek latar belakang dulu.',
      no_plan: 'Belum ada paket rencana: nyalakan "Pantau tugas baru" dulu.',
    };
    setLine(say[r.status] ?? `Status: ${r.status}`);
  };

  const showPending = async () => {
    const { notifications } = await LocalNotifications.getPending();
    const rows = notifications
      .map((n) => ({ at: new Date((n.schedule?.at as unknown as string) ?? 0).getTime() / 1000, kind: parseNotificationId(String(n.extra?.suloId ?? '')).kind }))
      .sort((a, b) => a.at - b.at);
    setPending([`${rows.length} terjadwal`, ...rows.slice(0, 10).map((r) => `${time(r.at)} · ${KIND_NAME[r.kind] ?? r.kind}`)]);
  };
  const cancelAll = async () => {
    const { notifications } = await LocalNotifications.getPending();
    if (notifications.length > 0) await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
    await platform.store.remove(SCHEDULED_KEY);
    setPending(['0 terjadwal (semua dibatalkan)']);
  };
  const reschedule = async () => {
    const n = await scheduleReminders(platform);
    setLine(`${n} pengingat dijadwalkan ulang dari data.`);
    await showPending();
  };

  return (
    <Card className="space-y-3">
      <h2 className="text-m15 font-semibold">Uji notifikasi</h2>
      <div className="flex flex-wrap gap-2">
        <PillButton small onPress={() => void reminderIn1()}>Pengingat 1 menit lagi</PillButton>
        <PillButton small onPress={() => void morning(1)}>Ringkasan pagi sekarang</PillButton>
        <PillButton small onPress={() => void morning(60)}>Ringkasan pagi 1 menit lagi</PillButton>
        <PillButton small kind="primary" onPress={() => void runNow()}>Jalankan cek latar belakang sekarang</PillButton>
        <PillButton small onPress={() => void simulate('task')}>Simulasikan tugas baru</PillButton>
        <PillButton small onPress={() => void simulate('due')}>Simulasikan tenggat berubah</PillButton>
        <PillButton small onPress={() => void simulate('three')}>Simulasikan 3 perubahan</PillButton>
        <PillButton small onPress={() => void simulate('quiet')}>Simulasikan jam tenang</PillButton>
        <PillButton small danger onPress={() => void simulate('expired')}>Simulasikan sesi habis</PillButton>
        <PillButton small onPress={() => void showPending()}>Tampilkan daftar terjadwal</PillButton>
        <PillButton small danger onPress={() => void cancelAll()}>Batalkan semua notifikasi terjadwal</PillButton>
        <PillButton small onPress={() => void reschedule()}>Jadwalkan ulang dari data</PillButton>
      </div>
      {line && (
        <p role="status" className="text-m13">
          {line}
        </p>
      )}
      {pending && (
        <ul className="text-m12 text-muted-foreground tabular-nums">
          {pending.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <ul className="space-y-1 text-m12 text-muted-foreground tabular-nums">
        {status.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <PillButton small onPress={() => void refreshStatus()}>Segarkan status</PillButton>
    </Card>
  );
}

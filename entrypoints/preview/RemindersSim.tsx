import { useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { useI18n } from '@/components/i18n';
import { Button } from '@/components/ui/button';
import { activeCourseIds } from '@/lib/courses/active-score';
import { courseAlias } from '@/lib/courses/display-name';
import type { DevMessage } from '@/lib/dev/messages';
import { formatDue, localeOf } from '@/lib/format/time';
import { planReminders, type SentKeys } from '@/lib/reminders/plan';
import { DEFAULT_REMINDERS, type ReminderSettings } from '@/lib/reminders/settings';
import { noticeView, type NotificationView } from '@/lib/reminders/text';
import type { PopupInput } from '@/lib/view/popup-view';

// Dev-only "jam palsu": runs the real planner on the preview fixtures at any
// time you choose, steps to the next reminder, and shows each notification as
// it would read. In the dev build (chrome-extension:// page) it can also ask
// the background to run a real cycle at that time, with real notifications.

const H = 3600;

/** A notification as the system would show it (mock, for review and screenshots). */
export function NotificationMock({ view }: { view: NotificationView }) {
  return (
    <div className="flex w-[360px] gap-3 rounded-xl border border-border bg-surface p-3 text-left">
      <img src={`/notify/${view.icon}.png`} alt="" className="size-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">Sulo</p>
        <p className="text-[13px] leading-[18px] font-semibold">{view.title}</p>
        <p className="text-[13px] leading-[18px] text-foreground/85">{view.message}</p>
        {view.buttons.length > 0 && (
          <div className="mt-2 flex gap-2">
            {view.buttons.map((b) => (
              <span key={b} className="rounded-md border border-border px-2 py-0.5 text-[12px]">
                {b}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function RemindersSim({ input, start }: { input: PopupInput; start: number }) {
  const { m } = useI18n();
  const [now, setNow] = useState(start);
  const [sent, setSent] = useState<SentKeys>({});
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDERS);
  const [log, setLog] = useState<{ at: number; views: NotificationView[] }[]>([]);
  const [bgNote, setBgNote] = useState('');
  const user = input.user;
  const tz = input.timeZone;

  const plan = useMemo(
    () =>
      planReminders({
        now,
        timeZone: tz,
        tasks: user?.tasks ?? [],
        taskState: user?.taskState ?? {},
        activeCourseIds: activeCourseIds(user?.courses ?? []),
        settings,
        sent,
        session: { state: 'OK', expiredAt: null },
      }),
    [now, tz, user, settings, sent],
  );
  const byId = new Map((user?.courses ?? []).map((c) => [c.id, c]));
  const views = plan.send.map((n) => noticeView(n, { now, timeZone: tz, m, courseName: (t) => (byId.get(t.courseId) ? courseAlias(byId.get(t.courseId)!) : '') }));

  const deliver = () => {
    setLog((l) => [{ at: now, views }, ...l]);
    setSent((s) => ({ ...s, ...Object.fromEntries(plan.markSent.map((k) => [k, now])) }));
  };
  const stepToNext = () => {
    deliver();
    if (plan.nextAt !== null) setNow(plan.nextAt);
  };
  const viaBackground = async (message: DevMessage) => {
    try {
      const result = await browser.runtime.sendMessage(message);
      setBgNote(JSON.stringify(result));
    } catch {
      setBgNote('Hanya jalan di build dev yang dimuat sebagai ekstensi (chrome-extension://.../preview.html?reminders).');
    }
  };

  return (
    <main className="mx-auto max-w-[900px] space-y-6 p-6 text-foreground">
      <header className="space-y-1">
        <h1 className="text-xl">Simulasi pengingat (jam palsu)</h1>
        <p className="text-sm text-muted-foreground">Planner yang sama dengan latar belakang, memakai data sintetis pratinjau. Hanya ada di build dev.</p>
      </header>
      <section className="flex flex-wrap items-center gap-2 text-sm">
        <span className="tabular-nums">Sekarang: {formatDue(now, localeOf(m), tz)}</span>
        {[1, 6, 24].map((h) => (
          <Button key={h} size="sm" variant="outline" onClick={() => setNow((n) => n + h * H)}>
            +{h} jam
          </Button>
        ))}
        <Button size="sm" onClick={stepToNext} disabled={plan.nextAt === null && plan.send.length === 0}>
          Kirim, lalu lompat ke pengingat berikutnya
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setSent({}); setLog([]); setNow(start); }}>
          Ulang dari awal
        </Button>
      </section>
      <section className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={settings.quiet.enabled} onChange={(e) => setSettings((s) => ({ ...s, quiet: { ...s.quiet, enabled: e.target.checked } }))} />
          Jam tenang 22.00 sampai 06.00
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={settings.morning.enabled} onChange={(e) => setSettings((s) => ({ ...s, morning: { ...s.morning, enabled: e.target.checked } }))} />
          Ringkasan pagi 07.00
        </label>
      </section>
      <section className="space-y-2">
        <h2 className="text-base">Akan dikirim sekarang ({views.length})</h2>
        <div className="flex flex-wrap gap-3">{views.length ? views.map((v, i) => <NotificationMock key={i} view={v} />) : <p className="text-sm text-muted-foreground">Tidak ada.</p>}</div>
        <p className="text-sm text-muted-foreground tabular-nums">Alarm berikutnya: {plan.nextAt === null ? 'tidak ada' : formatDue(plan.nextAt, localeOf(m), tz)}</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base">Lewat latar belakang (notifikasi sungguhan)</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void viaBackground({ type: 'dev/notify/simulate', at: now })}>
            Jalankan siklus pada jam ini
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void viaBackground({ type: 'dev/notify/reset' })}>
            Lupakan pengingat terkirim
          </Button>
        </div>
        {bgNote && <p className="text-xs text-muted-foreground">{bgNote}</p>}
      </section>
      {log.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base">Riwayat</h2>
          {log.map((entry) => (
            <div key={entry.at} className="space-y-2">
              <p className="text-xs text-muted-foreground tabular-nums">{formatDue(entry.at, localeOf(m), tz)}</p>
              <div className="flex flex-wrap gap-3">{entry.views.length ? entry.views.map((v, i) => <NotificationMock key={i} view={v} />) : <span className="text-xs">tidak ada</span>}</div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

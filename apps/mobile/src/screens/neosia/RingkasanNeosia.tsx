// NEOSIA on Ringkasan (M8d B3): one setup card (connect with consent, the
// checklist with its next step, a calm line when the WebView cannot capture
// or NEOSIA's session ended), "Kuliah hari ini", "Studi" (grades only when
// shown and not private) and "Kesiapan KRS" during the KRS window.
// No mascot here: Ringkasan has its own.

import { useEffect, useMemo, useState } from 'react';
import { localParts } from '@sulo/core/reminders/zoned';
import { neosiaWords } from '@sulo/core/i18n/neosia';
import { linkedMeetings } from '@sulo/core/neosia/linked';
import { holidayRanges } from '@sulo/core/neosia/schedule';
import { CHECKLIST_SOURCES } from '@sulo/core/neosia/sources';
import { dismissInvite, readInvite, showInvite, type InviteState } from '@sulo/core/neosia/invite';
import { nextClass } from '@sulo/core/neosia/today';
import { classMeetings, DEFAULT_SKS_TARGET, krsWindow, profile, readiness, showKrsCard } from '@sulo/core/neosia/view';
import { itemText, STATE_CLASS, STATE_ICON } from '@sulo/ui/dashboard/NeosiaParts';
import { CheckIcon } from '@sulo/ui/icons';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { Private } from '@sulo/ui/private';
import { useI18n } from '@sulo/ui/i18n';
import { timeZone, useMobileData } from '../../shell/data';
import type { Screen } from '../../shell/nav';
import { useGrades, useNeosia } from '../../neosia/NeosiaProvider';
import { useSecureScreen } from '../../neosia/secure-screen';

const WEBVIEW_STORE = 'https://play.google.com/store/apps/details?id=com.google.android.webview';

/** Connect, the checklist, or the calm lines; nothing once the required pages are in. */
export function NeosiaSetupCard() {
  const { locale } = useI18n();
  const n = neosiaWords(locale);
  const t = n.mobile;
  const neo = useNeosia();
  const { data, actions, platform } = useMobileData();
  const [asking, setAsking] = useState(false);
  const [invite, setInvite] = useState<InviteState | null>(null);
  useEffect(() => {
    void readInvite(platform.store).then(setInvite);
  }, [platform]);
  const [busy, setBusy] = useState(false);
  const run = (f: () => Promise<unknown>) => {
    setBusy(true);
    void f().finally(() => setBusy(false));
  };

  if (neo.supported === false) {
    return (
      <p role="status" className="mb-3 flex min-h-9 items-center gap-2 rounded-2xl bg-m-inset px-4 py-2 text-m13">
        <span className="min-w-0 flex-1">{t.unsupported}</span>
        <button type="button" onClick={() => actions.openExternal(WEBVIEW_STORE)} className="m-press shrink-0 font-semibold outline-none focus-ring:ring-2 focus-ring:ring-focus">
          {t.updateWebView}
        </button>
      </p>
    );
  }
  if (neo.supported === null) return null;

  if (!neo.enabled) {
    // The invite follows core's rule: "Nanti saja" hides it for 30 days, and it comes back before a KRS window.
    const krsWindows = (data!.calendar.kegiatan ?? []).filter((k) => k.kategori === 'krs').map((k) => ({ mulai: k.mulai, selesai: k.selesai ?? null }));
    if (!asking && (invite === null || !showInvite({ moduleOn: false, dismissedAt: invite.dismissedAt, dismissedDay: invite.dismissedDay, now: data!.now, today: data!.today, krsWindows }))) return null;
    const later = async () => {
      await dismissInvite(platform.store, data!.now, data!.today);
      setInvite(await readInvite(platform.store));
    };
    return (
      <Card className="mb-4" inner="space-y-3">
        <p className="text-m15 font-semibold">{asking ? t.connectTitle : n.checklist.title}</p>
        <p className="text-m13 text-muted-foreground">{asking ? t.connectBody : n.invite.text}</p>
        {asking && <p className="text-m12 text-muted-foreground">{t.unofficial}</p>}
        <div className="flex gap-2">
          {asking ? (
            <>
              <PillButton kind="primary" small disabled={busy} onPress={() => run(neo.enable)}>
                {t.connect}
              </PillButton>
              <PillButton small onPress={() => setAsking(false)}>
                {n.settings.cancel}
              </PillButton>
            </>
          ) : (
            <>
              <PillButton kind="primary" small onPress={() => setAsking(true)}>
                {n.invite.connect}
              </PillButton>
              <PillButton small onPress={() => run(later)}>
                {n.invite.later}
              </PillButton>
            </>
          )}
        </div>
      </Card>
    );
  }

  // NEOSIA's session ended: one calm line, only when a page needed it (never asked for by itself).
  if (neo.needsLogin) {
    return (
      <p role="status" className="mb-3 flex min-h-9 items-center gap-2 rounded-2xl bg-m-inset px-4 py-2 text-m13">
        <span className="min-w-0 flex-1">{t.expired}</span>
        <button type="button" disabled={busy} onClick={() => run(() => neo.open('login'))} className="m-press shrink-0 font-semibold outline-none focus-ring:ring-2 focus-ring:ring-focus">
          {t.signIn}
        </button>
      </p>
    );
  }

  const required = CHECKLIST_SOURCES.filter((s) => s.checklist === 'required');
  if (required.every((s) => neo.done.has(s.id))) return null;
  const done = required.filter((s) => neo.done.has(s.id)).length;
  const rows: { id: string; name: string; desc: string; has: boolean; optional: boolean; onOpen: () => void }[] = [
    ...(neo.signedIn ? [] : [{ id: 'login', name: t.signIn, desc: t.signInDesc, has: false, optional: false, onOpen: () => run(() => neo.open('login')) }]),
    ...CHECKLIST_SOURCES.map((s) => ({ id: s.id, name: n.checklist.sources[s.id].name, desc: n.checklist.sources[s.id].desc, has: neo.done.has(s.id), optional: s.checklist === 'optional', onOpen: () => run(() => neo.open(s.id)) })),
  ];
  return (
    <Card className="mb-4" inner="space-y-3">
      <p className="text-m15 font-semibold">{n.checklist.count(done, required.length)}</p>
      <p className="text-m13 text-muted-foreground">{n.checklist.overviewHelp}</p>
      <ul className="space-y-2">
        {rows.map((r) => {
          const next = r.id === neo.next;
          return (
            <li key={r.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${next ? 'bg-m-inset' : ''}`}>
              {r.has ? <CheckIcon aria-label={n.checklist.has} className="size-5 shrink-0" /> : <span aria-label={n.checklist.missing} role="img" className="size-5 shrink-0 rounded-full border-2 border-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <p className="text-m15 font-semibold">
                  {r.name}
                  {r.optional && <span className="ml-2 text-m12 font-normal text-muted-foreground">{n.checklist.optional}</span>}
                </p>
                <p className="text-m12 text-muted-foreground">{r.desc}</p>
              </div>
              {!r.has && (
                <PillButton small kind={next ? 'primary' : 'secondary'} disabled={busy} onPress={r.onOpen}>
                  {next ? t.nextItem : n.checklist.open}
                </PillButton>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** "Kuliah hari ini": the next class (name, time, room), from the schedule NEOSIA's KRS gave. */
export function TodayClassCard({ go }: { go: (s: Screen) => void }) {
  const { locale } = useI18n();
  const n = neosiaWords(locale);
  const neo = useNeosia();
  const { data } = useMobileData();
  const now = data!.now;
  const meetings = useMemo(() => linkedMeetings(classMeetings(neo.snapshots), data!.user?.courses ?? [], neo.courseMap), [neo.snapshots, neo.courseMap, data]);
  if (!neo.enabled || meetings.length === 0) return null;
  const parts = localParts(now, timeZone);
  const next = nextClass(meetings, parts.dateKey, parts.minuteOfDay, holidayRanges(data!.calendar));
  return (
    <Card onPress={() => go({ name: 'jadwal', detail: null })} label={n.today.title} className="h-full min-w-0" inner="flex h-full flex-col">
      <p className="text-m12 text-muted-foreground">{next && next.day === parts.dateKey ? n.today.title : n.today.next}</p>
      {next ? (
        <>
          <p className="mt-1 line-clamp-2 text-m15 font-semibold">{next.meeting.displayName}</p>
          <p className="mt-auto pt-2 text-m13 text-muted-foreground tabular-nums">
            {next.meeting.start}–{next.meeting.end}
            {next.meeting.room ? ` · ${next.meeting.room}` : ''}
          </p>
        </>
      ) : (
        <p className="mt-1 text-m13 text-muted-foreground">{n.schedule.noClassWeek}</p>
      )}
    </Card>
  );
}

/** "Studi": credits always; the GPA only when grades are shown and privacy mode is off. */
export function StudiCard({ go }: { go: (s: Screen) => void }) {
  const { locale } = useI18n();
  const n = neosiaWords(locale);
  const neo = useNeosia();
  const { data } = useMobileData();
  const prefs = data!.prefs;
  const show = prefs.gradesShown && !prefs.privacyMode;
  // Grades are read only while this card shows them, and released after.
  const grades = useGrades(neo.enabled && show);
  // The GPA on screen: Ringkasan stays out of screenshots and the recent-apps preview while it shows.
  useSecureScreen(neo.enabled && show && grades !== null);
  const p = profile(grades ?? neo.snapshots);
  if (!neo.enabled || !p) return null;
  const target = prefs.sksTarget || DEFAULT_SKS_TARGET;
  return (
    <Card onPress={() => go({ name: 'nilai', detail: null })} label={n.studi.title} className="h-full min-w-0" inner="flex h-full flex-col">
      <p className="text-m12 text-muted-foreground">{n.studi.title}</p>
      <p className="mt-1 text-m22 font-semibold tabular-nums">{show && p.ipk !== null ? <Private>{p.ipk.toFixed(2)}</Private> : '•••'}</p>
      {p.sksPassed !== null && (
        <p className="mt-auto pt-2 text-m13 text-muted-foreground">
          <Private>{n.studi.creditsOf(p.sksPassed, target)}</Private>
        </p>
      )}
    </Card>
  );
}

/** "Kesiapan KRS" during the KRS window (14 days before it opens until it closes). */
export function KrsReadinessCard() {
  const { locale, m } = useI18n();
  const n = neosiaWords(locale);
  const neo = useNeosia();
  const { data } = useMobileData();
  const today = data!.today;
  const calendarKrs = (data!.calendar.kegiatan ?? []).filter((k) => k.kategori === 'krs').map((k) => ({ mulai: k.mulai, selesai: k.selesai ?? null }));
  const window = krsWindow(neo.snapshots, today, calendarKrs);
  if (!neo.enabled || !showKrsCard(window, today)) return null;
  const items = readiness(neo.snapshots, window, today);
  return (
    <Card className="mb-4" inner="space-y-3">
      <p className="text-m15 font-semibold">{n.krs.title}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 text-m13">
            {(() => {
              const Icon = STATE_ICON[item.state];
              // As tall as the first line of text, so the icon sits on it.
              return (
                <span className="flex h-5 shrink-0 items-center">
                  <Icon aria-label={n.krs.states[item.state]} role="img" className={`size-4 ${STATE_CLASS[item.state]}`} />
                </span>
              );
            })()}
            <span className="min-w-0 flex-1">{itemText(item, n, m)}</span>
          </li>
        ))}
      </ul>
      <p className="text-m12 text-muted-foreground">{n.krs.sourceCalendar}</p>
      <PillButton small onPress={() => void neo.open('krs')}>
        {n.openInNeosia}
      </PillButton>
    </Card>
  );
}

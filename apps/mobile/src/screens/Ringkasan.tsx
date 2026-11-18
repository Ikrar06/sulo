// Ringkasan (M8c.1, cards). The top: the greeting (26, two lines) and one
// line about the state of things on the left, the mascot (104) on the right
// sitting on the hero card's top edge. The hero card is the focal point: the
// task that matters most now (the oldest overdue one, else the nearest).
// Then three small numbers, "Berikutnya" (upcoming tasks only) as a
// carousel, "Akademik" (calendar and attendance) and the next 7 days. All
// numbers come from @sulo/core; classes and GPA come with NEOSIA in M8d.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { countdownOf } from '@sulo/core/calendar/countdown';
import { nextImportant, SHORT_LABEL_KATEGORI } from '@sulo/core/calendar/upcoming';
import { weekBars } from '@sulo/core/dashboard/week-bars';
import { mascotMood } from '@sulo/core/dashboard/mascot-mood';
import { greeting, greetingState } from '@sulo/core/dashboard/mobile-greeting';
import { groupOverview } from '@sulo/core/dashboard/overview';
import { buildTaskItems, type TaskItem } from '@sulo/core/dashboard/tasks';
import { countdownOrLate, formatLeft, taskDueLines } from '@sulo/core/format/time';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { attendanceSummary } from '@sulo/core/presensi/service';
import { localParts } from '@sulo/core/reminders/zoned';
import { urgencyOf } from '@sulo/core/tasks/group';
import { useDoneUndo } from '@sulo/ui/dashboard/done-undo';
import { useWeekText, WeekBar } from '@sulo/ui/dashboard/CalendarParts';
import { useI18n } from '@sulo/ui/i18n';
import { Card, Chip, SectionHead, StatCard } from '@sulo/ui/mobile/cards';
import { CheckCircle } from '@sulo/ui/mobile/controls';
import { FitLine } from '@sulo/ui/mobile/fit-line';
import { courseTint } from '@sulo/ui/mobile/tint';
import { Private } from '@sulo/ui/private';
import { REFRESHED_EVENT } from '../events';
import { timeZone, useMobileData } from '../shell/data';
import type { Screen } from '../shell/nav';
import { useTaskDate } from '../shell/task-date';
import { GreetingLines } from './GreetingLines';
import { HeroMascot } from './HeroMascot';
import { WeekCard } from './WeekCard';
import { URGENCY_TEXT } from './Tugas';

/** Cards in "Berikutnya". */
const CAROUSEL_MAX = 8;
const DAY = 86_400;

const pct = (v: number, locale: string) => v.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 1 });

export function RingkasanScreen({ go }: { go: (s: Screen) => void }) {
  const { m, locale } = useI18n();
  const d = mobileDash(locale);
  const w = mobileWords(locale);
  const r = d.ringkasan;
  const k = d.kalender;
  const { data, actions, platform } = useMobileData();
  const user = data!.user!;
  const now = data!.now;
  const today = data!.today;
  const calendar = data!.calendar;
  const done = useDoneUndo(actions, d, today, platform.store);
  const [cheer, setCheer] = useState(0);
  const [celebrate, setCelebrate] = useState(0);
  const items = useMemo(() => buildTaskItems(user), [user]);
  const pendingOnly = useMemo(() => items.filter((i) => i.status === 'pending'), [items]);
  // Plus the ones just marked done (they stay for the undo window).
  const pending = useMemo(() => items.filter((i) => i.status === 'pending' || done.lingering.has(i.task.eventId)), [items, done.lingering]);
  const dated = useMemo(() => pending.filter((i) => i.task.dueAt !== null).sort((a, b) => a.task.dueAt! - b.task.dueAt!), [pending]);
  const groups = useMemo(() => groupOverview(pending.map((i) => ({ ...i, dueAt: i.task.dueAt })), now, timeZone), [pending, now]);
  const overdue = groups.find((g) => g.key === 'overdue')?.rows.length ?? 0;
  const dueThisWeek = groups.filter((g) => g.key !== 'overdue').reduce((n, g) => n + g.rows.length, 0);
  const hero = dated[0] ?? pending[0] ?? null;
  // Upcoming only: overdue tasks are not repeated here.
  const upcoming = dated.filter((i) => i !== hero && i.task.dueAt! >= now).slice(0, CAROUSEL_MAX);
  const bars = useMemo(() => weekBars(pending.map((i) => i.task), calendar.kegiatan, now, timeZone), [pending, calendar, now]);
  const { setDate } = useTaskDate();
  // The carousel opens on its first card, 16 px from the edge (snapping never starts it mid-card).
  const carousel = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    if (carousel.current) carousel.current.scrollLeft = 0;
  }, []);
  const attendance = useMemo(() => attendanceSummary(user.presensi?.recap?.rows, user.courses), [user.presensi, user.courses]);
  const next = nextImportant(calendar, today);
  const c = next ? countdownOf(next.kegiatan, today) : null;
  const nextLabel = next ? (SHORT_LABEL_KATEGORI.has(next.kegiatan.kategori) ? (w.app.shortKategori[next.kegiatan.kategori] ?? k.kategori[next.kegiatan.kategori]) : next.kegiatan.judul) : '';
  const week = useWeekText(calendar, today, d);
  const nickname = data!.prefs.privacyMode ? '' : data!.prefs.nickname.trim();
  const countdown = data!.prefs.dueFormat === 'countdown';
  // "2 hari lagi" / "2 days left", "terlambat 1 hari".
  const left = (i: TaskItem) => (i.task.dueAt === null ? d.tugas.noDue : countdown ? countdownOrLate(i.task.dueAt, now, timeZone, m) : formatLeft(i.task.dueAt, now, timeZone, m));
  const banner = data!.view.banner?.kind;
  const mood = mascotMood({ now, dueTimes: pendingOnly.flatMap((i) => (i.task.dueAt === null ? [] : [i.task.dueAt])), sessionExpired: banner === 'session_expired', offline: banner === 'offline' || !navigator.onLine });
  const dueToday = groups.find((g) => g.key === 'today')?.rows.length ?? 0;
  const dueTomorrow = groups.find((g) => g.key === 'tomorrow')?.rows.length ?? 0;
  const hello = greeting({ now, timeZone, nickname, overdue, dueToday }, w);
  const state = greetingState({ sessionExpired: banner === 'session_expired', overdue, dueToday, dueTomorrow, nickname, phrase: hello.phrase }, w);
  const line = `${state.count ?? ''}${state.text}`;

  // Perbarui with new data: a short cheer.
  useEffect(() => {
    const on = (e: Event) => (e as CustomEvent<{ fresh: boolean }>).detail.fresh && setCheer((n) => n + 1);
    window.addEventListener(REFRESHED_EVENT, on);
    return () => window.removeEventListener(REFRESHED_EVENT, on);
  }, []);

  const markDone = (i: TaskItem) => {
    const last = pendingOnly.length === 1 && pendingOnly[0] === i;
    done.mark(i.task.eventId, last);
    // The last pending task: celebrate once; any other: a short cheer.
    if (last) setCelebrate((n) => n + 1);
    else setCheer((n) => n + 1);
  };

  const heroDue = hero?.task.dueAt ?? null;
  const heroTone = heroDue === null || hero!.status !== 'pending' ? 'text-muted-foreground' : URGENCY_TEXT[urgencyOf(heroDue, now)];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1 pb-4">
            {/* Never an ellipsis: 26, then 22, then 22 on two balanced lines (GreetingLines). */}
            <GreetingLines line1={hello.line1} line2={hello.line2} />
            <p className="mt-1 truncate text-m13 whitespace-nowrap text-muted-foreground">
              {state.count !== null && <span className="text-urgency-overdue tabular-nums">{state.count}</span>}
              {state.text}
            </p>
          </div>
          {/* Sits on the hero card's top edge (12 px over it). */}
          {/* 12 px into the side margin: the flame's own whitespace takes it. */}
          <div className="relative z-10 -mr-3 -mb-3 shrink-0">
            <HeroMascot mood={mood} cheer={cheer} celebrate={celebrate} label={line} />
          </div>
        </div>

        {hero ? (
          <Card hero onPress={() => go({ name: 'tugas', detail: String(hero.task.eventId) })} label={`${w.app.nearest}: ${hero.task.name}`}>
            {/* Chip, title (two lines), the time left across the card on one line, then the date with the actions. */}
            <Chip color={courseTint(hero.courseColor)}>{hero.courseName}</Chip>
            <p className={`mt-2 line-clamp-2 text-m18 ${hero.status === 'done' ? 'text-muted-foreground line-through' : ''}`}>{hero.task.name}</p>
            <FitLine size="text-m22" text={left(hero)} className={`mt-3 font-semibold tabular-nums ${heroTone}`}>
              {left(hero)}
            </FitLine>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-m13 text-muted-foreground tabular-nums">{heroDue !== null ? taskDueLines(heroDue, now, timeZone, m, locale, 'both').secondary : d.tugas.noDue}</p>
              <span className="flex shrink-0 items-center gap-2">
                <CheckCircle checked={hero.status === 'done'} onChange={(v) => (v ? markDone(hero) : done.unmark(hero.task.eventId))} label={`${hero.status === 'done' ? d.tugas.markUndone : d.tugas.markDone}: ${hero.task.name}`} />
                {/* The whole card opens the task; this is its visible label (no second button inside). */}
                <span aria-hidden="true" className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-m15 text-primary-foreground">
                  {w.app.open}
                </span>
              </span>
            </div>
          </Card>
        ) : (
          <Card hero>
            <p className="text-m15">{w.app.noneSoon}</p>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={w.app.statOverdue} value={String(overdue)} warn={overdue > 0} />
        <StatCard label={w.app.statWeek} value={String(dueThisWeek)} />
        {c?.kind === 'days' ? <StatCard label={w.app.statDaysTo(nextLabel)} value={String(c.n)} accent /> : <StatCard label={next ? nextLabel : k.nothing} value="–" />}
      </div>

      <section aria-labelledby="next-title">
        <SectionHead id="next-title" title={w.app.next} action={{ label: w.app.seeAll, onPress: () => go({ name: 'tugas', detail: null }) }} />
        {upcoming.length === 0 ? (
          <Card>
            <p className="text-m13 text-muted-foreground">{w.app.noUpcoming}</p>
          </Card>
        ) : (
          <ul ref={carousel} className="m-carousel -mx-4 flex items-stretch gap-3 overflow-x-auto px-4 pb-1">
            {upcoming.map((i) => {
              const isDone = i.status === 'done';
              return (
                <li key={i.task.eventId} className="flex w-[240px] shrink-0">
                  <Card dense className="flex-1" inner="flex h-full flex-col" onPress={() => go({ name: 'tugas', detail: String(i.task.eventId) })} label={i.task.name}>
                    {/* The chip as wide as its name (ellipsis at the card's width), not stretched. */}
                    <span className="flex min-w-0">
                      <Chip small color={courseTint(i.courseColor)}>
                        {i.courseName}
                      </Chip>
                    </span>
                    <p className={`mt-2 line-clamp-2 text-m15 ${isDone ? 'text-muted-foreground line-through' : ''}`}>{i.task.name}</p>
                    {/* Equal heights add room only above the footer: one title line at most (titles are two lines at most). */}
                    <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                      <span className={`min-w-0 truncate text-m12 whitespace-nowrap tabular-nums ${isDone ? 'text-muted-foreground' : URGENCY_TEXT[urgencyOf(i.task.dueAt, now)]}`}>{left(i)}</span>
                      <CheckCircle checked={isDone} onChange={(v) => (v ? markDone(i) : done.unmark(i.task.eventId))} label={`${isDone ? d.tugas.markUndone : d.tugas.markDone}: ${i.task.name}`} />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="academic-title">
        <SectionHead id="academic-title" title={w.app.academic} />
        <div className="grid grid-cols-2 items-stretch gap-3">
          <Card onPress={() => go({ name: 'kalender', detail: null })} label={r.calendarTitle} className="h-full min-w-0">
            <p className="text-m12 text-muted-foreground">{r.calendarTitle}</p>
            {next && c ? (
              <>
                <p className="mt-1 line-clamp-2 text-m15">{next.kegiatan.judul}</p>
                <p className="text-m13">
                  {c.kind === 'days' ? <span className="db-accent-text font-medium whitespace-nowrap tabular-nums">{w.app.daysLeft(c.n)}</span> : c.kind === 'today' ? k.countdown.today : c.kind === 'tomorrow' ? k.countdown.tomorrow : k.countdown.ongoingOpen}
                </p>
              </>
            ) : (
              <p className="mt-1 text-m13 text-muted-foreground">{k.nothing}</p>
            )}
            {week.info.kind === 'week' && (
              <div className="mt-3 flex items-center gap-2">
                <WeekBar nomor={week.info.nomor} total={week.info.total} label={w.app.weekShort(week.info.nomor, week.info.total)} className="flex-1" />
                <span className="shrink-0 text-m12 font-normal text-muted-foreground tabular-nums">{w.app.weekShort(week.info.nomor, week.info.total)}</span>
              </div>
            )}
          </Card>
          <Card onPress={() => go({ name: 'presensi', detail: null })} label={w.app.attendance} className="h-full min-w-0">
            <p className="text-m12 text-muted-foreground">{w.app.attendance}</p>
            {attendance ? (
              <>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-m22 tabular-nums">
                    <Private>{pct(attendance.average, locale)}%</Private>
                  </span>
                  <span className="text-m13 text-muted-foreground">{w.app.average}</span>
                </p>
                {attendance.lowest && (
                  <p className="mt-3 flex min-w-0 text-m12 font-normal text-muted-foreground">
                    <Private>
                      <span className="flex min-w-0">
                        <span className="shrink-0 tabular-nums">
                          {w.app.lowest} {pct(attendance.lowest.percent, locale)}%&nbsp;·&nbsp;
                        </span>
                        <span className="truncate">{attendance.lowest.name}</span>
                      </span>
                    </Private>
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-m13 text-muted-foreground">{d.presensi.never}</p>
            )}
          </Card>
        </div>
      </section>

      <WeekCard
        bars={bars}
        intl={m.intl}
        words={{ title: w.app.week7, empty: w.app.week7Empty, day: w.app.week7Day }}
        onOpen={(dateKey) => {
          setDate(dateKey);
          go({ name: 'tugas', detail: null });
        }}
      />
    </div>
  );
}

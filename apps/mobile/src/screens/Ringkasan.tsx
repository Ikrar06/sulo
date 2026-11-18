// Ringkasan: the dashboard's overview for a phone. Hero (mascot, greeting,
// one summary line), tasks by group, the academic calendar card, the Studi
// card (attendance; GPA comes with NEOSIA in M8d), and the 14-day load map
// as a strip that scrolls sideways. Everything is computed by
// @sulo/core; "Kuliah hari ini" comes with NEOSIA in M8d.

import { useMemo } from 'react';
import { formatDateKey } from '@sulo/core/calendar/countdown';
import { dayPart, greetingText } from '@sulo/core/dashboard/greeting';
import { loadMap } from '@sulo/core/dashboard/load-map';
import { buildSummary, groupOverview, heroMood, limitGroups, withNext } from '@sulo/core/dashboard/overview';
import { routeHash } from '@sulo/core/dashboard/routes';
import { buildTaskItems, type TaskItem } from '@sulo/core/dashboard/tasks';
import { countdownOrLate, formatRemaining } from '@sulo/core/format/time';
import { mobileDash } from '@sulo/core/i18n/mobile';
import { attendanceSummary } from '@sulo/core/presensi/service';
import { localParts } from '@sulo/core/reminders/zoned';
import { Card, CardLink } from '@sulo/ui/card';
import { useDoneUndo } from '@sulo/ui/dashboard/done-undo';
import { StudiCard } from '@sulo/ui/dashboard/NeosiaParts';
import { AcademicCard, nextForSummary, SummaryLine } from '@sulo/ui/dashboard/OverviewParts';
import { useI18n } from '@sulo/ui/i18n';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { Checkbox } from '@sulo/ui/ui/checkbox';
import { timeZone, useMobileData } from '../shell/data';
import type { Screen } from '../shell/nav';

type Row = TaskItem & { dueAt: number | null };

export function RingkasanScreen({ go }: { go: (s: Screen) => void }) {
  const { m, locale } = useI18n();
  const d = mobileDash(locale);
  const r = d.ringkasan;
  const { data, actions, platform } = useMobileData();
  const user = data!.user!;
  const now = data!.now;
  const done = useDoneUndo(actions, d, data!.today, platform.store);
  const allItems = useMemo(() => buildTaskItems(user), [user]);
  const pendingItems = useMemo(() => allItems.filter((i) => i.status === 'pending' || done.lingering.has(i.task.eventId)), [allItems, done.lingering]);
  const rows = useMemo<Row[]>(() => pendingItems.map((i) => ({ ...i, dueAt: i.task.dueAt })), [pendingItems]);
  const groups = useMemo(() => groupOverview(rows, now, timeZone), [rows, now]);
  const shown = limitGroups(withNext(groups, rows, now, timeZone));
  const overdue = groups.find((g) => g.key === 'overdue')?.rows.length ?? 0;
  const dueThisWeek = groups.filter((g) => g.key !== 'overdue').reduce((n, g) => n + g.rows.length, 0);
  const days = useMemo(() => loadMap(pendingItems.map((i) => i.task), data!.calendar.kegiatan, now, timeZone), [pendingItems, data, now]);
  const loadEmpty = days.every((day) => day.tasks.length === 0 && day.events.length === 0);
  const hour = Math.floor(localParts(now, timeZone).minuteOfDay / 60);
  const summary = buildSummary({ overdue, dueThisWeek, next: nextForSummary(data!.calendar, data!.today, d), classesToday: 0 });
  const attendance = useMemo(() => attendanceSummary(user.presensi?.recap?.rows, user.courses), [user.presensi, user.courses]);
  const countdown = data!.prefs.dueFormat === 'countdown';

  return (
    <div className="space-y-4">
      <section className="flex items-center gap-4 py-2">
        <Mascot state={heroMood(overdue, dueThisWeek)} size={56} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] leading-7 font-semibold">{greetingText(r.greeting[dayPart(hour)], data!.prefs.privacyMode ? '' : data!.prefs.nickname)}</h2>
          <SummaryLine parts={summary} d={d} />
        </div>
      </section>

      <Card title={r.tasksTitle} action={<CardLink href={routeHash('tugas')}>{r.allTasks}</CardLink>}>
        {shown.groups.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-muted-foreground">{r.nothingSoon}</p>
        ) : (
          <div className="space-y-4">
            {shown.groups.map((g) => (
              <section key={g.key} aria-label={r.groups[g.key]}>
                <h3 className="mb-1 text-[12px] font-semibold text-muted-foreground">{r.groups[g.key]}</h3>
                <ul>
                  {g.rows.map((row) => (
                    <li key={row.task.eventId} className={`-mx-2 flex items-center gap-2 rounded-lg px-2 ${done.collapsing.has(row.task.eventId) ? 'db-collapse' : ''}`}>
                      {/* 44 px touch target around the checkbox. */}
                      <span className="flex size-11 shrink-0 items-center justify-center">
                        <Checkbox
                          checked={row.status === 'done'}
                          onCheckedChange={(v) => (v === true ? done.mark(row.task.eventId) : done.unmark(row.task.eventId))}
                          aria-label={`${row.status === 'done' ? d.tugas.markUndone : d.tugas.markDone}: ${row.task.name}`}
                        />
                      </span>
                      <button type="button" onClick={() => go({ name: 'tugas', detail: String(row.task.eventId) })} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg py-2 text-left outline-none focus-ring:ring-2 focus-ring:ring-focus">
                        <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: `var(--course-${row.courseColor})` }} />
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[14px] ${row.status === 'done' ? 'text-muted-foreground line-through' : 'font-semibold'}`}>{row.task.name}</span>
                          <span className="block truncate text-[12px] text-muted-foreground">{row.courseName}</span>
                        </span>
                        <span className={`shrink-0 text-[12px] tabular-nums ${g.key === 'overdue' ? 'text-urgency-overdue' : 'text-muted-foreground'}`}>
                          {row.dueAt === null ? '' : countdown ? countdownOrLate(row.dueAt, now, timeZone, m) : formatRemaining(row.dueAt, now, timeZone, m)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {shown.hidden > 0 && (
              <button type="button" onClick={() => go({ name: 'tugas', detail: null })} className="min-h-11 rounded text-[14px] text-muted-foreground outline-none focus-ring:ring-2 focus-ring:ring-focus">
                {r.moreRows(shown.hidden)}
              </button>
            )}
          </div>
        )}
      </Card>

      <Card title={r.calendarTitle} action={<CardLink href={routeHash('kalender')}>{r.openCalendar}</CardLink>}>
        <AcademicCard calendar={data!.calendar} today={data!.today} d={d} />
      </Card>

      <StudiCard snapshots={{}} sksTarget={data!.prefs.sksTarget} neosiaOn={false} attendance={attendance} />

      <Card title={r.loadTitle}>
        {loadEmpty ? (
          <p className="text-[14px] text-muted-foreground">{r.loadEmpty}</p>
        ) : (
          <>
            <p className="mb-3 text-[12px] text-muted-foreground">{r.loadHelp}</p>
            {/* Fourteen days in one row that scrolls sideways; each day is a 48 px cell. */}
            <ol className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1">{/* lint-ui-allow: the strip runs to the card's 20 px edges */}
              {days.map((day) => {
                const events = day.events.map((e) => d.kalender.kategori[e.kategori] ?? e.judul).filter((v, i, a) => a.indexOf(v) === i).join(', ');
                const label = r.loadDay(formatDateKey(day.dateKey, m.intl, { weekday: 'long', day: 'numeric', month: 'long' }), day.tasks.length, events);
                const exam = day.events.some((e) => e.kategori === 'uts' || e.kategori === 'uas');
                const isToday = day.dateKey === data!.today;
                return (
                  <li
                    key={day.dateKey}
                    aria-label={label}
                    aria-current={isToday ? 'date' : undefined}
                    className={`db-load-${day.level} flex size-12 shrink-0 snap-start flex-col items-center justify-center rounded-lg text-[12px] leading-4 tabular-nums ${isToday ? 'ring-1 ring-foreground ring-offset-2 ring-offset-surface' : ''}`}
                  >
                    <span>{isToday ? r.loadToday : formatDateKey(day.dateKey, m.intl, { weekday: 'narrow' })}</span>
                    <span className="font-semibold">{formatDateKey(day.dateKey, m.intl, { day: 'numeric' })}</span>
                    {exam && <span aria-hidden="true" className="mt-1 size-1 rounded-full bg-current" />}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </Card>
    </div>
  );
}

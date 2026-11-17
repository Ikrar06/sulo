import { useMemo } from 'react';
import { useI18n } from '@/components/i18n';
import { ChevronRightIcon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { formatDateKey } from '@/lib/calendar/countdown';
import { dayPart, greetingText } from '@/lib/dashboard/greeting';
import { loadMap } from '@/lib/dashboard/load-map';
import { buildSummary, groupOverview, heroMood, limitGroups } from '@/lib/dashboard/overview';
import { routeHash } from '@/lib/dashboard/routes';
import { buildTaskItems, type TaskItem } from '@/lib/dashboard/tasks';
import { Checkbox } from '@/components/ui/checkbox';
import { useDoneUndo } from '../done-undo';
import { formatRemaining } from '@/lib/format/time';
import { describeChange } from '@/lib/radar/describe';
import { localParts } from '@/lib/reminders/zoned';
import { AcademicCard, nextForSummary, SummaryLine } from '../OverviewParts';
import { timeZone } from '../data';
import { Card, CardLink } from '../Shell';
import type { PageProps } from '../types';

const LEVELS = [1, 2, 3, 4] as const;

type Row = TaskItem & { dueAt: number | null };

export function RingkasanPage({ d, data, actions }: PageProps) {
  const { m } = useI18n();
  const r = d.ringkasan;
  const user = data.user!;
  const done = useDoneUndo(actions, d, data.today);
  const allItems = useMemo(() => buildTaskItems(user), [user]);
  // Pending tasks, plus the ones just marked done (they stay in place for the undo window).
  const pendingItems = useMemo(() => allItems.filter((i) => i.status === 'pending' || done.lingering.has(i.task.eventId)), [allItems, done.lingering]);
  const rows = useMemo<Row[]>(() => pendingItems.map((i) => ({ ...i, dueAt: i.task.dueAt })), [pendingItems]);
  const groups = useMemo(() => groupOverview(rows, data.now, timeZone), [rows, data.now]);
  const shown = limitGroups(groups);
  const overdue = groups.find((g) => g.key === 'overdue')?.rows.length ?? 0;
  const dueThisWeek = groups.filter((g) => g.key !== 'overdue').reduce((n, g) => n + g.rows.length, 0);

  const days = useMemo(() => loadMap(pendingItems.map((i) => i.task), data.calendar.kegiatan, data.now, timeZone), [pendingItems, data.calendar, data.now]);
  const loadEmpty = days.every((day) => day.tasks.length === 0 && day.events.length === 0);
  const updates = data.view.updates.slice(0, 6);
  const hour = Math.floor(localParts(data.now, timeZone).minuteOfDay / 60);
  const summary = buildSummary({ overdue, dueThisWeek, next: nextForSummary(data.calendar, data.today, d) });

  return (
    <div className="space-y-4">
      {/* Hero: no card. One mascot on this page; it idles and stops for reduced motion (Mascot handles both). */}
      <section className="flex items-center gap-4 pb-2">
        <Mascot state={heroMood(overdue, dueThisWeek)} size={56} />
        <div className="min-w-0">
          <h2 className="text-[20px] leading-7 font-semibold">{greetingText(r.greeting[dayPart(hour)], data.prefs.nickname)}</h2>
          <SummaryLine parts={summary} d={d} />
        </div>
      </section>

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title={r.tasksTitle} action={<CardLink href={routeHash('tugas')}>{r.allTasks}</CardLink>} className="flex flex-col">
          {shown.groups.length === 0 ? (
            // The card stretches to the calendar card's height; the one line sits in its middle instead of leaving a hole below.
            <p className="flex flex-1 items-center justify-center py-8 text-center text-[14px] text-muted-foreground">{r.nothingSoon}</p>
          ) : (
            <div className="space-y-4">
              {shown.groups.map((g) => (
                <section key={g.key} aria-label={r.groups[g.key]}>
                  <h3 className="mb-1 text-[12px] font-semibold text-muted-foreground">{r.groups[g.key]}</h3>
                  <ul>
                    {g.rows.map((row) => (
                      <li key={row.task.eventId} className={`-mx-2 flex items-start gap-3 rounded-lg px-2 hover:bg-surface-raised ${done.collapsing.has(row.task.eventId) ? 'db-collapse' : ''}`}>
                        <Checkbox
                          className="mt-3"
                          checked={row.status === 'done'}
                          onCheckedChange={(v) => (v === true ? done.mark(row.task.eventId) : done.unmark(row.task.eventId))}
                          aria-label={`${row.status === 'done' ? d.tugas.markUndone : d.tugas.markDone}: ${row.task.name}`}
                        />
                        <a href={routeHash('tugas', row.task.eventId)} className="flex min-w-0 flex-1 items-start gap-3 rounded-lg py-2 outline-none focus-ring:ring-2 focus-ring:ring-focus">
                          <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full" style={{ background: `var(--course-${row.courseColor})` }} />
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-[14px] ${row.status === 'done' ? 'text-muted-foreground line-through' : 'font-semibold'}`} title={row.task.name}>
                              {row.task.name}
                            </span>
                            <span className="block truncate text-[12px] text-muted-foreground" title={row.courseName}>
                              {row.courseName}
                            </span>
                          </span>
                          <span className={`shrink-0 text-[12px] leading-6 tabular-nums ${g.key === 'overdue' ? 'text-urgency-overdue' : 'text-muted-foreground'}`}>
                            {row.dueAt !== null ? formatRemaining(row.dueAt, data.now, timeZone, m) : ''}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {shown.hidden > 0 && (
                <a href={routeHash('tugas')} className="inline-block rounded text-[14px] text-muted-foreground outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus">
                  {r.moreRows(shown.hidden)}
                </a>
              )}
            </div>
          )}
        </Card>

        <Card title={r.calendarTitle} action={<CardLink href={routeHash('kalender')}>{r.openCalendar}</CardLink>} className="flex flex-col [&>div:last-child]:flex-1">
          <AcademicCard calendar={data.calendar} today={data.today} d={d} />
        </Card>
      </div>

      <Card title={r.loadTitle}>
        {loadEmpty ? (
          <p className="text-[14px] text-muted-foreground">{r.loadEmpty}</p>
        ) : (
          <>
            <p className="mb-3 text-[12px] text-muted-foreground">{r.loadHelp}</p>
            <ol className="grid grid-cols-7 gap-2 sm:grid-cols-14">
              {days.map((day) => {
                const events = day.events.map((e) => d.kalender.kategori[e.kategori] ?? e.judul).filter((v, i, a) => a.indexOf(v) === i).join(', ');
                const label = r.loadDay(formatDateKey(day.dateKey, m.intl, { weekday: 'long', day: 'numeric', month: 'long' }), day.tasks.length, events);
                const exam = day.events.some((e) => e.kategori === 'uts' || e.kategori === 'uas');
                return (
                  <li key={day.dateKey} title={label} aria-label={label} className={`db-load-${day.level} flex aspect-square flex-col items-center justify-center rounded-lg text-[12px] leading-4 tabular-nums`}>
                    <span>{formatDateKey(day.dateKey, m.intl, { weekday: 'narrow' })}</span>
                    <span className="font-semibold">{formatDateKey(day.dateKey, m.intl, { day: 'numeric' })}</span>
                    {exam && <span aria-hidden="true" className="mt-1 size-1 rounded-full bg-current" />}
                  </li>
                );
              })}
            </ol>
            {/* Legend only with data: the four filled levels, lightest to darkest. */}
            <div className="mt-3 flex items-center justify-end gap-2 text-[12px] text-muted-foreground" aria-hidden="true">
              <span>{r.loadLess}</span>
              {LEVELS.map((l) => (
                <span key={l} className={`db-load-${l} size-3 rounded`} />
              ))}
              <span>{r.loadMore}</span>
            </div>
          </>
        )}
      </Card>

      <Card title={r.updatesTitle} action={<CardLink href={routeHash('kabar')}>{r.allUpdates}</CardLink>}>
        {updates.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">{r.updatesEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {updates.map((e) => {
              const course = e.change.courseId !== null ? (data.view.courseNames[String(e.change.courseId)] ?? '') : '';
              return (
                <li key={e.id} className="flex items-baseline gap-2 text-[14px]">
                  <span aria-hidden="true" className={`size-2 shrink-0 self-center rounded-full ${e.seen ? 'bg-transparent' : 'bg-brand-amber'}`} />
                  <span className={`min-w-0 flex-1 ${e.seen ? '' : 'font-semibold'}`}>{describeChange(e.change, timeZone, m)}</span>
                  <span className="max-w-[40%] shrink-0 truncate text-[12px] text-muted-foreground" title={course}>
                    {course}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

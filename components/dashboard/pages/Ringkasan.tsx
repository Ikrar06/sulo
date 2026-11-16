import { useMemo } from 'react';
import { useI18n } from '@/components/i18n';
import { ChevronRightIcon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { formatDateKey } from '@/lib/calendar/countdown';
import { dayPart } from '@/lib/dashboard/greeting';
import { loadMap } from '@/lib/dashboard/load-map';
import { routeHash } from '@/lib/dashboard/routes';
import { buildTaskItems } from '@/lib/dashboard/tasks';
import { formatRemaining } from '@/lib/format/time';
import { describeChange } from '@/lib/radar/describe';
import { localParts } from '@/lib/reminders/zoned';
import type { TaskGroupView } from '@/lib/view/popup-view';
import { ImportantCard, SourceLine, WeekProgress } from '../CalendarParts';
import { timeZone } from '../data';
import { Card } from '../Shell';
import type { PageProps } from '../types';

const linkClass =
  'inline-flex items-center gap-1 rounded text-[12px] text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-ring:ring-2 focus-ring:ring-focus';

const LEVELS = [1, 2, 3, 4] as const;

export function RingkasanPage({ d, data }: PageProps) {
  const { m } = useI18n();
  const r = d.ringkasan;
  const user = data.user!;
  const groups = data.view.groups;
  const group = (key: TaskGroupView['key']) => groups.find((g) => g.key === key)?.rows ?? [];
  const pending = useMemo(() => buildTaskItems(user).filter((i) => i.status === 'pending').map((i) => i.task), [user]);
  const days = useMemo(() => loadMap(pending, data.calendar.kegiatan, data.now, timeZone), [pending, data.calendar, data.now]);
  const loadEmpty = days.every((day) => day.tasks.length === 0 && day.events.length === 0);
  const updates = data.view.updates.slice(0, 6);
  const hour = Math.floor(localParts(data.now, timeZone).minuteOfDay / 60);

  const taskList = (rows: ReturnType<typeof group>, empty: string) =>
    rows.length === 0 ? (
      <p className="text-[14px] text-muted-foreground">{empty}</p>
    ) : (
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.eventId}>
            <a href={routeHash('tugas', row.eventId)} className="flex items-start gap-3 rounded-lg px-2 py-2 outline-none hover:bg-surface-raised focus-ring:ring-2 focus-ring:ring-focus">
              <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full" style={{ background: `var(--course-${row.courseColor})` }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{row.name}</span>
                <span className="block truncate text-[12px] text-muted-foreground">{row.courseName}</span>
              </span>
              <span className="shrink-0 text-[12px] leading-6 text-muted-foreground tabular-nums">{row.dueAt !== null ? formatRemaining(row.dueAt, data.now, timeZone, m) : ''}</span>
            </a>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="space-y-4">
      <p className="text-[16px] text-muted-foreground">{r.greeting[dayPart(hour)]}</p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {group('overdue').length > 0 && <Card title={r.overdue}>{taskList(group('overdue'), '')}</Card>}
          <Card
            title={r.today}
            action={
              <a href={routeHash('tugas')} className={linkClass}>
                {r.allTasks}
                <ChevronRightIcon className="size-3" />
              </a>
            }
          >
            {taskList(group('soon'), r.nothingToday)}
          </Card>
          <Card title={r.week}>{taskList(group('week'), r.nothingWeek)}</Card>
        </div>
        <div className="space-y-4">
          <Card
            title={r.importantTitle}
            action={
              <a href={routeHash('kalender')} className={linkClass}>
                {r.openCalendar}
                <ChevronRightIcon className="size-3" />
              </a>
            }
          >
            <ImportantCard calendar={data.calendar} today={data.today} d={d} />
          </Card>
          <Card>
            <WeekProgress calendar={data.calendar} today={data.today} d={d} />
          </Card>
          <SourceLine calendar={data.calendar} d={d} />
        </div>
      </div>

      <Card title={r.loadTitle}>
        {loadEmpty ? (
          <div className="flex items-center gap-3">
            <Mascot state="all-done" size={40} still />
            <p className="text-[14px] text-muted-foreground">{r.loadEmpty}</p>
          </div>
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
            {/* Legend: the four filled levels, lightest to darkest. */}
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

      <Card
        title={r.updatesTitle}
        action={
          <a href={routeHash('kabar')} className={linkClass}>
            {r.allUpdates}
            <ChevronRightIcon className="size-3" />
          </a>
        }
      >
        {updates.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">{r.updatesEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {updates.map((e) => (
              <li key={e.id} className="flex items-baseline gap-2 text-[14px]">
                <span aria-hidden="true" className={`size-2 shrink-0 self-center rounded-full ${e.seen ? 'bg-transparent' : 'bg-brand-amber'}`} />
                <span className={`min-w-0 flex-1 ${e.seen ? '' : 'font-semibold'}`}>{describeChange(e.change, timeZone, m)}</span>
                <span className="shrink-0 truncate text-[12px] text-muted-foreground">{e.change.courseId !== null ? data.view.courseNames[String(e.change.courseId)] : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

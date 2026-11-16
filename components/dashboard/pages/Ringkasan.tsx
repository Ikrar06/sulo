import { useMemo } from 'react';
import { useI18n } from '@/components/i18n';
import { ChevronRightIcon } from '@/components/icons';
import { formatDateKey } from '@/lib/calendar/countdown';
import { buildTaskItems } from '@/lib/dashboard/tasks';
import { loadMap } from '@/lib/dashboard/load-map';
import { routeHash } from '@/lib/dashboard/routes';
import { formatRemaining } from '@/lib/format/time';
import { describeChange } from '@/lib/radar/describe';
import type { TaskGroupView } from '@/lib/view/popup-view';
import { timeZone } from '../data';
import { ImportantCard, SourceLine, WeekText } from '../CalendarParts';
import { Card } from '../Shell';
import type { PageProps } from '../types';

const linkClass = 'inline-flex items-center gap-1 rounded text-[13px] text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-ring:ring-2 focus-ring:ring-focus';

export function RingkasanPage({ d, data }: PageProps) {
  const { m } = useI18n();
  const r = d.ringkasan;
  const user = data.user!;
  const groups = data.view.groups;
  const group = (key: TaskGroupView['key']) => groups.find((g) => g.key === key)?.rows ?? [];
  const pending = useMemo(() => buildTaskItems(user).filter((i) => i.status === 'pending').map((i) => i.task), [user]);
  const days = useMemo(() => loadMap(pending, data.calendar.kegiatan, data.now, timeZone), [pending, data.calendar, data.now]);
  const updates = data.view.updates.slice(0, 6);

  const taskList = (rows: ReturnType<typeof group>, empty: string) =>
    rows.length === 0 ? (
      <p className="text-[13.5px] text-muted-foreground">{empty}</p>
    ) : (
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.eventId}>
            <a href={routeHash('tugas', row.eventId)} className="flex items-start gap-3 rounded-lg px-2 py-1.5 outline-none hover:bg-surface-raised focus-ring:ring-2 focus-ring:ring-focus">
              <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: `var(--course-${row.courseColor})` }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{row.name}</span>
                <span className="block truncate text-[12.5px] text-muted-foreground">{row.courseName}</span>
              </span>
              <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">{row.dueAt !== null ? formatRemaining(row.dueAt, data.now, timeZone, m) : ''}</span>
            </a>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="space-y-5">
      <p className="text-[15px] text-muted-foreground">{r.greeting(data.prefs.nickname)}</p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {group('overdue').length > 0 && <Card title={r.overdue}>{taskList(group('overdue'), '')}</Card>}
          <Card title={r.today} action={<a href={routeHash('tugas')} className={linkClass}>{r.allTasks}<ChevronRightIcon className="size-3.5" /></a>}>
            {taskList(group('soon'), r.nothingToday)}
          </Card>
          <Card title={r.week}>{taskList(group('week'), r.nothingWeek)}</Card>
        </div>
        <div className="space-y-5">
          <Card title={r.importantTitle} action={<a href={routeHash('kalender')} className={linkClass}>{r.openCalendar}<ChevronRightIcon className="size-3.5" /></a>}>
            <ImportantCard calendar={data.calendar} today={data.today} d={d} />
            <div className="mt-3 border-t border-border pt-3">
              <WeekText calendar={data.calendar} today={data.today} d={d} />
            </div>
            <div className="mt-3">
              <SourceLine calendar={data.calendar} d={d} />
            </div>
          </Card>
        </div>
      </div>

      <Card title={r.loadTitle}>
        <p className="-mt-1 mb-3 text-[13px] text-muted-foreground">{r.loadHelp}</p>
        <ol className="grid grid-cols-7 gap-1.5 sm:grid-cols-14">
          {days.map((day) => {
            const events = day.events.map((e) => d.kalender.kategori[e.kategori] ?? e.judul).filter((v, i, a) => a.indexOf(v) === i).join(', ');
            const label = r.loadDay(formatDateKey(day.dateKey, m.intl, { weekday: 'long', day: 'numeric', month: 'long' }), day.tasks.length, events);
            return (
              <li key={day.dateKey} title={label} aria-label={label} className={`db-load-${day.level} flex aspect-square flex-col items-center justify-center rounded-lg text-[12px] tabular-nums`}>
                <span className="text-[11px] opacity-75">{formatDateKey(day.dateKey, m.intl, { weekday: 'narrow' })}</span>
                <span className="font-semibold">{formatDateKey(day.dateKey, m.intl, { day: 'numeric' })}</span>
                {day.events.some((e) => e.kategori === 'uts' || e.kategori === 'uas') && <span aria-hidden="true" className="mt-0.5 size-1 rounded-full bg-foreground" />}
              </li>
            );
          })}
        </ol>
      </Card>

      <Card title={r.updatesTitle} action={<a href={routeHash('kabar')} className={linkClass}>{r.allUpdates}<ChevronRightIcon className="size-3.5" /></a>}>
        {updates.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">{r.updatesEmpty}</p>
        ) : (
          <ul className="space-y-1.5">
            {updates.map((e) => (
              <li key={e.id} className="flex items-start gap-2 text-[13.5px]">
                {!e.seen && <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand-amber" />}
                <span className={e.seen ? 'text-foreground/85' : 'font-medium'}>{describeChange(e.change, timeZone, m)}</span>
                <span className="ml-auto shrink-0 truncate pl-2 text-[12.5px] text-muted-foreground">{e.change.courseId !== null ? data.view.courseNames[String(e.change.courseId)] : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useI18n } from '@/components/i18n';
import { AlertIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { formatDateKey } from '@/lib/calendar/countdown';
import { calendarEvents, CALENDAR_GROUPS, holidayDays, type CalendarGroup, type TaskForCalendar } from '@/lib/calendar/groups';
import { monthGrid, shiftMonth } from '@/lib/calendar/month';
import { calendarStatus } from '@/lib/calendar/status';
import { buildTaskItems } from '@/lib/dashboard/tasks';
import { localParts } from '@/lib/reminders/zoned';
import { ListView } from '../calendar/ListView';
import { MonthView } from '../calendar/MonthView';
import { SelectedDay, Upcoming } from '../calendar/SidePanels';
import { Subscribe } from '../calendar/Subscribe';
import { CalendarStrip, SourceFooter } from '../CalendarParts';
import { timeZone } from '../data';
import type { PageProps } from '../types';
import { linkedMeetings } from '@/lib/neosia/linked';
import { holidayRanges, occurrences, semesterRange } from '@/lib/neosia/schedule';
import { classMeetings } from '@/lib/neosia/view';
import { addDays } from '@/lib/calendar/dates';

type View = 'month' | 'list';

export function KalenderPage({ d, data, actions }: PageProps) {
  const { m } = useI18n();
  const k = d.kalender;
  const calendar = data.calendar;
  const filter = data.prefs.calendarFilter;
  const [view, setView] = useState<View>('month');
  const [month, setMonth] = useState(data.today.slice(0, 7));
  const [selected, setSelected] = useState(data.today);
  const status = calendarStatus(calendar, data.today);

  // Task deadlines by local day (pending tasks of followed courses, personal due dates included).
  const tasks = useMemo<TaskForCalendar[]>(
    () =>
      data.user
        ? buildTaskItems(data.user)
            .filter((i) => i.status === 'pending' && i.task.dueAt !== null)
            .map((i) => ({ eventId: i.task.eventId, name: i.task.name, courseName: i.courseName, courseColor: i.courseColor, dueAt: i.task.dueAt!, dateKey: localParts(i.task.dueAt!, timeZone).dateKey }))
        : [],
    [data.user],
  );
  // Classes from NEOSIA (module on): this semester's meetings, or 20 weeks from today without teaching weeks.
  const neosiaOn = data.neosia.module.enabled;
  const classes = useMemo(() => {
    if (!neosiaOn) return [];
    const meetings = linkedMeetings(classMeetings(data.neosia.snapshots), data.user?.courses ?? [], data.neosia.courseMap);
    if (meetings.length === 0) return [];
    const range = semesterRange(calendar, data.today);
    const from = range?.start ?? data.today;
    const to = range?.end ?? addDays(data.today, 140);
    return occurrences(meetings, from, to, holidayRanges(calendar)).map((o, i) => ({
      id: `kuliah-${o.day}-${i}`,
      dateKey: o.day,
      name: o.meeting.className ? `${o.meeting.displayName} ${o.meeting.className}` : o.meeting.displayName,
      courseColor: o.meeting.color,
      start: o.meeting.start,
      end: o.meeting.end,
      room: o.meeting.room,
      holiday: o.holiday,
    }));
  }, [neosiaOn, data.neosia, data.user, calendar, data.today]);
  const events = useMemo(() => calendarEvents(calendar, tasks, filter, { classes }), [calendar, tasks, filter, classes]);
  const listEvents = useMemo(() => calendarEvents(calendar, [], filter, { estimates: true }), [calendar, filter]);
  const holidays = useMemo(() => holidayDays(calendar), [calendar]);

  const toggle = (g: CalendarGroup) => void actions.setPrefs({ calendarFilter: { ...filter, [g]: !filter[g] } });
  const select = (day: string, keyboard: boolean) => {
    setSelected(day);
    // Arrow keys past the grid's edge turn the page; a click on a neighbouring month's day keeps the month.
    if (keyboard && !monthGrid(month).flat().includes(day)) setMonth(day.slice(0, 7));
  };

  const viewButton = (v: View, label: string) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => setView(v)}
      className={`h-7 rounded-md px-3 text-[14px] outline-none focus-ring:ring-2 focus-ring:ring-focus ${view === v ? 'bg-surface font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {status.kind === 'expired' ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-border bg-surface p-5">
          <AlertIcon className="mt-1 size-4 shrink-0" />
          <div>
            <p className="text-[16px] leading-6 font-semibold">{k.expiredTitle}</p>
            <p className="text-[14px] text-muted-foreground">{k.expiredBody(formatDateKey(status.berlakuSampai, m.intl, { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
          </div>
        </div>
      ) : (
        <CalendarStrip calendar={calendar} today={data.today} d={d} />
      )}

      {/* Toolbar: view, month, today, then the category chips (legend and filter); chips wrap to a second line, left-aligned. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="group" aria-label={k.viewLabel} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-surface-raised p-0.5">{/* lint-ui-allow: 2 px inset keeps the segmented control at 32 px */}
          {viewButton('month', k.month)}
          {viewButton('list', k.list)}
        </div>
        {view === 'month' && (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" aria-label={k.prevMonth} onClick={() => setMonth(shiftMonth(month, -1))}>
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="min-w-36 text-center text-[16px] font-semibold" aria-live="polite">
              {formatDateKey(`${month}-01`, m.intl, { month: 'long', year: 'numeric' })}
            </span>
            <Button size="icon" variant="ghost" aria-label={k.nextMonth} onClick={() => setMonth(shiftMonth(month, 1))}>
              <ChevronRightIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="ml-2"
              onClick={() => {
                setMonth(data.today.slice(0, 7));
                setSelected(data.today);
              }}
            >
              {k.today}
            </Button>
          </div>
        )}
        <div role="group" aria-label={k.filterLabel} className="flex flex-wrap gap-2">
          {CALENDAR_GROUPS.filter((g) => g !== 'kuliah' || neosiaOn).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={filter[g]}
              onClick={() => toggle(g)}
              className={`db-cat-${g} inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[12px] outline-none focus-ring:ring-2 focus-ring:ring-focus ${
                filter[g] ? 'border-border bg-surface font-semibold text-foreground' : 'border-dashed border-border text-muted-foreground'
              }`}
            >
              <span aria-hidden="true" className={`size-2 rounded-full ${filter[g] ? 'db-cat-dot' : 'border border-muted-foreground'}`} />
              {k.groups[g]}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' ? (
        <div className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_320px]">
          <MonthView month={month} today={data.today} events={events} holidays={holidays} selected={selected} onSelect={select} d={d} />
          <div className="space-y-4">
            <SelectedDay day={selected} events={events} angkatan={data.prefs.angkatan} d={d} countdown={data.prefs.dueFormat === 'countdown'} now={data.now} />
            <Upcoming events={events} today={data.today} d={d} onSelect={(day) => select(day, true)} />
          </div>
        </div>
      ) : (
        <ListView events={listEvents} today={data.today} d={d} />
      )}

      <div className="pt-4">
        <Subscribe d={d} />
      </div>
      <SourceFooter calendar={calendar} d={d} />
    </div>
  );
}

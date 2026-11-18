// Kalender: the list view first (it reads best on a phone), and a compact
// month: dots on days with events, tap a day to see its events. Category
// chips filter both and are saved like the dashboard's. Subscribing opens
// Google Calendar (or another app) in the browser.

import { useMemo, useState } from 'react';
import { formatDateKey } from '@sulo/core/calendar/countdown';
import { calendarEvents, CALENDAR_GROUPS, eventsOnDay, holidayDays, type CalendarGroup, type TaskForCalendar } from '@sulo/core/calendar/groups';
import { monthGrid, shiftMonth } from '@sulo/core/calendar/month';
import { calendarStatus } from '@sulo/core/calendar/status';
import { buildTaskItems } from '@sulo/core/dashboard/tasks';
import { mobileDash } from '@sulo/core/i18n/mobile';
import { localParts } from '@sulo/core/reminders/zoned';
import { CalendarStrip, SourceFooter } from '@sulo/ui/dashboard/CalendarParts';
import { ListView } from '@sulo/ui/dashboard/calendar/ListView';
import { SelectedDay } from '@sulo/ui/dashboard/calendar/SidePanels';
import { Subscribe } from '@sulo/ui/dashboard/calendar/Subscribe';
import { useI18n } from '@sulo/ui/i18n';
import { ChevronLeftIcon, ChevronRightIcon } from '@sulo/ui/icons';
import { timeZone, useMobileData } from '../shell/data';
import { chip } from './ui';

type View = 'list' | 'month';

export function KalenderScreen() {
  const { m, locale } = useI18n();
  const d = mobileDash(locale);
  const k = d.kalender;
  const { data, actions } = useMobileData();
  const calendar = data!.calendar;
  const today = data!.today;
  const filter = data!.prefs.calendarFilter;
  const [view, setView] = useState<View>('list');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const status = calendarStatus(calendar, today);

  const tasks = useMemo<TaskForCalendar[]>(
    () =>
      data!.user
        ? buildTaskItems(data!.user)
            .filter((i) => i.status === 'pending' && i.task.dueAt !== null)
            .map((i) => ({ eventId: i.task.eventId, name: i.task.name, courseName: i.courseName, courseColor: i.courseColor, dueAt: i.task.dueAt!, dateKey: localParts(i.task.dueAt!, timeZone).dateKey }))
        : [],
    [data],
  );
  const events = useMemo(() => calendarEvents(calendar, tasks, filter), [calendar, tasks, filter]);
  const listEvents = useMemo(() => calendarEvents(calendar, [], filter, { estimates: true }), [calendar, filter]);
  const holidays = useMemo(() => holidayDays(calendar), [calendar]);
  const toggle = (g: CalendarGroup) => void actions.setPrefs({ calendarFilter: { ...filter, [g]: !filter[g] } });

  return (
    <div className="space-y-4">
      {status.kind === 'expired' ? (
        <section role="alert" className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[16px] font-semibold">{k.expiredTitle}</p>
          <p className="text-[14px] text-muted-foreground">{k.expiredBody(formatDateKey(status.berlakuSampai, m.intl, { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
        </section>
      ) : (
        <CalendarStrip calendar={calendar} today={today} d={d} />
      )}

      <div role="group" aria-label={k.viewLabel} className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-raised p-1">
        {(['list', 'month'] as const).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`min-h-11 rounded-md text-[14px] outline-none focus-ring:ring-2 focus-ring:ring-focus ${view === v ? 'bg-surface font-semibold' : 'text-muted-foreground'}`}>
            {v === 'list' ? k.list : k.month}
          </button>
        ))}
      </div>

      {/* Category chips: legend and filter in one; they scroll sideways. */}
      <div role="group" aria-label={k.filterLabel} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {CALENDAR_GROUPS.filter((g) => g !== 'kuliah').map((g) => (
          <button key={g} type="button" aria-pressed={filter[g]} onClick={() => toggle(g)} className={`db-cat-${g} ${chip(false)} gap-2 ${filter[g] ? 'font-semibold' : 'border-dashed text-muted-foreground'}`}>
            <span aria-hidden="true" className={`size-2 rounded-full ${filter[g] ? 'db-cat-dot' : 'border border-muted-foreground'}`} />
            {k.groups[g]}
          </button>
        ))}
      </div>

      {view === 'list' ? (
        <ListView events={listEvents} today={today} d={d} />
      ) : (
        <>
          <div className="flex items-center gap-1">
            <button type="button" aria-label={k.prevMonth} onClick={() => setMonth(shiftMonth(month, -1))} className="inline-flex size-11 items-center justify-center rounded-lg outline-none focus-ring:ring-2 focus-ring:ring-focus">
              <ChevronLeftIcon className="size-5" />
            </button>
            <span className="flex-1 text-center text-[16px] font-semibold" aria-live="polite">
              {formatDateKey(`${month}-01`, m.intl, { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" aria-label={k.nextMonth} onClick={() => setMonth(shiftMonth(month, 1))} className="inline-flex size-11 items-center justify-center rounded-lg outline-none focus-ring:ring-2 focus-ring:ring-focus">
              <ChevronRightIcon className="size-5" />
            </button>
          </div>
          <CompactMonth month={month} today={today} selected={selected} onSelect={setSelected} dotsOn={(day) => eventsOnDay(events, day).length} holidays={holidays} intl={m.intl} />
          <SelectedDay day={selected} events={events} angkatan={data!.prefs.angkatan} d={d} countdown={data!.prefs.dueFormat === 'countdown'} now={data!.now} />
        </>
      )}

      <Subscribe d={d} />
      <SourceFooter calendar={calendar} d={d} />
    </div>
  );
}

/** Seven columns of 44 px days; a dot under a day with events, holidays in the holiday color. */
function CompactMonth({ month, today, selected, onSelect, dotsOn, holidays, intl }: { month: string; today: string; selected: string; onSelect: (day: string) => void; dotsOn: (day: string) => number; holidays: ReadonlyMap<string, unknown> | ReadonlySet<string>; intl: string }) {
  const weeks = monthGrid(month);
  const heads = weeks[0]!.map((day) => formatDateKey(day, intl, { weekday: 'narrow' }));
  return (
    <div role="grid" aria-label={formatDateKey(`${month}-01`, intl, { month: 'long', year: 'numeric' })} className="rounded-xl border border-border bg-surface p-2">
      <div role="row" className="grid grid-cols-7">
        {heads.map((h, i) => (
          <span key={i} role="columnheader" className="py-1 text-center text-[12px] text-muted-foreground">
            {h}
          </span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} role="row" className="grid grid-cols-7">
          {week.map((day) => {
            const inMonth = day.startsWith(month);
            const count = dotsOn(day);
            const isSelected = day === selected;
            const holiday = holidays.has(day);
            return (
              <button
                key={day}
                type="button"
                role="gridcell"
                aria-selected={isSelected}
                aria-current={day === today ? 'date' : undefined}
                aria-label={`${formatDateKey(day, intl, { weekday: 'long', day: 'numeric', month: 'long' })}${count > 0 ? `, ${count}` : ''}`}
                onClick={() => onSelect(day)}
                className={`flex min-h-11 flex-col items-center justify-center rounded-lg text-[14px] tabular-nums outline-none focus-ring:ring-2 focus-ring:ring-focus ${isSelected ? 'bg-foreground text-bg' : day === today ? 'ring-1 ring-foreground' : ''} ${inMonth ? '' : 'opacity-40'} ${holiday && !isSelected ? 'db-holiday-number' : ''}`}
              >
                {Number(day.slice(8))}
                <span aria-hidden="true" className={`mt-1 size-1 rounded-full ${count > 0 ? (isSelected ? 'bg-bg' : 'bg-current') : ''}`} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

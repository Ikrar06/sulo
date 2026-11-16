import { useId, useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '@/components/i18n';
import { AlertIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateKey } from '@/lib/calendar/countdown';
import { DEFAULT_CALENDAR_FILTER, shiftMonth, type CalendarFilter, type CalendarItem } from '@/lib/calendar/month';
import { KATEGORI, type Kategori } from '@/lib/calendar/schema';
import { calendarStatus } from '@/lib/calendar/status';
import { buildTaskItems } from '@/lib/dashboard/tasks';
import { routeHash } from '@/lib/dashboard/routes';
import { localParts } from '@/lib/reminders/zoned';
import { ListView } from '../calendar/ListView';
import { MonthView } from '../calendar/MonthView';
import { Subscribe } from '../calendar/Subscribe';
import { ImportantCard, SourceLine, WeekProgress } from '../CalendarParts';
import { timeZone } from '../data';
import { Card } from '../Shell';
import type { PageProps } from '../types';

type View = 'month' | 'list';

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  const id = useId();
  return (
    <span className="inline-flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <label htmlFor={id} className="text-[14px]">
        {children}
      </label>
    </span>
  );
}

export function KalenderPage({ d, data }: PageProps) {
  const { m } = useI18n();
  const k = d.kalender;
  const calendar = data.calendar;
  const [view, setView] = useState<View>('month');
  const [month, setMonth] = useState(data.today.slice(0, 7));
  const [selected, setSelected] = useState(data.today);
  const [filter, setFilter] = useState<CalendarFilter>(DEFAULT_CALENDAR_FILTER);
  const status = calendarStatus(calendar, data.today);

  // Task deadlines by local day (pending tasks of active courses, personal due dates included).
  const tasks = useMemo(
    () =>
      data.user
        ? buildTaskItems(data.user)
            .filter((i) => i.status === 'pending' && i.task.dueAt !== null)
            .map((i): Extract<CalendarItem, { type: 'tugas' }> => ({
              type: 'tugas',
              eventId: i.task.eventId,
              name: i.task.name,
              courseName: i.courseName,
              courseColor: i.courseColor,
              dateKey: localParts(i.task.dueAt!, timeZone).dateKey,
            }))
        : [],
    [data.user],
  );

  const viewButton = (v: View, label: string) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => setView(v)}
      className={`h-8 rounded-md px-3 text-[14px] outline-none focus-ring:ring-2 focus-ring:ring-focus ${view === v ? 'bg-surface font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {status.kind === 'expired' && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
          <AlertIcon className="mt-1 size-4 shrink-0 text-urgency-soon" />
          <div>
            <p className="text-[16px] leading-6 font-semibold">{k.expiredTitle}</p>
            <p className="text-[14px] text-muted-foreground">{k.expiredBody(formatDateKey(status.berlakuSampai, m.intl, { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
          </div>
        </div>
      )}

      {status.kind !== 'expired' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title={d.ringkasan.importantTitle}>
            <ImportantCard calendar={calendar} today={data.today} d={d} />
          </Card>
          <Card>
            <WeekProgress calendar={calendar} today={data.today} d={d} />
            <a href={routeHash('pengaturan', 'kalender')} className="mt-3 inline-block rounded text-[12px] text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus">
              {k.notifySettings}
            </a>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label={k.viewLabel} className="inline-flex gap-1 rounded-lg border border-border bg-surface-raised p-1">
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
              onClick={() => {
                setMonth(data.today.slice(0, 7));
                setSelected(data.today);
              }}
            >
              {k.thisMonth}
            </Button>
          </div>
        )}
        <Select value={filter.kategori ?? 'all'} onValueChange={(v) => setFilter({ ...filter, kategori: v === 'all' ? null : (v as Kategori) })}>
          <SelectTrigger className="w-56" aria-label={k.category}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{k.allCategories}</SelectItem>
            {KATEGORI.filter((c) => c !== 'penerimaan' || filter.applicants).map((c) => (
              <SelectItem key={c} value={c}>
                {k.kategori[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Toggle checked={filter.tasks} onChange={(tasksOn) => setFilter({ ...filter, tasks: tasksOn })}>
          {k.tasks}
        </Toggle>
        <Toggle checked={filter.holidays} onChange={(holidays) => setFilter({ ...filter, holidays })}>
          {k.holiday}
        </Toggle>
        <Toggle checked={filter.applicants} onChange={(applicants) => setFilter({ ...filter, applicants, kategori: !applicants && filter.kategori === 'penerimaan' ? null : filter.kategori })}>
          {k.showApplicants}
        </Toggle>
      </div>

      <SourceLine calendar={calendar} d={d} />

      {view === 'month' ? (
        <MonthView month={month} today={data.today} calendar={calendar} filter={filter} tasks={tasks} selected={selected} onSelect={setSelected} angkatan={data.prefs.angkatan} d={d} />
      ) : (
        <ListView calendar={calendar} filter={filter} today={data.today} angkatan={data.prefs.angkatan} d={d} />
      )}

      <Subscribe d={d} />
      <SourceLine calendar={calendar} d={d} />
    </div>
  );
}

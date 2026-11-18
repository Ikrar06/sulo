import { useMemo, useState } from 'react';
import { useI18n } from '@/components/i18n';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { Private } from '@/components/private';
import { Button } from '@/components/ui/button';
import { addDays } from '@/lib/calendar/dates';
import { formatDateKey } from '@/lib/calendar/countdown';
import { routeHash } from '@/lib/dashboard/routes';
import { formatAgo } from '@/lib/format/time';
import { neosiaWords } from '@/lib/i18n/neosia';
import { linkedMeetings, type LinkedMeeting } from '@/lib/neosia/linked';
import { holidayOn, holidayRanges, mondayOf, scheduleIcs, semesterRange } from '@/lib/neosia/schedule';
import { classMeetings, krsSemester, neosiaStatus } from '@/lib/neosia/view';
import { Card } from '../Shell';
import type { PageProps } from '../types';

// Weekly class schedule from NEOSIA (M7 part E3): Monday to Saturday, one
// block per class with course, time, room and lecturers. A class on a
// holiday stays visible, dimmed, with the holiday's name. "Tambah ke Google
// Kalender" builds a recurring ICS file locally and downloads it; nothing
// is sent anywhere.

const WEEK_DAYS = [1, 2, 3, 4, 5, 6] as const;

/** "07:30" → "07.30" in Indonesian, unchanged in English. */
const clock = (hhmm: string, locale: string) => (locale === 'id' ? hhmm.replace(':', '.') : hhmm);

function downloadIcs(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jadwal-kuliah-sulo.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function JadwalPage({ data }: PageProps) {
  const { m, locale } = useI18n();
  const w = neosiaWords(locale);
  const j = w.jadwal;
  const calendar = data.calendar;
  const meetings = useMemo(() => linkedMeetings(classMeetings(data.neosia.snapshots), data.user?.courses ?? [], data.neosia.courseMap), [data.neosia, data.user]);
  const holidays = useMemo(() => holidayRanges(calendar), [calendar]);
  const range = useMemo(() => semesterRange(calendar, data.today), [calendar, data.today]);
  const [monday, setMonday] = useState(() => mondayOf(data.today));
  const status = neosiaStatus(data.neosia.snapshots);
  const [icsMissing, setIcsMissing] = useState(false);

  if (meetings.length === 0) {
    return (
      <Card>
        <p className="text-[14px] font-semibold">{w.noData}</p>
        <p className="mt-1 text-[14px] text-muted-foreground">{j.empty}</p>
        {status.changedShape.includes('belanja_krs') && <p className="mt-2 text-[12px] text-muted-foreground">{w.changedShape}</p>}
      </Card>
    );
  }

  const fmt = (day: string, opts: Intl.DateTimeFormatOptions) => formatDateKey(day, m.intl, opts);
  const sunday = addDays(monday, 6);
  const thisWeek = mondayOf(data.today);
  const makeIcs = () => {
    const stamp = new Date(data.now * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const text = scheduleIcs(meetings, calendar, range, krsSemester(data.neosia.snapshots), stamp);
    if (text) downloadIcs(text);
    setIcsMissing(text === null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label={j.prev} onClick={() => setMonday(addDays(monday, -7))}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="min-w-56 text-center text-[16px] font-semibold" aria-live="polite">
            {j.week(fmt(monday, { day: 'numeric', month: 'short' }), fmt(sunday, { day: 'numeric', month: 'short', year: 'numeric' }))}
          </span>
          <Button size="icon" variant="ghost" aria-label={j.next} onClick={() => setMonday(addDays(monday, 7))}>
            <ChevronRightIcon className="size-4" />
          </Button>
          <Button variant="outline" className="ml-2" disabled={monday === thisWeek} onClick={() => setMonday(thisWeek)}>
            {j.thisWeek}
          </Button>
        </div>
        <Button variant="outline" className="ml-auto" onClick={makeIcs}>
          {j.ics}
        </Button>
      </div>
      <p className="max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{icsMissing ? j.icsUnavailable : j.icsHelp}</p>

      <ol className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {WEEK_DAYS.map((wd) => {
          const day = addDays(monday, wd - 1);
          const holiday = holidayOn(holidays, day);
          const today = day === data.today;
          const items = meetings.filter((x) => x.weekday === wd);
          return (
            <li key={wd} aria-current={today ? 'date' : undefined} className="min-w-0 rounded-xl border border-border bg-surface p-3">
              <h2 className="flex items-baseline justify-between gap-2 text-[14px] font-semibold">
                <span>{j.days[wd]}</span>
                <span className={`text-[12px] tabular-nums ${today ? 'font-semibold text-brand-orange' : 'font-normal text-muted-foreground'}`}>{fmt(day, { day: 'numeric', month: 'short' })}</span>
              </h2>
              {holiday && <p className="mt-1 text-[12px] text-muted-foreground">{j.holiday(holiday)}</p>}
              {items.length === 0 ? (
                <p className="mt-2 text-[12px] text-muted-foreground">{j.noClass}</p>
              ) : (
                <ul className={`mt-2 space-y-2 ${holiday ? 'opacity-50' : ''}`}>
                  {items.map((x, i) => (
                    <ClassBlock key={`${x.key}-${x.start}-${i}`} x={x} locale={locale} />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      <p className="text-[12px] text-muted-foreground">{status.lastSeenAt === null ? '' : j.updated(formatAgo(status.lastSeenAt, data.now, m))}</p>
    </div>
  );
}

function ClassBlock({ x, locale }: { x: LinkedMeeting; locale: string }) {
  const j = neosiaWords(locale === 'en' ? 'en' : 'id').jadwal;
  return (
    <li className="rounded-lg border border-border p-2">
      <p className="flex items-start gap-2 text-[14px] leading-5 font-semibold">
        <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full" style={{ background: x.color === null ? 'var(--muted)' : `var(--course-${x.color})` }} />
        <span className="min-w-0">
          {x.displayName}
          {x.className ? ` ${x.className}` : ''}
        </span>
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground tabular-nums">
        {clock(x.start, locale)}–{clock(x.end, locale)}
      </p>
      {/* NEOSIA's room name already says what it is ("Ruang Kuliah 101", "Lab Hidrolika"). */}
      {x.room && <p className="text-[12px] text-muted-foreground">{x.room}</p>}
      {x.lecturers.length > 0 && (
        <p className="text-[12px] text-muted-foreground">
          <Private>{x.lecturers.join(', ')}</Private>
        </p>
      )}
      {x.course === null && (
        <a href={routeHash('mata-kuliah')} className="mt-1 inline-block rounded text-[12px] text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus">
          {j.unmapped}
        </a>
      )}
    </li>
  );
}

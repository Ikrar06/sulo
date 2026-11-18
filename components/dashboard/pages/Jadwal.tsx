import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/components/i18n';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { Private } from '@/components/private';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays } from '@/lib/calendar/dates';
import { formatDateKey } from '@/lib/calendar/countdown';
import { courseNameWithClass } from '@/lib/courses/display-name';
import { formatAgo } from '@/lib/format/time';
import { neosiaWords } from '@/lib/i18n/neosia';
import { NEOSIA_LOGIN_URL } from '@/lib/links';
import { setCourseLink } from '@/lib/neosia/course-map';
import { linkedMeetings, type LinkedMeeting } from '@/lib/neosia/linked';
import { holidayOn, holidayRanges, mondayOf, scheduleIcs, semesterRange } from '@/lib/neosia/schedule';
import { classMeetings, krsSemester, neosiaStatus } from '@/lib/neosia/view';
import { gridDays, gridRange, lanes, SLOT_MIN, toMinutes } from '@/lib/neosia/week-grid';
import { localParts } from '@/lib/reminders/zoned';
import type { CourseRecord } from '@/lib/types';
import { local, timeZone } from '../data';
import { InfoCircleIcon } from '../icons';
import { useNeosiaConnect } from '../neosia-connect';
import { Card } from '../Shell';
import type { PageProps } from '../types';

// Weekly class schedule from NEOSIA (M7.1). Wide screens (1100 px and up):
// a time grid, Monday to Saturday (Sunday only with a class), one block per
// class at its time, tinted with the course color. Narrow screens: a list by
// day. Lecturers and linking to SIKOLA live in the block's popover. The
// calendar file is built here and downloaded; nothing is sent anywhere.

const SLOT_PX = 32;
const WIDE = '(min-width: 1100px)';

function useWide(): boolean {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(WIDE).matches);
  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

/** "07:30" → "07.30" in Indonesian. */
const clockOf = (hhmm: string, locale: string) => (locale === 'id' ? hhmm.replace(':', '.') : hhmm);

function downloadIcs(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jadwal-kuliah-sulo.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "16–22 Nov 2026", or across months "30 Nov – 6 Des 2026". */
function weekLabel(monday: string, sunday: string, intl: string): string {
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => formatDateKey(d, intl, o);
  if (monday.slice(0, 7) === sunday.slice(0, 7)) return `${fmt(monday, { day: 'numeric' })}–${fmt(sunday, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return `${fmt(monday, { day: 'numeric', month: 'short' })} – ${fmt(sunday, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

const tint = (color: number | null) => (color === null ? 'var(--surface-raised)' : `color-mix(in oklch, var(--course-${color}) 22%, var(--surface))`);

export function JadwalPage({ data, actions }: PageProps) {
  const { m, locale } = useI18n();
  const w = neosiaWords(locale);
  const consent = useNeosiaConnect(actions);
  const calendar = data.calendar;
  const courses = useMemo(() => data.user?.courses ?? [], [data.user]);
  const meetings = useMemo(() => linkedMeetings(classMeetings(data.neosia.snapshots), courses, data.neosia.courseMap), [data.neosia, courses]);
  const holidays = useMemo(() => holidayRanges(calendar), [calendar]);
  const range = useMemo(() => semesterRange(calendar, data.today), [calendar, data.today]);
  const [monday, setMonday] = useState(() => mondayOf(data.today));
  const [icsMissing, setIcsMissing] = useState(false);
  const wide = useWide();
  const status = neosiaStatus(data.neosia.snapshots);

  // Module off: the invite, with the page's one mascot.
  if (!data.neosia.module.enabled) {
    return (
      <Card>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Mascot state="idle" size={56} />
          <p className="min-w-0 flex-1 text-[14px]">{w.invite.text}</p>
          <Button onClick={consent.start}>{w.invite.connect}</Button>
        </div>
        {consent.dialog}
      </Card>
    );
  }

  if (meetings.length === 0) {
    return (
      <Card>
        <p className="text-[14px] font-semibold">{w.noData}</p>
        <p className="mt-1 text-[14px] text-muted-foreground">{w.schedule.emptyNoData}</p>
        {status.changedShape.includes('belanja_krs') && <p className="mt-2 text-[12px] text-muted-foreground">{w.changedShape}</p>}
        <Button className="mt-4" variant="outline" asChild>
          <a href={NEOSIA_LOGIN_URL} target="_blank" rel="noopener noreferrer">
            {w.openNeosia}
          </a>
        </Button>
      </Card>
    );
  }

  const sunday = addDays(monday, 6);
  const thisWeek = mondayOf(data.today);
  const makeIcs = () => {
    const stamp = new Date(data.now * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const text = scheduleIcs(meetings, calendar, range, krsSemester(data.neosia.snapshots), stamp);
    if (text) downloadIcs(text);
    setIcsMissing(text === null);
  };
  const dateOf = (weekday: number) => addDays(monday, (weekday + 6) % 7);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label={w.jadwal.prev} onClick={() => setMonday(addDays(monday, -7))}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="min-w-44 text-center text-[16px] font-semibold tabular-nums" aria-live="polite">
            {weekLabel(monday, sunday, m.intl)}
          </span>
          <Button size="icon" variant="ghost" aria-label={w.jadwal.next} onClick={() => setMonday(addDays(monday, 7))}>
            <ChevronRightIcon className="size-4" />
          </Button>
          <Button variant="outline" className="ml-2" disabled={monday === thisWeek} onClick={() => setMonday(thisWeek)}>
            {w.schedule.thisWeek}
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" onClick={makeIcs}>
            {w.schedule.download}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" aria-label={w.schedule.howTo} title={w.schedule.howTo}>
                <InfoCircleIcon className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="max-w-xs text-[12px] leading-normal">
              {w.jadwal.icsHelp}
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {icsMissing && (
        <p role="status" className="text-[12px] text-muted-foreground">
          {w.jadwal.icsUnavailable}
        </p>
      )}

      {wide ? (
        <WeekGrid meetings={meetings} courses={courses} dateOf={dateOf} holidays={holidays} today={data.today} now={data.now} />
      ) : (
        <WeekList meetings={meetings} courses={courses} dateOf={dateOf} holidays={holidays} today={data.today} />
      )}

      <p className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        {status.lastSeenAt !== null && <span>{w.jadwal.updated(formatAgo(status.lastSeenAt, data.now, m))}</span>}
        <a href={NEOSIA_LOGIN_URL} target="_blank" rel="noopener noreferrer" className="rounded underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus">
          {w.openNeosia}
        </a>
      </p>
    </div>
  );
}

interface ViewProps {
  meetings: readonly LinkedMeeting[];
  courses: readonly CourseRecord[];
  dateOf: (weekday: number) => string;
  holidays: readonly { mulai: string; selesai: string; nama: string }[];
  today: string;
}

function WeekGrid({ meetings, courses, dateOf, holidays, today, now }: ViewProps & { now: number }) {
  const { m, locale } = useI18n();
  const w = neosiaWords(locale);
  const { start, end } = gridRange(meetings);
  const days = gridDays(meetings);
  const height = ((end - start) / SLOT_MIN) * SLOT_PX;
  const hours = Array.from({ length: (end - start) / 60 + 1 }, (_, i) => start + i * 60);
  const nowMin = localParts(now, timeZone).minuteOfDay;
  const columns = { gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` };
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="grid border-b border-border" style={columns}>
        <span />
        {days.map((wd) => {
          const day = dateOf(wd);
          const holiday = holidayOn(holidays, day);
          const isToday = day === today;
          return (
            <div key={wd} className={`border-l border-border px-2 py-2 ${holiday ? 'db-cat-libur db-cat-period' : isToday ? 'bg-surface-raised' : ''}`}>
              <p className="flex items-baseline justify-between gap-2 text-[14px] font-semibold">
                <span>{w.jadwal.days[wd]}</span>
                <span className={`text-[12px] tabular-nums ${isToday ? 'font-semibold text-brand-orange' : 'font-normal text-muted-foreground'}`}>{formatDateKey(day, m.intl, { day: 'numeric', month: 'short' })}</span>
              </p>
              {holiday && (
                <p className="truncate text-[12px] text-muted-foreground" title={holiday}>
                  {w.jadwal.holiday(holiday)}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="grid pt-2" style={columns}>
        <div className="relative" style={{ height }}>
          {hours.map((h) => (
            <span key={h} className="absolute right-2 -translate-y-1/2 text-[12px] text-muted-foreground tabular-nums" style={{ top: ((h - start) / SLOT_MIN) * SLOT_PX }}>
              {clockOf(`${String(h / 60).padStart(2, '0')}:00`, locale)}
            </span>
          ))}
        </div>
        {days.map((wd) => {
          const day = dateOf(wd);
          const holiday = holidayOn(holidays, day);
          const isToday = day === today;
          return (
            <div key={wd} className={`relative border-l border-border ${holiday ? 'db-cat-libur db-cat-period' : isToday ? 'bg-surface-raised' : ''}`} style={{ height }}>
              {/* Lines every half hour, the full hours stronger. */}
              {Array.from({ length: (end - start) / SLOT_MIN }, (_, i) => (
                <span key={i} aria-hidden="true" className={`absolute inset-x-0 border-t ${i % 2 === 0 ? 'border-border' : 'border-border/40'}`} style={{ top: i * SLOT_PX }} />
              ))}
              {lanes(meetings.filter((x) => x.weekday === wd)).map(({ meeting: x, lane, lanes: n }, i) => (
                <div
                  key={`${x.key}-${x.start}-${i}`}
                  className={`absolute px-1 ${holiday ? 'opacity-50' : ''}`}
                  style={{ top: ((toMinutes(x.start) - start) / SLOT_MIN) * SLOT_PX + 1, height: ((toMinutes(x.end) - toMinutes(x.start)) / SLOT_MIN) * SLOT_PX - 2, left: `${(lane / n) * 100}%`, width: `${100 / n}%` }}
                >
                  <ClassBlock x={x} courses={courses} />
                </div>
              ))}
              {/* Now: an accent line across today's column. */}
              {isToday && nowMin >= start && nowMin <= end && (
                <span role="img" aria-label={w.schedule.now} className="absolute inset-x-0 h-0.5 bg-brand-orange" style={{ top: ((nowMin - start) / SLOT_MIN) * SLOT_PX }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekList({ meetings, courses, dateOf, holidays, today }: ViewProps) {
  const { m, locale } = useI18n();
  const w = neosiaWords(locale);
  const days = gridDays(meetings);
  const empty = days.filter((wd) => !meetings.some((x) => x.weekday === wd));
  return (
    <div className="space-y-3">
      {days
        .filter((wd) => meetings.some((x) => x.weekday === wd))
        .map((wd) => {
          const day = dateOf(wd);
          const holiday = holidayOn(holidays, day);
          return (
            <section key={wd} aria-current={day === today ? 'date' : undefined} className={`rounded-xl border border-border p-3 ${holiday ? 'db-cat-libur db-cat-period' : 'bg-surface'}`}>
              <h2 className="flex items-baseline justify-between gap-2 text-[14px] font-semibold">
                <span>{w.jadwal.days[wd]}</span>
                <span className={`text-[12px] tabular-nums ${day === today ? 'font-semibold text-brand-orange' : 'font-normal text-muted-foreground'}`}>{formatDateKey(day, m.intl, { day: 'numeric', month: 'short' })}</span>
              </h2>
              {holiday && <p className="text-[12px] text-muted-foreground">{w.jadwal.holiday(holiday)}</p>}
              <ul className={`mt-2 space-y-2 ${holiday ? 'opacity-50' : ''}`}>
                {meetings
                  .filter((x) => x.weekday === wd)
                  .map((x, i) => (
                    <li key={`${x.key}-${x.start}-${i}`}>
                      <ClassBlock x={x} courses={courses} />
                    </li>
                  ))}
              </ul>
            </section>
          );
        })}
      {empty.length > 0 && <p className="text-[14px] text-muted-foreground">{w.schedule.noClassDays(empty.map((wd) => w.jadwal.days[wd]).join(', '))}</p>}
    </div>
  );
}

/** One class: name, room and time; lecturers and linking to SIKOLA in its popover. */
function ClassBlock({ x, courses }: { x: LinkedMeeting; courses: readonly CourseRecord[] }) {
  const { locale } = useI18n();
  const w = neosiaWords(locale);
  const unmapped = x.course === null && !x.optedOut;
  const sorted = useMemo(() => [...courses].sort((a, b) => courseNameWithClass(a).localeCompare(courseNameWithClass(b), 'id')), [courses]);
  const title = `${x.displayName}${x.classLabel ? ` ${x.classLabel}` : ''}`;
  const time = `${clockOf(x.start, locale)}–${clockOf(x.end, locale)}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-full w-full flex-col overflow-hidden rounded-lg px-2 py-1 text-left outline-none hover:brightness-110 focus-ring:ring-2 focus-ring:ring-focus"
          style={{ background: tint(x.color) }}
          aria-label={`${title}, ${time}${x.room ? `, ${x.room}` : ''}`}
        >
          <span className="line-clamp-2 text-[12px] leading-4 font-semibold">{title}</span>
          {x.room && <span className="truncate text-[12px] leading-4 text-muted-foreground">{x.room}</span>}
          <span className="text-[12px] leading-4 text-muted-foreground tabular-nums">{time}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 text-[14px]">
        <p className="font-semibold">{title}</p>
        <p className="text-[12px] text-muted-foreground tabular-nums">
          {time}
          {x.room ? ` · ${x.room}` : ''}
        </p>
        {x.lecturers.length > 0 && (
          <div>
            <p className="text-[12px] text-muted-foreground">{w.schedule.lecturers}</p>
            <p className="text-[14px]">
              <Private>{x.lecturers.join(', ')}</Private>
            </p>
          </div>
        )}
        {(unmapped || x.how === 'manual') && (
          <div className="space-y-2 border-t border-border pt-2">
            {unmapped && <p className="text-[12px] text-muted-foreground">{w.schedule.unmapped}</p>}
            <Select value={x.course ? String(x.course.id) : ''} onValueChange={(v) => void setCourseLink(local, x.key, Number(v))}>
              <SelectTrigger aria-label={w.schedule.mapTo} className="w-full">
                <SelectValue placeholder={w.schedule.mapTo} />
              </SelectTrigger>
              <SelectContent>
                {sorted.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {courseNameWithClass(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {unmapped && (
              <Button variant="ghost" size="sm" onClick={() => void setCourseLink(local, x.key, null)}>
                {w.schedule.notInSikola}
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

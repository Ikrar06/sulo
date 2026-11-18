import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/components/i18n';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { Private } from '@/components/private';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays } from '@sulo/core/calendar/dates';
import { formatDateKey } from '@sulo/core/calendar/countdown';
import { courseNameWithClass } from '@sulo/core/courses/display-name';
import { formatAgo } from '@sulo/core/format/time';
import { neosiaWords } from '@sulo/core/i18n/neosia';
import { NEOSIA_HOME, NEOSIA_KRS } from '@sulo/core/links';
import { fromOtherSemester, sourceDone } from '@sulo/core/neosia/sources';
import { NeosiaChecklist } from '../NeosiaChecklist';
import { setCourseLink } from '@sulo/core/neosia/course-map';
import { linkedMeetings, type LinkedMeeting } from '@sulo/core/neosia/linked';
import { holidayOn, holidayRanges, mondayOf, scheduleIcs, semesterRange } from '@sulo/core/neosia/schedule';
import { classMeetings, krsSemester, neosiaStatus } from '@sulo/core/neosia/view';
import { blockBox, blockLayout, gridDays, gridRange, HOUR_PX, lanes, NO_SCROLL_SPAN, SLOT_MIN } from '@sulo/core/neosia/week-grid';
import { localParts } from '@sulo/core/reminders/zoned';
import type { CourseRecord } from '@sulo/core/types';
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

const SLOT_PX = (HOUR_PX * SLOT_MIN) / 60;
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

/** About 18% of the course color on the surface, with a 1 px edge of about 40%; a visible neutral when not linked. */
const blockColors = (color: number | null) => {
  const base = color === null ? 'var(--muted)' : `var(--course-${color})`;
  // Not linked: the full --muted edge keeps the block clearly visible on the grid (3:1 or more, scripts/contrast.mjs).
  return { background: `color-mix(in oklch, ${base} 18%, var(--surface))`, borderColor: color === null ? 'var(--muted)' : `color-mix(in oklch, ${base} 40%, var(--surface))` };
};

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

  // Home page data missing (the schedule comes with it): the checklist, with Beranda first in line.
  if (!sourceDone(data.neosia.snapshots, 'beranda')) {
    return (
      <div className="space-y-4">
        {status.changedShape.includes('belanja_krs') && <p className="text-[12px] text-muted-foreground">{w.changedShape}</p>}
        <NeosiaChecklist snapshots={data.neosia.snapshots} now={data.now} highlight="beranda" />
      </div>
    );
  }
  // Home data is in but the KRS holds no class: one line, and the KRS page.
  if (meetings.length === 0) {
    return (
      <Card>
        <p className="flex flex-wrap items-center gap-3 text-[14px]">
          <span className="text-muted-foreground">{w.krs.status.empty}</span>
          <Button variant="outline" size="sm" asChild>
            <a href={NEOSIA_KRS} target="_blank" rel="noopener noreferrer">
              {w.refresh.openKrs}
            </a>
          </Button>
        </p>
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
  // A week outside the semester's teaching weeks has no classes: an empty state, not an empty grid.
  const noClassesThisWeek = range !== null && (sunday < range.start || monday > range.end);
  // The KRS is from another semester than the academic calendar's current one.
  const otherSemester = fromOtherSemester(krsSemester(data.neosia.snapshots), range ? { tahunAjaran: calendar.tahun_ajaran, semester: range.semester } : null) === true;

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

      {otherSemester && (
        <p role="status" className="flex flex-wrap items-center gap-3 text-[14px]">
          <span className="text-muted-foreground">{w.refresh.otherSemester}</span>
          <Button variant="outline" size="sm" asChild>
            <a href={NEOSIA_KRS} target="_blank" rel="noopener noreferrer">
              {w.refresh.openKrs}
            </a>
          </Button>
        </p>
      )}

      {noClassesThisWeek ? (
        <Card>
          <p className="text-[14px] text-muted-foreground">{w.schedule.noClassWeek}</p>
        </Card>
      ) : wide ? (
        <WeekGrid meetings={meetings} courses={courses} dateOf={dateOf} holidays={holidays} today={data.today} now={data.now} />
      ) : (
        <WeekList meetings={meetings} courses={courses} dateOf={dateOf} holidays={holidays} today={data.today} />
      )}

      <p className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        {status.lastSeenAt !== null && <span>{w.jadwal.updated(formatAgo(status.lastSeenAt, data.now, m))}</span>}
        <a href={NEOSIA_HOME} target="_blank" rel="noopener noreferrer" className="rounded underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus">
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
  // Up to 10 hours fit at 1440x900; a longer day scrolls under a sticky row of days.
  const scrolls = end - start > NO_SCROLL_SPAN;
  return (
    <div className={`rounded-xl border border-border bg-surface ${scrolls ? 'max-h-[calc(100vh-200px)] overflow-y-auto' : 'overflow-hidden'}`}>
      <div className="sticky top-0 z-10 grid rounded-t-xl border-b border-border bg-surface" style={columns}>
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
      <div className="grid pt-2 pb-3" style={columns}>
        <div className="relative" style={{ height }}>
          {hours.map((h) => (
            // Right-aligned, centred on its own hour line.
            <span key={h} className="absolute right-2 -translate-y-1/2 text-[12px] leading-4 text-muted-foreground tabular-nums" style={{ top: ((h - start) / 60) * HOUR_PX }}>
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
                  // Exact to the minute; one pixel of air above and below.
                  style={{ top: blockBox(x, start).top + 1, height: Math.max(12, blockBox(x, start).height - 2), left: `${(lane / n) * 100}%`, width: `${100 / n}%` }}
                >
                  <ClassBlock x={x} courses={courses} fill />
                </div>
              ))}
              {/* Now: an accent line across today's column. */}
              {isToday && nowMin >= start && nowMin <= end && (
                <span role="img" aria-label={w.schedule.now} className="absolute inset-x-0 z-[1] h-0.5 bg-brand-orange" style={{ top: ((nowMin - start) / 60) * HOUR_PX }}>
                  {/* A small dot at its left end. */}
                  <span aria-hidden="true" className="absolute -top-1 -left-1 size-2.5 rounded-full bg-brand-orange" />
                </span>
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

/**
 * One class. In the grid its content fits its length (lib/neosia/week-grid.ts
 * blockLayout) and never spills over; the full text is in the title and the
 * popover, with lecturers and linking to SIKOLA.
 */
function ClassBlock({ x, courses, fill = false }: { x: LinkedMeeting; courses: readonly CourseRecord[]; fill?: boolean }) {
  const { locale } = useI18n();
  const w = neosiaWords(locale);
  const unmapped = x.course === null && !x.optedOut;
  const sorted = useMemo(() => [...courses].sort((a, b) => courseNameWithClass(a).localeCompare(courseNameWithClass(b), 'id')), [courses]);
  const title = `${x.displayName}${x.classLabel ? ` ${x.classLabel}` : ''}`;
  const time = `${clockOf(x.start, locale)}–${clockOf(x.end, locale)}`;
  const full = `${title}, ${time}${x.room ? `, ${x.room}` : ''}`;
  const layout = fill ? blockLayout(x) : 'tall';
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={full}
          aria-label={full}
          // Radius 8, padding 6 and 8, 1 px edge; text in the main text color.
          // Padding 6 x 8; shorter blocks keep 8 at the sides but less above and below, so their lines fit (40 px for 50 minutes).
          className={`flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border px-2 text-left text-[12px] text-foreground outline-none hover:brightness-110 focus-ring:ring-2 focus-ring:ring-focus ${layout === 'tall' ? 'py-[6px] leading-4' : layout === 'medium' ? 'justify-center py-[3px] leading-[14px]' : 'justify-center py-0 leading-4'} ${fill ? 'h-full' : ''}` /* lint-ui-allow: block padding 6 x 8 as specified; 3 px for 40 to 59 minutes */}
          style={blockColors(x.color)}
        >
          {layout === 'tall' && (
            <>
              <span className="line-clamp-2 font-semibold">{title}</span>
              <span className="truncate tabular-nums">{time}</span>
              {x.room && <span className="truncate">{x.room}</span>}
            </>
          )}
          {layout === 'medium' && (
            <>
              <span className="truncate font-semibold">{title}</span>
              <span className="truncate tabular-nums">
                {time}
                {x.room ? ` · ${x.room}` : ''}
              </span>
            </>
          )}
          {layout === 'short' && (
            <span className="truncate">
              <span className="tabular-nums">{clockOf(x.start, locale)}</span> <span className="font-semibold">{title}</span>
            </span>
          )}
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

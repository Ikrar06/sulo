import { useMemo, useRef } from 'react';
import { useI18n } from '@sulo/ui/i18n';
import { ChevronRightIcon } from '@sulo/ui/icons';
import { formatDateKey } from '@sulo/core/calendar/countdown';
import { greetSlot } from '@sulo/core/dashboard/mobile-greeting';
import { mascotMood } from '@sulo/core/dashboard/mascot-mood';
import { GREET_LINE1 } from '@sulo/core/i18n/greet-line';
import { loadMap } from '@sulo/core/dashboard/load-map';
import { buildSummary, groupOverview, limitGroups, withNext } from '@sulo/core/dashboard/overview';
import { routeHash } from '@sulo/core/dashboard/routes';
import { buildTaskItems, type TaskItem } from '@sulo/core/dashboard/tasks';
import { useDoneUndo } from '@sulo/ui/dashboard/done-undo';
import { countdownLabel } from '@sulo/core/format/countdown';
import { countdownOrLate, formatRemaining } from '@sulo/core/format/time';
import { describeChange } from '@sulo/core/radar/describe';
import { localParts } from '@sulo/core/reminders/zoned';
import { AcademicCard, nextForSummary, SummaryLine } from '@sulo/ui/dashboard/OverviewParts';
import { timeZone } from '../data';
import { Card, CardLink } from '@sulo/ui/card';
import type { PageProps } from '../types';
import { KrsReadinessCard, NeosiaInvite, NextClassLine, StudiCard, SurveyLine, TodayClasses } from '@sulo/ui/dashboard/NeosiaParts';
import { classMeetings, krsWindow, neosiaStatus, readiness, showKrsCard, surveyFilled } from '@sulo/core/neosia/view';
import { linkedMeetings } from '@sulo/core/neosia/linked';
import { holidayRanges } from '@sulo/core/neosia/schedule';
import { classesToday, nextClass } from '@sulo/core/neosia/today';
import { dismissInvite, showInvite } from '@sulo/core/neosia/invite';
import { local } from '../data';
import { courseAlias } from '@sulo/core/courses/display-name';
import { attendanceSummary } from '@sulo/core/presensi/service';
import { useNeosiaConnect } from '../neosia-connect';
import { Chip } from '@sulo/ui/mobile/cards';
import { courseTint } from '@sulo/ui/mobile/tint';
import { URGENCY_TEXT } from '@sulo/ui/urgency';
import { urgencyOf } from '@sulo/core/tasks/group';
import { CalendarHoverButton, FADES_FOR_CALENDAR } from '../CalendarHoverButton';
import { CheckCircle } from '@sulo/ui/mobile/controls';
import { FitLine } from '@sulo/ui/mobile/fit-line';
import { HeroMascot } from '../HeroMascot';
import { useFlip } from '@/lib/ui/flip';
import { NeosiaOverviewChecklist } from '../NeosiaChecklist';

const LEVELS = [1, 2, 3, 4] as const;

type Row = TaskItem & { dueAt: number | null };

export function RingkasanPage({ d, data, actions }: PageProps) {
  const { m } = useI18n();
  const r = d.ringkasan;
  const { locale } = useI18n();
  const countdown = data.prefs.dueFormat === 'countdown';
  const user = data.user!;
  const done = useDoneUndo(actions, d, data.today, local);
  const rowsRef = useRef<HTMLDivElement>(null);
  useFlip(rowsRef);
  const allItems = useMemo(() => buildTaskItems(user), [user]);
  // Pending tasks, plus the ones just marked done (they stay in place for the undo window).
  const pendingItems = useMemo(() => allItems.filter((i) => i.status === 'pending' || done.lingering.has(i.task.eventId)), [allItems, done.lingering]);
  const rows = useMemo<Row[]>(() => pendingItems.map((i) => ({ ...i, dueAt: i.task.dueAt })), [pendingItems]);
  const groups = useMemo(() => groupOverview(rows, data.now, timeZone), [rows, data.now]);
  // Fewer than 4 rows: "Berikutnya" adds the nearest tasks after this week.
  const shown = limitGroups(withNext(groups, rows, data.now, timeZone));
  const overdue = groups.find((g) => g.key === 'overdue')?.rows.length ?? 0;
  const dueThisWeek = groups.filter((g) => g.key !== 'overdue').reduce((n, g) => n + g.rows.length, 0);

  const days = useMemo(() => loadMap(pendingItems.map((i) => i.task), data.calendar.kegiatan, data.now, timeZone), [pendingItems, data.calendar, data.now]);
  const loadEmpty = days.every((day) => day.tasks.length === 0 && day.events.length === 0);
  const updates = data.view.updates.slice(0, 6);
  // The phone's mood (core mascotMood) and greeting line.
  const banner = data.view.banner?.kind;
  const mood = mascotMood({ now: data.now, dueTimes: pendingItems.filter((i) => i.status === 'pending' && i.task.dueAt !== null).map((i) => i.task.dueAt!), sessionExpired: banner === 'session_expired', offline: banner === 'offline' });
  const nickname = data.prefs.privacyMode ? '' : data.prefs.nickname.trim();
  // The phone's greeting slot (core greetSlot) and its line, without the phone's whole word list.
  const line1 = GREET_LINE1[locale][greetSlot(Math.floor(localParts(data.now, timeZone).minuteOfDay / 60))].replace(/,$/, '');
  const helloLine = nickname ? `${line1}, ${nickname}` : line1;
  // NEOSIA (module on only): KRS readiness from 14 days before the window until it closes.
  const neosiaOn = data.neosia.module.enabled;
  const snapshots = data.neosia.snapshots;
  const calendarKrs = useMemo(() => data.calendar.kegiatan.filter((k) => k.kategori === 'krs' && !k.perkiraan && k.audiens !== 'calon_mahasiswa'), [data.calendar]);
  // "Kuliah hari ini": classes still to come today, none on a calendar holiday; else the next class.
  const meetings = useMemo(() => (neosiaOn ? linkedMeetings(classMeetings(snapshots), user.courses, data.neosia.courseMap) : []), [neosiaOn, snapshots, user.courses, data.neosia.courseMap]);
  const minuteNow = localParts(data.now, timeZone).minuteOfDay;
  const holidays = useMemo(() => holidayRanges(data.calendar), [data.calendar]);
  const today = useMemo(() => classesToday(meetings, data.today, minuteNow, holidays), [meetings, data.today, minuteNow, holidays]);
  const upcomingClass = today.length === 0 ? nextClass(meetings, data.today, minuteNow, holidays) : null;
  const summary = buildSummary({ overdue, dueThisWeek, next: nextForSummary(data.calendar, data.today, d), classesToday: today.length });
  const consent = useNeosiaConnect(actions);
  // Attendance average over monitored courses, from the stored recap (no request).
  const attendance = useMemo(() => attendanceSummary(user.presensi?.recap?.rows, user.courses), [user.presensi, user.courses]);
  const invite = showInvite({ moduleOn: neosiaOn, dismissedAt: data.neosia.invite.dismissedAt, dismissedDay: data.neosia.invite.dismissedDay, now: data.now, today: data.today, krsWindows: calendarKrs });
  const krsWin = neosiaOn ? krsWindow(snapshots, data.today, calendarKrs) : null;
  const krsCard = neosiaOn && showKrsCard(krsWin, data.today);
  const surveyOpen = neosiaOn && !krsCard && surveyFilled(snapshots) === false;

  return (
    <div className="space-y-4">
      {/* Hero: full width, no card, nothing else on its row. One mascot on this page; it idles and stops for reduced motion. */}
      <section className="flex items-center gap-4 pb-2">
        {/* 75 box: the drawing itself 64 tall, centred on the greeting and its line. */}
        <HeroMascot mood={mood} cheer={done.lingering.size} size={75} />
        <div className="min-w-0 flex-1">
          {/* The phone's greeting line (core mobile-greeting), without its playful second line. The
              nickname from the settings only, never a name from NEOSIA. */}
          <h2 className="text-[20px] leading-7 font-semibold">{helloLine}</h2>
          <SummaryLine parts={summary} d={d} />
        </div>
      </section>

      {/* Module off: the invite. Module on: the checklist until the required pages came in. Never both. */}
      {!neosiaOn && invite && <NeosiaInvite onConnect={consent.start} onLater={() => void dismissInvite(local, data.now, data.today)} />}
      {neosiaOn && <NeosiaOverviewChecklist snapshots={snapshots} now={data.now} />}
      {consent.dialog}
      {surveyOpen && <SurveyLine />}
      {krsCard && <KrsReadinessCard items={readiness(snapshots, krsWin, data.today)} window={krsWin} seenAt={neosiaStatus(snapshots).lastSeenAt} now={data.now} />}

      {/* Tasks on the left at their own height; the right column (calendar, then studies) stretches beside it. */}
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Stretches to the right column's height; a quiet card centres its one line in the space left. */}
        <Card title={r.tasksTitle} action={<CardLink href={routeHash('tugas')}>{r.allTasks}</CardLink>} className="flex h-full flex-col">
          <div className="flex flex-1 flex-col">
          {today.length > 0 && (
            <div className="mb-4">
              <TodayClasses classes={today} />
            </div>
          )}
          {upcomingClass && (
            <div className="mb-4">
              <NextClassLine next={upcomingClass} />
            </div>
          )}
          {shown.groups.length === 0 ? (
            // Only when no task is pending at all ("Berikutnya" also takes undated tasks); centred in the space left, no mascot.
            <p className="flex flex-1 items-center justify-center py-8 text-center text-[14px] text-muted-foreground">{r.nothingSoon}</p>
          ) : (
            <div ref={rowsRef} className="space-y-4">
              {shown.groups.map((g) => (
                <section key={g.key} aria-label={r.groups[g.key]}>
                  <h3 className="mb-1 text-[12px] font-semibold text-muted-foreground">{r.groups[g.key]}</h3>
                  <ul>
                    {g.rows.map((row) => (
                      <li key={row.task.eventId} data-flip-key={row.task.eventId} className={`group relative -mx-2 flex items-start gap-3 rounded-lg px-2 hover:bg-surface-raised ${done.collapsing.has(row.task.eventId) ? 'db-collapse' : ''}`}>
                        <span className="mt-2 flex">
                          <CheckCircle
                            size="sm"
                            checked={row.status === 'done'}
                            onChange={(v) => (v ? done.mark(row.task.eventId) : done.unmark(row.task.eventId))}
                            label={`${row.status === 'done' ? d.tugas.markUndone : d.tugas.markDone}: ${row.task.name}`}
                          />
                        </span>
                        <a href={routeHash('tugas', row.task.eventId)} className="flex min-w-0 flex-1 items-start gap-3 rounded-lg py-2 outline-none focus-ring:ring-2 focus-ring:ring-focus">
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-[14px] ${row.status === 'done' ? 'text-muted-foreground line-through' : 'font-semibold'}`} title={row.task.name}>
                              {row.task.name}
                            </span>
                            <span className="mt-1 flex" title={row.courseName}>
                              <Chip small color={courseTint(row.courseColor)}>
                                {row.courseName}
                              </Chip>
                            </span>
                          </span>
                          <span className={`shrink-0 py-1 ${row.dueAt !== null && row.status === 'pending' ? `min-w-7 text-right ${FADES_FOR_CALENDAR}` : ''}`}>
                            {row.dueAt !== null && (
                              <FitLine
                                size="text-m12"
                                text={countdown ? countdownOrLate(row.dueAt, data.now, timeZone, m) : formatRemaining(row.dueAt, data.now, timeZone, m)}
                                className={`tabular-nums ${row.status !== 'pending' ? 'text-muted-foreground' : URGENCY_TEXT[urgencyOf(row.dueAt, data.now)]}`}
                              >
                                <span
                                  data-due-at={countdown && row.dueAt >= data.now ? row.dueAt : undefined}
                                  aria-label={countdown ? (countdownLabel((row.dueAt - data.now) * 1000, locale) ?? undefined) : undefined}
                                >
                                  {countdown ? countdownOrLate(row.dueAt, data.now, timeZone, m) : formatRemaining(row.dueAt, data.now, timeZone, m)}
                                </span>
                              </FitLine>
                            )}
                          </span>
                        </a>
                        {row.dueAt !== null && row.status === 'pending' && (
                          <span className="absolute top-1/2 right-2 -translate-y-1/2">
                            <CalendarHoverButton name={row.task.name} courseName={row.courseName} dueAt={row.dueAt} url={row.task.url} onOpen={actions.openTab} />
                          </span>
                        )}
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
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card title={r.calendarTitle} action={<CardLink href={routeHash('kalender')}>{r.openCalendar}</CardLink>} className="flex flex-1 flex-col [&>div:last-child]:flex-1">
            <AcademicCard calendar={data.calendar} today={data.today} d={d} />
          </Card>
          <StudiCard snapshots={snapshots} sksTarget={data.prefs.sksTarget} neosiaOn={neosiaOn} attendance={attendance} />
        </div>
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
                const isToday = day.dateKey === data.today;
                return (
                  <li
                    key={day.dateKey}
                    title={label}
                    aria-label={label}
                    aria-current={isToday ? 'date' : undefined}
                    className={`db-load-${day.level} flex aspect-square flex-col items-center justify-center rounded-lg text-[12px] leading-4 tabular-nums ${isToday ? 'ring-2 ring-brand-orange ring-offset-2 ring-offset-surface' : ''}`}
                  >
                    <span>{isToday ? r.loadToday : formatDateKey(day.dateKey, m.intl, { weekday: 'narrow' })}</span>
                    <span className="font-semibold">{formatDateKey(day.dateKey, m.intl, { day: 'numeric' })}</span>
                    {exam && <span aria-hidden="true" className="mt-1 size-1.5 rounded-full" style={{ background: 'var(--cat-ujian)' }} />}
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
              <span className="ml-3 inline-flex items-center gap-1">
                <span className="size-1.5 rounded-full" style={{ background: 'var(--cat-ujian)' }} />
                {r.loadExam}
              </span>
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
                  <span aria-hidden="true" className={`size-2 shrink-0 self-center rounded-full ${e.seen ? 'bg-transparent' : 'bg-foreground'}`} />
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

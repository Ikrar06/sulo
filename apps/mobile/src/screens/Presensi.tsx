// Presensi (M8c.1, cards). The focal point: a hero card with the average (26), a
// solid progress ring and the lowest course. Each followed course is a card
// (the course as the shared tinted chip, "7 sesi · 11/14 poin", the percentage
// and a 6 px bar at its foot). A course's sessions: a header card with the
// ring, then one group card per month (date tile, session, status pill).
// The same rules as the extension: the recap updates in syncs at most once
// a day and on Perbarui (2-minute cooldown, the header's button or a pull);
// opening a view fetches only a missing or day-old copy; sessions only when
// opened. Every page is checked against the active account (core).

import { useEffect, useMemo, useRef, useState } from 'react';
import { activeCourseIds } from '@sulo/core/courses/active-score';
import { assignCourseColors } from '@sulo/core/courses/colors';
import { courseAlias } from '@sulo/core/courses/display-name';
import { formatDateKey } from '@sulo/core/calendar/countdown';
import { formatAgo } from '@sulo/core/format/time';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { remarkText, sessionTimeText } from '@sulo/core/presensi/display';
import { attendanceSpread, attendanceSummary, courseStatus } from '@sulo/core/presensi/service';
import { EMPTY_PRESENSI, type AttendanceStatus, type RecapRow, type SessionRow } from '@sulo/core/presensi/types';
import { localParts } from '@sulo/core/reminders/zoned';
import type { CourseRecord } from '@sulo/core/types';
import { presensiNote } from '@sulo/ui/dashboard/PresensiParts';
import { useI18n } from '@sulo/ui/i18n';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { Card, Chip, EmptyCard, Tile } from '@sulo/ui/mobile/cards';
import { ProgressRing } from '@sulo/ui/mobile/ring';
import { courseTint, initials, type TintColor } from '@sulo/ui/mobile/tint';
import { Private, usePrivacy } from '@sulo/ui/private';
import { timeZone, useMobileData } from '../shell/data';
import type { Screen } from '../shell/nav';
import { useScreenRefresh } from '../shell/screen-refresh';
import { refreshPresensi } from '../sync';

const pct = (v: number, locale: string) => v.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 1 });
/** "Mekanika Fluida" -> "MF". */

/** Alpa is the one status in the warning color. */
const STATUS_TINT: Record<AttendanceStatus, TintColor | null> = { present: null, late: null, excused: null, unknown: null, absent: 'soon' };

export function PresensiScreen({ courseId, go }: { courseId: number | null; go: (s: Screen) => void }) {
  const { m, locale } = useI18n();
  const d = mobileDash(locale);
  const pw = d.presensi;
  const w = mobileWords(locale);
  const { data, platform } = useMobileData();
  const user = data!.user!;
  const presensi = user.presensi ?? EMPTY_PRESENSI;
  const followed = useMemo(() => {
    const active = activeCourseIds(user.courses);
    return user.courses.filter((c) => active.has(c.id)).sort((a, b) => courseAlias(a).localeCompare(courseAlias(b), 'id'));
  }, [user.courses]);
  const colors = useMemo(() => assignCourseColors(followed), [followed]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const summary = useMemo(() => attendanceSummary(presensi.recap?.rows, user.courses), [presensi.recap, user.courses]);

  const rows = new Map((presensi.recap?.rows ?? []).map((r) => [r.courseId, r]));
  const course = courseId === null ? null : (followed.find((c) => c.id === courseId) ?? null);
  const row = courseId === null ? undefined : rows.get(courseId);
  const detail = row ? presensi.details[String(row.cmid)] : undefined;
  const fetchedAt = course ? (detail?.fetchedAt ?? null) : (presensi.recap?.fetchedAt ?? null);

  const ask = async (force: boolean): Promise<string> => {
    const target = course ? 'detail' : 'recap';
    const hasData = target === 'recap' ? presensi.recap !== null : detail !== undefined;
    setBusy(true);
    const outcome = await refreshPresensi(platform, target, courseId, force).catch(() => null);
    setBusy(false);
    const line = outcome?.status === 'failed' && outcome.reason === 'offline' ? w.app.offline : presensiNote(outcome, target, force, hasData, pw);
    setNote(force ? '' : line);
    return line;
  };
  useScreenRefresh(() => ask(true));

  const opened = useRef<string | null>(null);
  useEffect(() => {
    const key = courseId === null ? 'recap' : `detail:${courseId}`;
    if (opened.current === key) return;
    opened.current = key;
    setNote('');
    void ask(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const when = fetchedAt !== null ? pw.updated(formatAgo(fetchedAt, data!.now, m)) : busy ? pw.loading : pw.never;

  if (course)
    return (
      <div className="space-y-3">
        <CourseHeader course={course} color={colors.get(course.id) ?? null} row={row} d={d} locale={locale} when={note || when} />
        <Sessions sessions={detail?.sessions ?? null} loading={busy && !detail} d={d} locale={locale} />
      </div>
    );

  return (
    <div className="space-y-3">
      {summary ? (
        <Card hero>
          <div className="flex items-center gap-4">
            <ProgressRing value={summary.average} label={`${w.app.attendance} ${pct(summary.average, locale)}%`} />
            <div className="min-w-0 flex-1">
              <p className="text-m12 text-muted-foreground">
                {w.app.attendance} {w.app.average}
              </p>
              <p className="text-m26 tabular-nums">
                <Private>{pct(summary.average, locale)}%</Private>
              </p>
              {/* The lowest course: its percent beside the label, its name on its own line (never "name 78,6%" in one run). */}
              {summary.lowest && attendanceSpread(presensi.recap?.rows) && (
                <div className="mt-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-m12 text-muted-foreground">{w.app.lowest}</span>
                    <span className="text-m13 font-medium tabular-nums">
                      <Private>{pct(summary.lowest.percent, locale)}%</Private>
                    </span>
                  </p>
                  <p className="line-clamp-2 text-m13 text-muted-foreground">
                    <Private>{summary.lowest.name}</Private>
                  </p>
                </div>
              )}
            </div>
          </div>
          <p className="mt-3 text-m12 font-normal text-muted-foreground" role="status">
            {note || when}
          </p>
        </Card>
      ) : (
        <div role="status">
          <EmptyCard mascot={<Mascot state="idle" size={48} />} text={note || when} />
        </div>
      )}
      {followed.length === 0 ? (
        <EmptyCard text={pw.noneMonitored} />
      ) : (
        <ul className="space-y-2">
          {followed.map((c) => (
            <li key={c.id}>
              <CourseCard course={c} color={colors.get(c.id) ?? null} row={rows.get(c.id)} fetched={presensi.recap !== null} d={d} w={w} locale={locale} onOpen={() => go({ name: 'presensi', detail: String(c.id) })} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Bar({ percent }: { percent: number }) {
  return (
    <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-m-inset" aria-hidden="true">
      <span className="block h-full rounded-full bg-foreground" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </span>
  );
}

function CourseCard({ course, color, row, fetched, d, w, locale, onOpen }: { course: CourseRecord; color: number | null; row: RecapRow | undefined; fetched: boolean; d: ReturnType<typeof mobileDash>; w: ReturnType<typeof mobileWords>; locale: 'id' | 'en'; onOpen: () => void }) {
  const pw = d.presensi;
  const name = courseAlias(course);
  const status = courseStatus(row, fetched);
  const line = status === 'not_fetched' ? pw.notFetched : status === 'no_module' ? pw.noModule : status === 'no_sessions' ? pw.noSessions : w.app.sessions(row!.taken, row!.points?.got ?? null, row!.points?.max ?? null);
  const body = (
    <>
      <div className="flex items-center gap-3">
        {/* The course as the shared tinted chip (Tahap 2, e7): a long name ends in an ellipsis, the percent never does. */}
        <div className="min-w-0 flex-1">
          <span className="flex min-w-0 text-foreground">
            <Chip small color={courseTint(color)}>
              {name}
            </Chip>
          </span>
          <p className="mt-1 text-m13 text-muted-foreground tabular-nums">{line}</p>
        </div>
        {row && row.percent !== null && (
          <span className="shrink-0 text-m18 tabular-nums">
            <Private>{pct(row.percent, locale)}%</Private>
          </span>
        )}
      </div>
      {row && row.percent !== null && <Bar percent={row.percent} />}
    </>
  );
  return row ? (
    <Card onPress={onOpen} label={pw.open(name)}>
      {body}
    </Card>
  ) : (
    <Card>{body}</Card>
  );
}

function CourseHeader({ course, color, row, d, locale, when }: { course: CourseRecord; color: number | null; row: RecapRow | undefined; d: ReturnType<typeof mobileDash>; locale: 'id' | 'en'; when: string }) {
  const pw = d.presensi;
  const name = courseAlias(course);
  return (
    <Card hero>
      <div className="flex items-center gap-4">
        {row && row.percent !== null ? <ProgressRing value={row.percent} label={`${name} ${pct(row.percent, locale)}%`} /> : <Tile color={courseTint(color)} size={44}>{initials(name)}</Tile>}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-m18">{name}</p>
          {row && row.percent !== null && (
            <p className="text-m22 tabular-nums">
              <Private>{pct(row.percent, locale)}%</Private>
            </p>
          )}
          {row && <p className="text-m13 text-muted-foreground tabular-nums">{row.taken === 0 ? pw.noSessions : [pw.taken(row.taken), row.points ? pw.points(row.points.got, row.points.max) : null].filter(Boolean).join(' · ')}</p>}
        </div>
      </div>
      <p className="mt-3 text-m12 font-normal text-muted-foreground" role="status">
        {when}
      </p>
    </Card>
  );
}

/** Sessions by month, one group card each. */
function Sessions({ sessions, loading, d, locale }: { sessions: SessionRow[] | null; loading: boolean; d: ReturnType<typeof mobileDash>; locale: 'id' | 'en' }) {
  const { m } = useI18n();
  const pw = d.presensi;
  const masked = usePrivacy();
  if (sessions === null) return loading ? <SessionsSkeleton /> : null;
  if (sessions.length === 0) return <EmptyCard mascot={<Mascot state="idle" size={48} />} text={pw.noDetail} />;
  const monthOf = (s: SessionRow) => (s.at !== null ? localParts(s.at, timeZone).dateKey.slice(0, 7) : '');
  const months = [...new Set(sessions.map(monthOf))];
  return (
    <>
      {months.map((month) => (
        <section key={month || 'none'}>
          {month && <h2 className="mt-3 mb-2 text-m13 font-semibold text-muted-foreground">{formatDateKey(`${month}-01`, m.intl, { month: 'long', year: 'numeric' })}</h2>}
          <div className="m-card rounded-card px-4 py-1">
            {sessions
              .filter((s) => monthOf(s) === month)
              .map((s, i) => {
                const day = s.at !== null ? localParts(s.at, timeZone).dateKey : null;
                return (
                  <div key={`${s.dateText}-${i}`} className="flex items-start gap-3 py-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line">
                    <Tile color="neutral" size={36}>
                      {day ? <span className="text-m13 leading-none tabular-nums">{Number(day.slice(8))}</span> : '–'}
                    </Tile>
                    <div className="min-w-0 flex-1">
                      <p className="text-m15">{s.description}</p>
                      <p className="text-m13 text-muted-foreground tabular-nums">
                        {/* The date and the time range each stay whole; the line may only break between them. */}
                        <span className="whitespace-nowrap">{s.dateText}</span> · <span className="whitespace-nowrap">{sessionTimeText(s.timeText, locale)}</span>
                      </p>
                      {s.remarks && !masked && (
                        <p className="text-m13 text-muted-foreground">
                          {pw.remarks}: <Private>{remarkText(s.remarks, locale)}</Private>
                        </p>
                      )}
                    </div>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className={s.status === 'absent' ? 'text-urgency-soon' : ''}>
                        <Chip small color={STATUS_TINT[s.status]}>
                          {s.status === 'unknown' ? s.statusText || '-' : pw.status[s.status]}
                        </Chip>
                      </span>
                      {s.points && <span className="text-m12 font-normal text-muted-foreground tabular-nums">{s.points.got}/{s.points.max}</span>}
                    </span>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </>
  );
}

function SessionsSkeleton() {
  return (
    <div className="m-card space-y-4 rounded-card p-4" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="size-9 rounded-ctl bg-m-inset" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-40 rounded-full bg-m-inset" />
            <span className="block h-3 w-24 rounded-full bg-m-inset" />
          </span>
        </div>
      ))}
    </div>
  );
}

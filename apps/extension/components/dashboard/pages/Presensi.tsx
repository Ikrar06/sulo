// Presensi (M7.3): SIKOLA attendance for the monitored courses. Read only.
// The recap is fetched when this page opens and the copy is older than 24
// hours, or on "Perbarui" (2-minute cooldown); a course's sessions only when
// its details are opened. Never during a sync. Numbers only: no limit,
// color or warning about a minimum until that rule is verified
// (presensi/rules.ts MIN_ATTENDANCE_PERCENT). Remarks are hidden in privacy mode.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/components/i18n';
import { Private, usePrivacy } from '@/components/private';
import { Button } from '@/components/ui/button';
import { activeCourseIds } from '@sulo/core/courses/active-score';
import { assignCourseColors } from '@sulo/core/courses/colors';
import { courseAlias } from '@sulo/core/courses/display-name';
import { routeHash } from '@sulo/core/dashboard/routes';
import { formatAgo } from '@sulo/core/format/time';
import { attendanceCmids, type PresensiOutcome } from '@sulo/core/presensi/service';
import type { AttendanceStatus, RecapRow, SessionRow } from '@sulo/core/presensi/types';
import { EMPTY_PRESENSI } from '@sulo/core/presensi/types';
import type { CourseRecord } from '@sulo/core/types';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { Card } from '../Shell';
import type { PageProps } from '../types';

const pct = (v: number, locale: string) => v.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 1 });

export function PresensiPage({ d, data, actions, route }: PageProps) {
  const { m, locale } = useI18n();
  const w = d.presensi;
  const user = data.user!;
  const presensi = user.presensi ?? EMPTY_PRESENSI;
  const followed = useMemo(() => {
    const active = activeCourseIds(user.courses);
    return user.courses.filter((c) => active.has(c.id)).sort((a, b) => courseAlias(a).localeCompare(courseAlias(b), 'id'));
  }, [user.courses]);
  const colors = useMemo(() => assignCourseColors(followed), [followed]);
  const courseId = route.detail !== null && /^\d+$/.test(route.detail) ? Number(route.detail) : null;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const ask = async (target: 'recap' | 'detail', force: boolean) => {
    setBusy(true);
    const outcome = (await actions.send({ type: 'presensi/refresh', target, courseId: courseId ?? undefined, force })) as PresensiOutcome | null;
    setBusy(false);
    setNote(
      !outcome || outcome.status === 'ok' || outcome.status === 'fresh'
        ? ''
        : outcome.status === 'cooldown'
          ? w.cooldown
          : outcome.status === 'unknown_shape'
            ? w.unknownShape
            : outcome.status === 'no_attendance'
              ? target === 'recap'
                ? w.noAttendanceYet
                : ''
              : w.failed,
    );
  };

  // Opening the page (or a course's details) is the user's request: fetch
  // once when the copy is missing or older than 24 hours.
  const opened = useRef<string | null>(null);
  useEffect(() => {
    const key = courseId === null ? 'recap' : `detail:${courseId}`;
    if (opened.current === key) return;
    opened.current = key;
    void ask(courseId === null ? 'recap' : 'detail', false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const rows = new Map((presensi.recap?.rows ?? []).map((r) => [r.courseId, r]));
  const course = courseId === null ? null : (followed.find((c) => c.id === courseId) ?? null);
  const row = courseId === null ? undefined : rows.get(courseId);
  const detail = row ? presensi.details[String(row.cmid)] : undefined;
  const fetchedAt = course ? (detail?.fetchedAt ?? null) : (presensi.recap?.fetchedAt ?? null);
  const withModule = useMemo(() => attendanceCmids(user.snapshots), [user.snapshots]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {course ? (
          <a href={routeHash('presensi')} className="inline-flex items-center gap-1 rounded text-[14px] text-muted-foreground outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus">
            <ChevronLeftIcon className="size-4" />
            {w.back}
          </a>
        ) : (
          <p className="max-w-[68ch] text-[14px] text-muted-foreground">{w.lead}</p>
        )}
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-muted-foreground">{fetchedAt === null ? w.never : w.updated(formatAgo(fetchedAt, data.now, m))}</span>
          <Button variant="outline" disabled={busy} onClick={() => void ask(course ? 'detail' : 'recap', true)}>
            {w.refresh}
          </Button>
        </div>
      </div>
      {busy && fetchedAt === null && <p className="text-[14px] text-muted-foreground">{w.loading}</p>}
      {note && (
        <p role="status" className="text-[14px] text-muted-foreground">
          {note}
        </p>
      )}

      {course ? (
        <Detail course={course} color={colors.get(course.id) ?? null} row={row} sessions={detail?.sessions ?? null} w={w} locale={locale} />
      ) : followed.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">{w.noneMonitored}</p>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {followed.map((c) => (
              <CourseRow key={c.id} course={c} color={colors.get(c.id) ?? null} row={rows.get(c.id)} known={presensi.recap !== null} hasModule={withModule.has(c.id)} w={w} locale={locale} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

type W = PageProps['d']['presensi'];

function Dot({ color }: { color: number | null }) {
  return <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: color === null ? 'var(--muted)' : `var(--course-${color})` }} />;
}

/** Solid neutral bar, like the credits bar; nothing colored about a limit. */
function Bar({ percent }: { percent: number }) {
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised" aria-hidden="true">
      <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </div>
  );
}

function CourseRow({ course, color, row, known, hasModule, w, locale }: { course: CourseRecord; color: number | null; row: RecapRow | undefined; known: boolean; hasModule: boolean; w: W; locale: string }) {
  const name = courseAlias(course);
  const line = !row ? (known || !hasModule ? w.noModule : '') : row.taken === 0 ? w.noSessions : [w.taken(row.taken), row.points ? w.points(row.points.got, row.points.max) : null].filter(Boolean).join(' · ');
  const content = (
    <div className="flex items-center gap-3 py-3">
      <Dot color={color} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{name}</p>
        {line && <p className="text-[12px] text-muted-foreground">{line}</p>}
        {row && row.percent !== null && <Bar percent={row.percent} />}
      </div>
      {row && row.percent !== null && <span className="shrink-0 text-[16px] font-semibold tabular-nums">{pct(row.percent, locale)}%</span>}
      {row && <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />}
    </div>
  );
  if (!row) return <li>{content}</li>;
  return (
    <li>
      <a href={routeHash('presensi', course.id)} aria-label={w.open(name)} className="-mx-3 block rounded-lg px-3 outline-none hover:bg-surface-raised focus-ring:ring-2 focus-ring:ring-focus">
        {content}
      </a>
    </li>
  );
}

const STATUS_CLASS: Record<AttendanceStatus, string> = {
  present: 'border-border text-foreground',
  late: 'border-border text-foreground',
  excused: 'border-border text-foreground',
  unknown: 'border-border text-muted-foreground',
  // The one status shown in a warning color.
  absent: 'border-urgency-soon text-urgency-soon',
};

function Detail({ course, color, row, sessions, w, locale }: { course: CourseRecord; color: number | null; row: RecapRow | undefined; sessions: SessionRow[] | null; w: W; locale: string }) {
  const masked = usePrivacy();
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Dot color={color} />
          {courseAlias(course)}
        </span>
      }
      action={row && row.percent !== null ? <span className="text-[16px] font-semibold tabular-nums">{pct(row.percent, locale)}%</span> : undefined}
    >
      {row && (
        <p className="text-[12px] text-muted-foreground">
          {row.taken === 0 ? w.noSessions : [w.taken(row.taken), row.points ? w.points(row.points.got, row.points.max) : null].filter(Boolean).join(' · ')}
        </p>
      )}
      {sessions === null ? null : sessions.length === 0 ? (
        <p className="mt-3 text-[14px] text-muted-foreground">{w.noDetail}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {sessions.map((s, i) => (
            <li key={`${s.dateText}-${i}`} className="flex items-start gap-3 py-3">
              <div className="w-36 shrink-0 text-[12px] tabular-nums">
                <p className="font-medium">{s.dateText}</p>
                <p className="text-muted-foreground">{s.timeText}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px]">{s.description}</p>
                {s.remarks && !masked && (
                  <p className="text-[12px] text-muted-foreground">
                    {w.remarks}: <Private>{s.remarks}</Private>
                  </p>
                )}
              </div>
              <span className={`shrink-0 rounded-md border px-2 py-1 text-[12px] leading-none font-medium ${STATUS_CLASS[s.status]}`}>{s.status === 'unknown' ? s.statusText || '-' : w.status[s.status]}</span>
              {s.points && <span className="w-12 shrink-0 text-right text-[12px] text-muted-foreground tabular-nums">{s.points.got}/{s.points.max}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

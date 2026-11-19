// The Presensi screen's parts, shared by the dashboard and the Android app:
// a course row (sessions, points, a neutral bar), a course's sessions with
// their statuses, and the one line a fetch outcome may show. Numbers only:
// no limit or warning color about a minimum (presensi/rules.ts); only Alpa
// uses a warning color. Remarks stay hidden in privacy mode.

import { routeHash } from '@sulo/core/dashboard/routes';
import { courseAlias } from '@sulo/core/courses/display-name';
import type { DashMessages } from '@sulo/core/i18n/dashboard';
import { remarkText, sessionTimeText } from '@sulo/core/presensi/display';
import { courseStatus, type PresensiOutcome } from '@sulo/core/presensi/service';
import type { AttendanceStatus, RecapRow, SessionRow } from '@sulo/core/presensi/types';
import type { CourseRecord } from '@sulo/core/types';
import { Card } from '../card';
import { ChevronRightIcon } from '../icons';
import { Chip } from '../mobile/cards';
import { courseTint } from '../mobile/tint';
import { Private, usePrivacy } from '../private';

const pct = (v: number, locale: string) => v.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 1 });

type W = DashMessages['presensi'];

/**
 * The one line under the header after a fetch: nothing for fresh data, the
 * cooldown only for Perbarui pressed again with data on screen, a safe
 * message for a changed page, and never silence for a failure.
 */
export function presensiNote(outcome: PresensiOutcome | null, target: 'recap' | 'detail', force: boolean, hasData: boolean, w: W): string {
  if (!outcome) return w.failed;
  if (outcome.status === 'ok' || outcome.status === 'fresh') return '';
  if (outcome.status === 'cooldown') return force && hasData ? w.cooldown : '';
  if (outcome.status === 'unknown_shape') return w.unknownShape;
  if (outcome.status === 'no_attendance') return target === 'recap' ? w.noAttendanceYet : '';
  return w.failed;
}

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

/** The line under a course name, from its status (presensi/service.ts courseStatus). */
function courseLine(row: RecapRow | undefined, fetched: boolean, w: W): string {
  const status = courseStatus(row, fetched);
  if (status === 'not_fetched') return w.notFetched;
  if (status === 'no_module') return w.noModule;
  if (status === 'no_sessions') return w.noSessions;
  return [w.taken(row!.taken), row!.points ? w.points(row!.points.got, row!.points.max) : null].filter(Boolean).join(' · ');
}

export function CourseRow({ course, color, row, fetched, w, locale }: { course: CourseRecord; color: number | null; row: RecapRow | undefined; fetched: boolean; w: W; locale: string }) {
  const name = courseAlias(course);
  const line = courseLine(row, fetched, w);
  const content = (
    <div className="flex items-center gap-3 py-3">
      {/* The course as the shared tinted chip (Tahap 2, e7); a long name ends in an ellipsis, the percent never does. */}
      <div className="min-w-0 flex-1">
        <span className="flex min-w-0 text-foreground">
          <Chip small color={courseTint(color)}>
            {name}
          </Chip>
        </span>
        {line && <p className="mt-1 text-[12px] text-muted-foreground">{line}</p>}
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

export const STATUS_CLASS: Record<AttendanceStatus, string> = {
  present: 'border-border text-att-present',
  late: 'border-border text-att-late',
  excused: 'border-border text-att-excused',
  unknown: 'border-border text-muted-foreground',
  // The one status shown in a warning color (--att-absent, packages/ui/src/tokens/palette.css).
  absent: 'border-att-absent text-att-absent',
};

/** Placeholder rows while one course's sessions are being fetched. */
function SessionsSkeleton() {
  return (
    <ul className="mt-3 divide-y divide-border" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-center gap-3 py-3">
          <span className="h-3 w-24 rounded bg-surface-raised" />
          <span className="h-3 flex-1 rounded bg-surface-raised" />
          <span className="h-4 w-16 rounded bg-surface-raised" />
        </li>
      ))}
    </ul>
  );
}

/** compact: a phone's width; the date and time sit above the session, status and points on the right. */
export function Detail({ course, color, row, sessions, loading, w, locale, compact = false }: { course: CourseRecord; color: number | null; row: RecapRow | undefined; sessions: SessionRow[] | null; loading: boolean; w: W; locale: 'id' | 'en'; compact?: boolean }) {
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
      {sessions === null ? (loading ? <SessionsSkeleton /> : null) : sessions.length === 0 ? (
        <p className="mt-3 text-[14px] text-muted-foreground">{w.noDetail}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {sessions.map((s, i) => (
            <li key={`${s.dateText}-${i}`} className="flex items-start gap-3 py-3">
              {!compact && (
                <div className="w-36 shrink-0 text-[12px] tabular-nums">
                  <p className="font-medium">{s.dateText}</p>
                  <p className="text-muted-foreground">{sessionTimeText(s.timeText, locale)}</p>
                </div>
              )}
              <div className="min-w-0 flex-1">
                {compact && (
                  <p className="text-[12px] text-muted-foreground tabular-nums">
                    <span className="font-medium text-foreground">{s.dateText}</span> {sessionTimeText(s.timeText, locale)}
                  </p>
                )}
                <p className="text-[14px]">{s.description}</p>
                {s.remarks && !masked && (
                  <p className="text-[12px] text-muted-foreground">
                    {w.remarks}: <Private>{remarkText(s.remarks, locale)}</Private>
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

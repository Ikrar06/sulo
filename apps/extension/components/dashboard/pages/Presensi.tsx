// Presensi (M7.3): SIKOLA attendance for the monitored courses. Read only.
// The recap updates in syncs at most once a day; opening this page fetches it
// only when the copy is older than 24 hours, and "Perbarui" fetches it again
// (2-minute cooldown). A course's sessions are fetched only when its details
// are opened, never in a sync. Numbers only: no limit,
// color or warning about a minimum until that rule is verified
// (presensi/rules.ts MIN_ATTENDANCE_PERCENT). Remarks are hidden in privacy mode.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@sulo/ui/i18n';
import { Button } from '@sulo/ui/ui/button';
import { activeCourseIds } from '@sulo/core/courses/active-score';
import { assignCourseColors } from '@sulo/core/courses/colors';
import { courseAlias } from '@sulo/core/courses/display-name';
import { routeHash } from '@sulo/core/dashboard/routes';
import { formatAgo } from '@sulo/core/format/time';
import { diagnose, type PresensiOutcome } from '@sulo/core/presensi/service';
import { CourseRow, Detail, presensiNote } from '@sulo/ui/dashboard/PresensiParts';
import { EMPTY_PRESENSI } from '@sulo/core/presensi/types';
import { ChevronLeftIcon } from '@sulo/ui/icons';
import { Card } from '@sulo/ui/card';
import type { PageProps } from '../types';

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
    // Whether this view already shows data (the cooldown line only makes sense then).
    const cmid = courseId === null ? undefined : presensi.recap?.rows.find((r) => r.courseId === courseId)?.cmid;
    const hasData = target === 'recap' ? presensi.recap !== null : cmid !== undefined && presensi.details[String(cmid)] !== undefined;
    setBusy(true);
    const outcome = (await actions.send({ type: 'presensi/refresh', target, courseId: courseId ?? undefined, force })) as PresensiOutcome | null;
    setBusy(false);
    setNote(presensiNote(outcome, target, force, hasData, w));
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
  const monitored = useMemo(() => new Set(followed.map((c) => c.id)), [followed]);

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
          <span className="text-[12px] text-muted-foreground">{fetchedAt !== null ? w.updated(formatAgo(fetchedAt, data.now, m)) : busy ? w.loading : w.never}</span>
          <Button variant="outline" disabled={busy} onClick={() => void ask(course ? 'detail' : 'recap', true)}>
            {w.refresh}
          </Button>
        </div>
      </div>
      {busy && fetchedAt === null && !course && <p className="text-[14px] text-muted-foreground">{w.loading}</p>}
      {note && (
        <p role="status" className="text-[14px] text-muted-foreground">
          {note}
        </p>
      )}

      {course ? (
        <Detail course={course} color={colors.get(course.id) ?? null} row={row} sessions={detail?.sessions ?? null} loading={busy && !detail} w={w} locale={locale} />
      ) : followed.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">{w.noneMonitored}</p>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {followed.map((c) => (
              <CourseRow key={c.id} course={c} color={colors.get(c.id) ?? null} row={rows.get(c.id)} fetched={presensi.recap !== null} w={w} locale={locale} />
            ))}
          </ul>
        </Card>
      )}
      {/* Tester and development builds: how attendance looks in storage (counts and ids, no names). */}
      {import.meta.env.MODE !== 'production' && <PresensiDiagnosisPanel diagnosis={diagnose(user.snapshots, presensi, monitored)} />}
    </div>
  );
}

function PresensiDiagnosisPanel({ diagnosis: g }: { diagnosis: ReturnType<typeof diagnose> }) {
  const line = (k: string, v: unknown) => (
    <p>
      <span className="text-muted-foreground">{k}: </span>
      {typeof v === 'string' ? v : JSON.stringify(v)}
    </p>
  );
  return (
    <details className="rounded-xl border border-dashed border-border p-4 text-[12px] tabular-nums">
      <summary className="cursor-pointer text-muted-foreground">Diagnosis presensi (build penguji)</summary>
      <div className="mt-2 space-y-1">
        {line('mata kuliah dengan snapshot struktur', `${g.coursesWithSnapshot} (dipantau ${g.followedWithSnapshot} dari ${g.followed})`)}
        {line('modul attendance di snapshot', `${g.attendanceModules} (bisa dibuka ${g.attendanceVisible})`)}
        {line('modul per modname', g.modulesByName)}
        {line('cmid presensi yang diketahui', g.knownCmids)}
        {line('rekap', g.recapFetched ? `${g.recapRows} baris dipantau, ${g.followedWithNumbers} dengan sesi tercatat` : 'belum diambil')}
        {line('dipantau tapi tidak ada di rekap (course id)', g.followedNotInRecap)}
        {line('hasil terakhir', g.lastOutcome ?? '-')}
      </div>
    </details>
  );
}

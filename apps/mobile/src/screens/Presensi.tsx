// Presensi: the recap for the followed courses, and a course's sessions on
// their own screen. The same rules as the extension: the recap updates in
// syncs at most once a day and on Perbarui (2-minute cooldown); opening a
// view fetches only a missing or day-old copy; a course's sessions only when
// opened. Every page is checked against the active account (core).

import { useEffect, useMemo, useRef, useState } from 'react';
import { activeCourseIds } from '@sulo/core/courses/active-score';
import { assignCourseColors } from '@sulo/core/courses/colors';
import { courseAlias } from '@sulo/core/courses/display-name';
import { formatAgo } from '@sulo/core/format/time';
import { mobileDash } from '@sulo/core/i18n/mobile';
import { mobileWords } from '@sulo/core/i18n/mobile';
import { EMPTY_PRESENSI } from '@sulo/core/presensi/types';
import { Card } from '@sulo/ui/card';
import { CourseRow, Detail, presensiNote } from '@sulo/ui/dashboard/PresensiParts';
import { useI18n } from '@sulo/ui/i18n';
import { useMobileData } from '../shell/data';
import type { Screen } from '../shell/nav';
import { refreshPresensi } from '../sync';
import { secondaryButton } from './ui';

export function PresensiScreen({ courseId }: { courseId: number | null; go: (s: Screen) => void }) {
  const { m, locale } = useI18n();
  const w = mobileDash(locale).presensi;
  const mw = mobileWords(locale);
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

  const rows = new Map((presensi.recap?.rows ?? []).map((r) => [r.courseId, r]));
  const course = courseId === null ? null : (followed.find((c) => c.id === courseId) ?? null);
  const row = courseId === null ? undefined : rows.get(courseId);
  const detail = row ? presensi.details[String(row.cmid)] : undefined;
  const fetchedAt = course ? (detail?.fetchedAt ?? null) : (presensi.recap?.fetchedAt ?? null);

  const ask = async (force: boolean) => {
    const target = course ? 'detail' : 'recap';
    const hasData = target === 'recap' ? presensi.recap !== null : detail !== undefined;
    setBusy(true);
    const outcome = await refreshPresensi(platform, target, courseId, force).catch(() => null);
    setBusy(false);
    setNote(outcome?.status === 'failed' && outcome.reason === 'offline' ? mw.app.offline : presensiNote(outcome, target, force, hasData, w));
  };

  // Opening the screen (or a course) is the user's request: fetch only a missing or day-old copy.
  const opened = useRef<string | null>(null);
  useEffect(() => {
    const key = courseId === null ? 'recap' : `detail:${courseId}`;
    if (opened.current === key) return;
    opened.current = key;
    setNote('');
    void ask(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  return (
    <div className="space-y-4">
      {!course && <p className="text-[14px] text-muted-foreground">{w.lead}</p>}
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 text-[12px] text-muted-foreground">{fetchedAt !== null ? w.updated(formatAgo(fetchedAt, data!.now, m)) : busy ? w.loading : w.never}</span>
        <button type="button" className={secondaryButton} disabled={busy} onClick={() => void ask(true)}>
          {w.refresh}
        </button>
      </div>
      {note && (
        <p role="status" className="text-[14px] text-muted-foreground">
          {note}
        </p>
      )}
      {course ? (
        <Detail course={course} color={colors.get(course.id) ?? null} row={row} sessions={detail?.sessions ?? null} loading={busy && !detail} w={w} locale={locale} compact />
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
    </div>
  );
}

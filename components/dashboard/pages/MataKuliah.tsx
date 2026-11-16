import { useId, useState } from 'react';
import { AlertIcon, RefreshIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { isCourseActive } from '@/lib/courses/active-score';
import { assignCourseColors } from '@/lib/courses/colors';
import { courseAlias, courseNameWithClass } from '@/lib/courses/display-name';
import { ALIAS_MAX, setActivePin, setAlias, setColor } from '@/lib/courses/edit';
import type { CourseAccess } from '@/lib/storage';
import type { CourseRecord } from '@/lib/types';
import { ColorSwatches } from '../ColorSwatches';
import { Card } from '../Shell';
import type { PageProps } from '../types';

export function MataKuliahPage({ d, data, actions }: PageProps) {
  const t = d.mataKuliah;
  const user = data.user!;
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const byName = (a: CourseRecord, b: CourseRecord) => courseAlias(a).localeCompare(courseAlias(b), 'id');
  const active = user.courses.filter(isCourseActive).sort(byName);
  const inactive = user.courses.filter((c) => !isCourseActive(c)).sort(byName);
  const colors = assignCourseColors(active);
  const access = user.radar.courseAccess ?? {};
  const courses = (fn: (c: CourseRecord[]) => CourseRecord[]) => void actions.updateUser('courses', fn);

  const refresh = async () => {
    setRefreshing(true);
    setNote(null);
    const outcome = await actions.sync(true);
    setRefreshing(false);
    setNote(outcome?.status === 'ok' ? t.refreshed : null);
  };

  if (user.courses.length === 0) return <p className="text-[14px] text-muted-foreground">{t.empty}</p>;

  /** The color "Otomatis" would give this course right now. */
  const autoColorOf = (c: CourseRecord) => (isCourseActive(c) ? (assignCourseColors(active.map((x) => (x.id === c.id ? { ...x, color: null } : x))).get(c.id) ?? null) : null);

  const row = (c: CourseRecord) => (
    <CourseRow
      key={c.id}
      course={c}
      color={colors.get(c.id) ?? null}
      autoColor={autoColorOf(c)}
      access={access[String(c.id)]}
      d={d}
      onActive={(v) => courses((list) => setActivePin(list, c.id, v))}
      onAlias={(v) => courses((list) => setAlias(list, c.id, v))}
      onColor={(v) => courses((list) => setColor(list, c.id, v))}
    />
  );

  // Visible header over the name column (wide screens; each field also has its own label).
  const columnLabel = <span className="hidden w-60 text-[12px] text-muted-foreground md:block">{t.displayName}</span>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => void refresh()} disabled={refreshing}>
          <RefreshIcon className={`size-4 ${refreshing ? 'motion-safe:animate-spin' : ''}`} />
          {refreshing ? t.refreshing : t.refreshList}
        </Button>
        {note && (
          <p role="status" className="text-[12px] text-muted-foreground">
            {note}
          </p>
        )}
      </div>
      {/* One note for every row, instead of a helper under each name field. */}
      <p className="text-[12px] leading-normal text-muted-foreground">
        {t.activeHelp} {t.displayNameHelp}
      </p>
      <Card title={`${t.active} (${active.length})`} action={columnLabel}>
        <ul className="divide-y divide-border">{active.map(row)}</ul>
      </Card>
      {inactive.length > 0 && (
        <Card title={`${t.inactive} (${inactive.length})`} action={columnLabel}>
          <ul className="divide-y divide-border">{inactive.map(row)}</ul>
        </Card>
      )}
    </div>
  );
}

function CourseRow({ course, color, autoColor, access, d, onActive, onAlias, onColor }: {
  course: CourseRecord;
  color: number | null;
  autoColor: number | null;
  access: CourseAccess | undefined;
  d: PageProps['d'];
  onActive: (active: boolean) => void;
  onAlias: (alias: string) => void;
  onColor: (color: number | null) => void;
}) {
  const t = d.mataKuliah;
  const ids = { active: useId(), alias: useId() };
  const [alias, setAliasText] = useState(course.alias ?? '');
  const isActive = isCourseActive(course);
  const chosen = course.color ? Number(course.color.replace('course-', '')) : null;
  const name = courseAlias(course);
  return (
    <li className="grid gap-3 py-3 md:grid-cols-[minmax(0,1fr)_240px] md:items-center">
      <div className="flex items-start gap-3">
        <Checkbox id={ids.active} className="mt-1" checked={isActive} onCheckedChange={(v) => onActive(v === true)} />
        <div className="min-w-0 space-y-1">
          <label htmlFor={ids.active} className="flex items-center gap-2 text-[14px] leading-6 font-semibold">
            {isActive && color !== null && <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: `var(--course-${color})` }} />}
            {courseNameWithClass(course)}
          </label>
          <p className="truncate text-[12px] text-muted-foreground" title={course.fullname}>
            {t.original(course.fullname)}
          </p>
          {isActive && <ColorSwatches value={chosen} onChange={onColor} label={t.colorFor(name)} autoLabel={t.colorAuto} names={t.colorNames} autoColor={autoColor} />}
          {access && access.failures > 0 ? (
            <div className="flex items-start gap-2 text-[12px] leading-normal">
              <AlertIcon className="mt-1 size-3 shrink-0 text-urgency-soon" />
              <span>
                <span className="font-semibold">{t.accessTitle}.</span> <span className="text-muted-foreground">{t.accessBody(access.failures)}</span>
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <div>
        <label htmlFor={ids.alias} className="sr-only">
          {`${t.displayName}: ${name}`}
        </label>
        <Input
          id={ids.alias}
          maxLength={ALIAS_MAX}
          placeholder={courseAlias({ ...course, alias: null })}
          value={alias}
          onChange={(e) => setAliasText(e.target.value)}
          onBlur={() => alias !== (course.alias ?? '') && onAlias(alias)}
        />
      </div>
    </li>
  );
}

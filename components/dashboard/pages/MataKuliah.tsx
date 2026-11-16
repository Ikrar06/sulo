import { useId, useState } from 'react';
import { AlertIcon, RefreshIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isCourseActive } from '@/lib/courses/active-score';
import { assignCourseColors, COURSE_COLOR_COUNT } from '@/lib/courses/colors';
import { courseAlias, courseNameWithClass } from '@/lib/courses/display-name';
import { ALIAS_MAX, setActivePin, setAlias, setColor } from '@/lib/courses/edit';
import type { CourseAccess } from '@/lib/storage';
import type { CourseRecord } from '@/lib/types';
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

  const row = (c: CourseRecord) => (
    <CourseRow
      key={c.id}
      course={c}
      color={colors.get(c.id) ?? null}
      access={access[String(c.id)]}
      d={d}
      onActive={(v) => courses((list) => setActivePin(list, c.id, v))}
      onAlias={(v) => courses((list) => setAlias(list, c.id, v))}
      onColor={(v) => courses((list) => setColor(list, c.id, v))}
    />
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => void refresh()} disabled={refreshing}>
          <RefreshIcon className={`size-4 ${refreshing ? 'motion-safe:animate-spin' : ''}`} />
          {refreshing ? t.refreshing : t.refreshList}
        </Button>
        {note && (
          <p role="status" className="text-[13px] text-muted-foreground">
            {note}
          </p>
        )}
      </div>
      <Card title={`${t.active} (${active.length})`}>
        <p className="-mt-1 mb-3 text-[13px] text-muted-foreground">{t.activeHelp}</p>
        <ul className="divide-y divide-border">{active.map(row)}</ul>
      </Card>
      {inactive.length > 0 && (
        <Card title={`${t.inactive} (${inactive.length})`}>
          <ul className="divide-y divide-border">{inactive.map(row)}</ul>
        </Card>
      )}
    </div>
  );
}

function CourseRow({ course, color, access, d, onActive, onAlias, onColor }: {
  course: CourseRecord;
  color: number | null;
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
  return (
    <li className="grid gap-3 py-3 md:grid-cols-[minmax(0,1fr)_260px_170px] md:items-start">
      <div className="flex items-start gap-3">
        <Checkbox id={ids.active} className="mt-0.5" checked={isActive} onCheckedChange={(v) => onActive(v === true)} />
        <div className="min-w-0">
          <label htmlFor={ids.active} className="flex items-center gap-2 text-[14.5px] font-medium">
            {isActive && color !== null && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: `var(--course-${color})` }} />}
            {courseNameWithClass(course)}
          </label>
          <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground" title={course.fullname}>
            {t.original(course.fullname)}
          </p>
          {access?.flagged || (access && access.failures > 0) ? (
            <div className="mt-2 flex items-start gap-2 text-[12.5px] leading-[18px]">
              <AlertIcon className="mt-px size-3.5 shrink-0 text-urgency-soon" />
              <span>
                <span className="font-medium">{t.accessTitle}.</span> <span className="text-muted-foreground">{t.accessBody(access.failures)}</span>
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor={ids.alias} className="text-[12.5px] text-muted-foreground">
          {t.displayName}
        </label>
        <Input
          id={ids.alias}
          maxLength={ALIAS_MAX}
          placeholder={courseAlias({ ...course, alias: null })}
          value={alias}
          onChange={(e) => setAliasText(e.target.value)}
          onBlur={() => alias !== (course.alias ?? '') && onAlias(alias)}
          aria-describedby={`${ids.alias}-help`}
        />
        <p id={`${ids.alias}-help`} className="text-[11.5px] text-muted-foreground">
          {t.displayNameHelp}
        </p>
      </div>
      <div className="space-y-1">
        <span className="text-[12.5px] text-muted-foreground">{t.color}</span>
        <Select value={chosen === null ? 'auto' : String(chosen)} onValueChange={(v) => onColor(v === 'auto' ? null : Number(v))}>
          <SelectTrigger className="w-full" aria-label={`${t.color}: ${courseAlias(course)}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">{t.colorAuto}</SelectItem>
            {Array.from({ length: COURSE_COLOR_COUNT }, (_, i) => i + 1).map((n) => (
              <SelectItem key={n} value={String(n)}>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: `var(--course-${n})` }} />
                  {t.colorN(n)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </li>
  );
}

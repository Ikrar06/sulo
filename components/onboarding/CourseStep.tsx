import { useMemo, useState } from 'react';
import { ChevronDownIcon, SearchIcon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ACTIVE_THRESHOLD, isCourseActive } from '@/lib/courses/active-score';
import { courseNameWithClass } from '@/lib/courses/display-name';
import { useI18n } from '@/components/i18n';
import type { CourseId, CourseRecord } from '@/lib/types';
import { Lead, Title } from './Shell';


function CourseCard({ course, onToggle }: { course: CourseRecord; onToggle: (id: CourseId, active: boolean) => void }) {
  const checked = isCourseActive(course);
  const inputId = `course-${course.id}`;
  return (
    <li>
      <label
        htmlFor={inputId}
        title={course.fullname}
        className={`flex h-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors ${
          checked ? 'border-foreground/35 bg-surface-raised' : 'border-border hover:border-foreground/25'
        }`}
      >
        <Checkbox id={inputId} checked={checked} onCheckedChange={(v) => onToggle(course.id, v === true)} className="size-5" />
        <span className={`min-w-0 text-[15.5px] leading-snug ${checked ? 'font-medium' : 'text-foreground/80'}`}>{courseNameWithClass(course)}</span>
      </label>
    </li>
  );
}

/** Grouping for step 3: Moodle says in progress, or the score says active. */
const isCurrentSemester = (c: CourseRecord) => c.inProgress || c.activeScore >= ACTIVE_THRESHOLD;

export interface StepCoursesProps {
  courses: CourseRecord[];
  onToggle: (id: CourseId, active: boolean) => void;
}

/** The course step body. Its action bar is rendered by the shell (CoursesFooter). */
export function StepCourses({ courses, onToggle }: StepCoursesProps) {
  const { m } = useI18n();
  const t = m.onboarding;
  const [query, setQuery] = useState('');
  // Open the previous-semester section when it already holds a checked course,
  // so the count on the button always matches the ticks the user can see.
  const [previousOpen, setPreviousOpen] = useState(() =>
    courses.some((c) => !isCurrentSemester(c) && isCourseActive(c)),
  );
  const q = query.trim().toLowerCase();
  const matches = (c: CourseRecord) => !q || c.fullname.toLowerCase().includes(q) || courseNameWithClass(c).toLowerCase().includes(q);

  // Groups follow the semester, not the checkbox, so a card never jumps
  // between groups while the user is clicking.
  const { current, previous } = useMemo(() => {
    const byName = (a: CourseRecord, b: CourseRecord) => courseNameWithClass(a).localeCompare(courseNameWithClass(b), 'id');
    return { current: courses.filter(isCurrentSemester).sort(byName), previous: courses.filter((c) => !isCurrentSemester(c)).sort(byName) };
  }, [courses]);

  const suggested = current.filter((c) => c.activePin === null || c.activePin).length;
  const shownCurrent = current.filter(matches);
  const shownPrevious = previous.filter(matches);
  const open = previousOpen || q.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-4">
        <Mascot state="onboarding" size={72} followCursor grounded className="-mb-1 shrink-0" />
        <Title>{t.courses.title}</Title>
      </div>
      <Lead>{t.courses.lead(suggested)}</Lead>
      <div className="relative max-w-[420px]">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          className="h-12 w-full rounded-xl border border-border bg-background pr-4 pl-11 text-[16px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          placeholder={t.courses.search}
          aria-label={t.courses.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold text-muted-foreground">{t.courses.current(current.length)}</h2>
        {shownCurrent.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">{t.courses.none}</p>
        ) : (
          <ul className="grid gap-2.5 md:grid-cols-2">
            {shownCurrent.map((c) => (
              <CourseCard key={c.id} course={c} onToggle={onToggle} />
            ))}
          </ul>
        )}
      </section>

      {previous.length > 0 && (
        <Collapsible open={open} onOpenChange={setPreviousOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 rounded-md py-1 text-[15px] font-semibold text-muted-foreground hover:text-foreground">
            {t.courses.previous(previous.length)}
            <ChevronDownIcon className={`size-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            {shownPrevious.length === 0 ? (
              <p className="mt-3 text-[15px] text-muted-foreground">{t.courses.none}</p>
            ) : (
              <ul className="mt-3 grid gap-2.5 md:grid-cols-2">
                {shownPrevious.map((c) => (
                  <CourseCard key={c.id} course={c} onToggle={onToggle} />
                ))}
              </ul>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function CoursesFooter({ selected, onNext, saving }: { selected: number; onNext: () => void; saving?: boolean }) {
  const { m } = useI18n();
  const t = m.onboarding;
  return (
    <div className="flex justify-end">
      <Button size="lg" className="ob-cta" onClick={onNext} disabled={saving || selected === 0}>
        {t.courses.next(selected)}
      </Button>
    </div>
  );
}


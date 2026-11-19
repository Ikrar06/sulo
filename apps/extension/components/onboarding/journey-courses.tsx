// "Pantau yang mana?" (Tahap 2, second layout): one card as tall as its rows
// (at most 70 % of the content area, then it scrolls inside with faded
// edges); rows with the course's initial tile, tinted when chosen, dimmed
// when not, no border; the search field only for more than eight courses.

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { assignCourseColors } from '@sulo/core/courses/colors';
import { ACTIVE_THRESHOLD, isCourseActive } from '@sulo/core/courses/active-score';
import { courseNameWithClass } from '@sulo/core/courses/display-name';
import type { CourseId, CourseRecord } from '@sulo/core/types';
import { extOnboardingWords } from '@sulo/core/i18n/ext-onboarding';
import { useI18n } from '@sulo/ui/i18n';
import { ChevronDownIcon, SearchIcon } from '@sulo/ui/icons';
import { Tile } from '@sulo/ui/mobile/cards';
import { courseTint, initials, tintBg } from '@sulo/ui/mobile/tint';
import { Button } from '@sulo/ui/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@sulo/ui/ui/collapsible';
import { JActions, JAfter, JLine, JStatus, JTitle, story, useMascot } from './journey';

const words = (locale: 'id' | 'en') => extOnboardingWords(locale);

// ---------- Courses: tinted rows with the initial tile and the check circle ----------

const isCurrentSemester = (c: CourseRecord) => c.inProgress || c.activeScore >= ACTIVE_THRESHOLD;
/** The search field shows only for a longer list. */
const SEARCH_FROM = 9;

/** Chosen: the row takes a tint of its course color; not chosen: a plain row, dimmed. No border either way. */
function CourseRow({ course, color, onToggle }: { course: CourseRecord; color: number; onToggle: (id: CourseId, active: boolean, el: HTMLElement) => void }) {
  const on = isCourseActive(course);
  const name = courseNameWithClass(course);
  const tint = courseTint(color);
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        title={course.fullname}
        onClick={(e) => onToggle(course.id, !on, e.currentTarget)}
        className="flex min-h-14 w-full items-center gap-3 rounded-[14px] py-2 pr-3 pl-2.5 text-left outline-none focus-ring:ring-2 focus-ring:ring-focus"
        style={{ background: on ? tintBg(tint, 16, 'var(--layer-card)') : 'var(--layer-card)' }}
      >
        <span className={`transition-opacity duration-150 ${on ? '' : 'opacity-60'}`}>
          <Tile color={tint} size={32} solid>
            {initials(name)}
          </Tile>
        </span>
        <span className={`min-w-0 flex-1 text-[14px] leading-5 font-medium transition-opacity duration-150 ${on ? '' : 'opacity-60'}`}>{name}</span>
        <span aria-hidden="true" className={`inline-flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-foreground bg-foreground text-bg' : 'border-muted-foreground text-transparent'}`}>
          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5 10 17 19 7.5" />
          </svg>
        </span>
      </button>
    </li>
  );
}

export function SceneCourses({ courses, onToggle }: { courses: CourseRecord[]; onToggle: (id: CourseId, active: boolean) => void }) {
  const { locale } = useI18n();
  const { ext } = words(locale);
  const [query, setQuery] = useState('');
  const [previousOpen, setPreviousOpen] = useState(() => courses.some((c) => !isCurrentSemester(c) && isCourseActive(c)));
  const [glance, setGlance] = useState<{ y: number; at: number } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState<'none' | 'top' | 'bottom' | 'both'>('none');
  const colors = useMemo(() => assignCourseColors(courses), [courses]);
  const q = query.trim().toLowerCase();
  const matches = (c: CourseRecord) => !q || c.fullname.toLowerCase().includes(q) || courseNameWithClass(c).toLowerCase().includes(q);
  const { current, previous } = useMemo(() => {
    const byName = (a: CourseRecord, b: CourseRecord) => courseNameWithClass(a).localeCompare(courseNameWithClass(b), 'id');
    return { current: courses.filter(isCurrentSemester).sort(byName), previous: courses.filter((c) => !isCurrentSemester(c)).sort(byName) };
  }, [courses]);
  const open = previousOpen || q.length > 0;
  // The mascot glances at the row that was clicked.
  useMascot(glance ? { state: 'onboarding', look: { x: -1, y: glance.y }, lookMs: story(700), then: 'onboarding', at: glance.at } : { state: 'onboarding' });
  const toggle = (id: CourseId, active: boolean, el: HTMLElement) => {
    const m = document.querySelector('[data-onb-mascot]')?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const y = m ? Math.max(-1, Math.min(1, (r.top + r.height / 2 - (m.top + m.height / 2)) / 240)) : 0;
    setGlance({ y, at: Date.now() });
    onToggle(id, active);
  };
  // An edge fades only while more of the list is hidden behind it.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const check = () => {
      const top = el.scrollTop > 1;
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      setFade(top && bottom ? 'both' : top ? 'top' : bottom ? 'bottom' : 'none');
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    el.addEventListener('scroll', check, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', check);
    };
  }, [open, q, courses.length]);
  const row = (c: CourseRecord) => <CourseRow key={c.id} course={c} color={colors.get(c.id) ?? 1} onToggle={toggle} />;
  return (
    <div className="obj-scene">
      <div ref={list} data-fade={fade} className="obj-list m-card rounded-card grid gap-2 p-3">
        {courses.length >= SEARCH_FROM && (
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              data-slot="input"
              className="h-10 w-full rounded-[12px] border border-transparent pr-3 pl-9 text-[14px] outline-none placeholder:text-muted-foreground focus-visible:border-focus"
              style={{ background: 'var(--layer-inset)' }}
              placeholder={ext.courses.search}
              aria-label={ext.courses.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}
        <ul className="grid gap-2">{current.filter(matches).map(row)}</ul>
        {previous.length > 0 && (
          <Collapsible open={open} onOpenChange={setPreviousOpen}>
            <CollapsibleTrigger className="flex h-10 items-center gap-2 rounded-md px-3 text-[14px] font-semibold text-muted-foreground outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus">
              {ext.courses.previous(previous.length)}
              <ChevronDownIcon className={`size-4 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-1 grid gap-2">{previous.filter(matches).map(row)}</ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

export function CoursesText({ selected, saving, onNext }: { selected: number; saving: boolean; onNext: () => void }) {
  const { locale } = useI18n();
  const { phone, ext } = words(locale);
  return (
    <>
      <JTitle id="ob-title">{phone.courses.title}</JTitle>
      <JLine>{phone.courses.body}</JLine>
      <JActions>
        <Button disabled={selected === 0 || saving} onClick={onNext}>
          {ext.courses.next}
        </Button>
      </JActions>
      <JAfter>{selected === 0 ? <JStatus tone="problem">{phone.courses.none}</JStatus> : <JStatus tone="ok">{phone.courses.selected(selected)}</JStatus>}</JAfter>
    </>
  );
}


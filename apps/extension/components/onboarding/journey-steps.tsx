// The steps of the extension's onboarding (Tahap 2), in the journey frame.
// The step engine (core onboarding/flow.ts), its order, permissions and logic
// are unchanged: this is the look and the motion. Scenes are built from the
// real components at their real size (the phone's task card, a reminder
// banner, a countdown from core formatCountdown, the attendance ring), level
// and straight; synthetic sample data only.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { assignCourseColors } from '@sulo/core/courses/colors';
import { ACTIVE_THRESHOLD, isCourseActive } from '@sulo/core/courses/active-score';
import { courseNameWithClass } from '@sulo/core/courses/display-name';
import { formatCountdown } from '@sulo/core/format/countdown';
import { extOnboardingWords } from '@sulo/core/i18n/ext-onboarding';
import { STAGE_ROWS, stageResults, type OnboardingStages } from '@sulo/core/onboarding/stages';
import type { CourseId, CourseRecord } from '@sulo/core/types';
import { useI18n } from '@sulo/ui/i18n';
import { BellIcon, CalendarPlusIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ClockIcon, LockIcon, SearchIcon } from '@sulo/ui/icons';
import { Chip } from '@sulo/ui/mobile/cards';
import { CheckCircle } from '@sulo/ui/mobile/controls';
import { ProgressRing } from '@sulo/ui/mobile/ring';
import { TaskCardView } from '@sulo/ui/mobile/task-card';
import { courseTint, tintBg } from '@sulo/ui/mobile/tint';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@sulo/ui/ui/alert-dialog';
import { Button } from '@sulo/ui/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@sulo/ui/ui/collapsible';
import { JActions, JLine, JTitle, MascotSlot, sceneLevel, story, useMascot, useSceneMascotSize } from './journey';

const words = (locale: 'id' | 'en') => extOnboardingWords(locale);

/** A scene piece arriving, `i`-th in its scene (story motion; still under reduced motion, all at once at the simple level). */
function In({ i, children, className = '', optional = false }: { i: number; children: ReactNode; className?: string; optional?: boolean }) {
  const level = sceneLevel();
  const opt = optional ? { 'data-ob-optional': '' } : {};
  if (level === 'still') return <div className={className} {...opt}>{children}</div>;
  const delay = level === 'simple' ? 0 : story(140 * i);
  return (
    <div {...opt} className={`obj-in ${className}`} style={{ ['--obj-delay' as string]: `${delay}ms`, ['--obj-dur' as string]: `${story(level === 'simple' ? 220 : 360)}ms` }}>
      {children}
    </div>
  );
}

// ---------- Intro: three pages, the phone's words ----------

const TONE: Record<string, string> = { overdue: 'text-urgency-overdue', soon: 'text-urgency-soon', later: 'text-muted-foreground' };
const COLORS = [1, 4, 6, 3, 5, 7];

function SceneTasks() {
  const { locale } = useI18n();
  const { phone, ext } = words(locale);
  const size = useSceneMascotSize();
  // The phone's four sample tasks; two more while the stage has the height for them.
  const cards = [...phone.intro1.cards.map((c) => ({ ...c, optional: false })), ...ext.scene.moreCards.map((c) => ({ ...c, optional: true }))];
  return (
    <div className="obj-scene">
      {cards.map((c, i) => (
        <In key={c.title} i={i} className="pointer-events-none w-full" optional={c.optional}>
          <TaskCardView course={c.course} color={courseTint(COLORS[i % COLORS.length])} title={c.title} relative={c.due} tone={TONE[c.tone] ?? ''} done={false} doneLabel="" onDone={() => undefined} />
        </In>
      ))}
      <MascotSlot size={size} />
    </div>
  );
}

function Banner({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="m-card rounded-card flex w-full items-center gap-3 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--layer-inset)' }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{title}</span>
        <span className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">{children}</span>
      </span>
    </div>
  );
}

function SceneRemind() {
  const { locale } = useI18n();
  const { phone, ext } = words(locale);
  const w = phone.intro2;
  const size = useSceneMascotSize();
  // A real countdown from core, ticking while the page shows (4 hours 12 minutes from now).
  const [left, setLeft] = useState(4 * 3600_000 + 12 * 60_000 + 30_000);
  useEffect(() => {
    if (sceneLevel() === 'still') return;
    const t = window.setInterval(() => setLeft((v) => Math.max(0, v - 1000)), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="obj-scene">
      <In i={0} className="w-full">
        <Banner icon={<BellIcon className="size-5" />} title={w.notifyTitle}>
          <Chip small color={courseTint(4)}>
            {w.notifyCourse}
          </Chip>
          <span className="text-urgency-soon">{phone.intro1.cards[1]!.due}</span>
        </Banner>
      </In>
      <In i={1} className="w-full">
        <Banner icon={<CalendarPlusIcon className="size-5" />} title={ext.scene.calendarTitle}>
          <Chip small color="cat-ujian">
            {ext.scene.calendarTag}
          </Chip>
        </Banner>
      </In>
      <In i={2} className="w-full">
        <Banner icon={<ClockIcon className="size-5" />} title={ext.scene.morningTitle}>
          {ext.scene.morningBody}
        </Banner>
      </In>
      <In i={3} className="w-full" optional>
        <Banner icon={<BellIcon className="size-5" />} title={ext.scene.lateTitle}>
          <Chip small color={courseTint(1)}>
            {phone.intro1.cards[0]!.course}
          </Chip>
          <span className="text-urgency-overdue">{phone.intro1.cards[0]!.due}</span>
        </Banner>
      </In>
      <In i={4} className="w-full" optional>
        <Banner icon={<CalendarPlusIcon className="size-5" />} title={ext.scene.krsTitle}>
          <Chip small color="cat-administrasi">
            {ext.scene.krsTag}
          </Chip>
        </Banner>
      </In>
      <div className="grid w-full grid-cols-2 gap-3">
        <In i={5}>
          <div className="m-card rounded-card h-full p-4">
            <p className="text-[12px] text-muted-foreground">{w.countdownLabel}</p>
            <p className="db-accent-text mt-1 text-[20px] leading-7 font-semibold whitespace-nowrap tabular-nums">{formatCountdown(left, locale)}</p>
          </div>
        </In>
        <In i={6}>
          <div className="m-card rounded-card flex h-full items-center gap-3 p-4">
            <ProgressRing value={86} size={48} stroke={6} label={`${w.attendanceLabel} 86%`} />
            <span>
              <span className="block text-[12px] text-muted-foreground">{w.attendanceLabel}</span>
              <span className="block text-[20px] leading-7 font-semibold tabular-nums">86%</span>
            </span>
          </div>
        </In>
      </div>
      <MascotSlot size={size} />
    </div>
  );
}

function ScenePrivate() {
  const { locale } = useI18n();
  const { ext } = words(locale);
  const w = ext.intro3;
  const size = useSceneMascotSize();
  return (
    <div className="obj-scene">
      <In i={0} className="w-full">
        <div className="m-card rounded-card flex items-center justify-between gap-3 p-4 text-[14px] font-semibold">
          <span>SIKOLA</span>
          <span className="flex flex-1 items-center gap-2 text-[12px] font-normal text-muted-foreground">
            <span className="h-px flex-1" style={{ background: 'var(--layer-line)' }} />
            {ext.scene.readOnly}
            <span className="h-px flex-1" style={{ background: 'var(--layer-line)' }} />
          </span>
          <span>Sulo</span>
        </div>
      </In>
      <In i={1} className="w-full">
        <div className="m-card rounded-card p-4">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <LockIcon className="size-4" />
            <span>chrome.storage.local</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {w.data.map((d) => (
              <Chip key={d}>{d}</Chip>
            ))}
          </div>
        </div>
      </In>
      {w.badges.map((b, i) => (
        <In key={b} i={i + 2} className="w-full" optional={i >= 4}>
          <div className="m-card rounded-card flex items-center gap-3 px-4 py-3 text-[14px]">
            <CheckIcon className="size-4 text-muted-foreground" />
            {b}
          </div>
        </In>
      ))}
      <MascotSlot size={size} />
    </div>
  );
}

const INTRO_SCENES = [SceneTasks, SceneRemind, ScenePrivate] as const;
export const INTRO_PAGES = INTRO_SCENES.length;

export function introScene(page: number): ReactNode {
  const Scene = INTRO_SCENES[page]!;
  return <Scene key={page} />;
}

export function IntroText({ page, onNext, onGo, onBack, onWhy }: { page: number; onNext: () => void; onGo: (page: number) => void; onBack?: () => void; onWhy: () => void }) {
  const { locale } = useI18n();
  const { phone, ext } = words(locale);
  const text = [phone.intro1, phone.intro2, ext.intro3][page]!;
  useMascot({ state: page === 2 ? 'all-done' : 'idle', look: page === 0 ? { x: 0, y: -1 } : null });
  const last = page === INTRO_PAGES - 1;
  return (
    <>
      <JTitle id="ob-title">{text.title}</JTitle>
      <JLine>{text.body}</JLine>
      <JActions>
        {onBack && (
          <button type="button" aria-label={phone.back} onClick={onBack} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-ring:ring-2 focus-ring:ring-focus" style={{ background: 'var(--layer-inset)' }}>
            <ChevronLeftIcon className="size-5" />
          </button>
        )}
        <Button onClick={onNext}>{last ? phone.intro3.start : phone.next}</Button>
        {last && (
          <Button variant="ghost" onClick={onWhy}>
            {ext.why}
          </Button>
        )}
      </JActions>
      {/* The pages, as on the phone: the current dot longer; each one goes to its page. */}
      <div role="tablist" aria-label={phone.pageOf(page + 1, INTRO_PAGES)} className="mt-5 flex items-center gap-1">
        {Array.from({ length: INTRO_PAGES }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === page}
            aria-label={phone.pageOf(i + 1, INTRO_PAGES)}
            onClick={() => onGo(i)}
            className="flex h-6 items-center justify-center rounded-full px-1 outline-none focus-ring:ring-2 focus-ring:ring-focus"
          >
            <span className={`block h-1.5 rounded-full transition-[width,opacity] duration-150 ${i === page ? 'w-5 bg-foreground' : 'w-1.5 bg-foreground/30'}`} />
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {phone.pageOf(page + 1, INTRO_PAGES)}
      </p>
    </>
  );
}

/** "Kenapa aman?": the longer explanation, out of the page's text budget. */
export function WhyDialog({ open, onOpenChange, points, outdated, onPrivacy }: { open: boolean; onOpenChange: (v: boolean) => void; points: readonly string[]; outdated?: string; onPrivacy: () => void }) {
  const { locale } = useI18n();
  const { ext } = words(locale);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>{ext.why}</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="mt-2 space-y-2">
            {outdated && <p className="font-medium text-foreground">{outdated}</p>}
            <ul className="list-disc space-y-1 pl-5">
              {points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </AlertDialogDescription>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onPrivacy}>
            {ext.privacyLink}
          </Button>
          <AlertDialogCancel asChild>
            <Button variant="outline">{ext.close}</Button>
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------- Connect, then "Menyiapkan Sulo" bound to the real sync ----------

export type ConnectPhase = 'checking' | 'waiting' | 'need_login' | 'connected' | 'failed';

export function SceneConnect({ preparing, stages, counts }: { preparing: boolean; stages: OnboardingStages['stages']; counts: { tasks: number; courses: number } }) {
  const { locale } = useI18n();
  const { phone, ext } = words(locale);
  const size = useSceneMascotSize();
  if (preparing) {
    const results = stageResults(stages);
    return (
      <div className="flex w-full max-w-[420px] flex-col items-center gap-4">
        <MascotSlot size={160} />
        {/* Each stage that ends puts its real number out of the mascot. */}
        <div className="flex min-h-8 flex-wrap justify-center gap-2" aria-live="polite">
          {STAGE_ROWS.filter((r) => results[r] === 'ok').map((r, i) => (
            <In key={r} i={i}>
              <Chip>{r === 'tasks' ? phone.preparing.chips.tasks(counts.tasks) : r === 'courses' ? phone.preparing.chips.courses(counts.courses) : phone.preparing.chips.attendance}</Chip>
            </In>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="obj-scene">
      <In i={0} className="w-full">
        <div className="m-card rounded-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'var(--layer-inset)' }}>
            <LockIcon className="size-3.5 text-muted-foreground" />
            <span className="text-[12px] text-muted-foreground">{phone.signin.address}</span>
          </div>
          <div className="space-y-3 p-4">
            <p className="text-[16px] font-semibold">SIKOLA</p>
            {ext.scene.login.map((l) => (
              <div key={l} className="flex h-9 items-center rounded-[var(--radius-ctl)] px-3 text-[12px] text-muted-foreground" style={{ background: 'var(--layer-inset)' }}>
                {l}
              </div>
            ))}
            <div className="flex h-9 items-center justify-center rounded-full bg-foreground text-[14px] font-medium text-background">{ext.scene.loginButton}</div>
          </div>
        </div>
      </In>
      <In i={1} className="w-full">
        <ol className="m-card rounded-card divide-y divide-[var(--layer-line)] px-4">
          {ext.scene.steps.map((step, i) => (
            <li key={step} className="flex items-center gap-3 py-3 text-[14px]">
              <span className="flex size-6 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums" style={{ background: 'var(--layer-inset)' }}>
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </In>
      {ext.scene.connectNotes.map((n, i) => (
        <In key={n} i={i + 2} className="w-full" optional>
          <div className="m-card rounded-card flex items-center gap-3 px-4 py-3 text-[14px]">
            <LockIcon className="size-4 text-muted-foreground" />
            {n}
          </div>
        </In>
      ))}
      <MascotSlot size={size} />
    </div>
  );
}

export function ConnectText({ phase, preparing, stages, failedReason, switching, onOpen, onRetry }: { phase: ConnectPhase; preparing: boolean; stages: OnboardingStages['stages']; failedReason: string; switching: boolean; onOpen: () => void; onRetry: () => void }) {
  const { locale } = useI18n();
  const { phone, ext } = words(locale);
  useMascot({ state: preparing ? 'syncing' : phase === 'failed' ? 'dizzy' : phase === 'connected' ? 'all-done' : 'onboarding', look: preparing ? null : { x: 0, y: 1 } });
  if (preparing) {
    const results = stageResults(stages);
    const current = STAGE_ROWS.find((r) => results[r] === null) ?? STAGE_ROWS[STAGE_ROWS.length - 1]!;
    const done = STAGE_ROWS.filter((r) => results[r] !== null).length;
    return (
      <>
        <JTitle id="ob-title">{phone.preparing.title}</JTitle>
        <div role="progressbar" aria-label={phone.preparing.title} aria-valuemin={0} aria-valuemax={STAGE_ROWS.length} aria-valuenow={done} className="mt-6 flex gap-1.5">
          {STAGE_ROWS.map((r) => (
            <span key={r} className={`h-1.5 flex-1 rounded-full ${results[r] !== null ? 'bg-foreground' : 'bg-foreground/20'}`} />
          ))}
        </div>
        <JLine>{phone.preparing.stages[current]}</JLine>
      </>
    );
  }
  const status = phase === 'checking' ? ext.connect.checking : phase === 'waiting' ? ext.connect.waiting : phase === 'need_login' ? ext.connect.needLogin : phase === 'failed' ? failedReason : null;
  return (
    <>
      <JTitle id="ob-title">{ext.connect.title}</JTitle>
      <JLine>{switching ? ext.connect.switchBody : ext.connect.body}</JLine>
      <JActions>
        {phase === 'failed' ? (
          <Button size="lg" onClick={onRetry}>
            {phone.preparing.retry}
          </Button>
        ) : (
          <Button size="lg" onClick={onOpen}>
            {ext.connect.open}
          </Button>
        )}
      </JActions>
      {status && (
        <p role="status" className="mt-4 text-[14px] text-muted-foreground">
          {status}
        </p>
      )}
    </>
  );
}

// ---------- Courses: tinted rows with the check circle ----------

const isCurrentSemester = (c: CourseRecord) => c.inProgress || c.activeScore >= ACTIVE_THRESHOLD;

function CourseRow({ course, color, onToggle }: { course: CourseRecord; color: number; onToggle: (id: CourseId, active: boolean) => void }) {
  const on = isCourseActive(course);
  const name = courseNameWithClass(course);
  return (
    <li>
      <div
        className={`flex items-center gap-3 rounded-[var(--radius-ctl)] px-4 py-3 transition-opacity duration-150 ${on ? '' : 'opacity-55'}`}
        style={on ? { background: tintBg(courseTint(color), 18) } : { background: 'var(--layer-inset)' }}
        title={course.fullname}
      >
        <span className="min-w-0 flex-1 text-[14px] leading-5 font-medium">{name}</span>
        <CheckCircle size="sm" checked={on} onChange={(v) => onToggle(course.id, v)} label={name} />
      </div>
    </li>
  );
}

export function SceneCourses({ courses, onToggle }: { courses: CourseRecord[]; onToggle: (id: CourseId, active: boolean) => void }) {
  const { locale } = useI18n();
  const { ext } = words(locale);
  const [query, setQuery] = useState('');
  const [previousOpen, setPreviousOpen] = useState(() => courses.some((c) => !isCurrentSemester(c) && isCourseActive(c)));
  const colors = useMemo(() => assignCourseColors(courses), [courses]);
  const q = query.trim().toLowerCase();
  const matches = (c: CourseRecord) => !q || c.fullname.toLowerCase().includes(q) || courseNameWithClass(c).toLowerCase().includes(q);
  const { current, previous } = useMemo(() => {
    const byName = (a: CourseRecord, b: CourseRecord) => courseNameWithClass(a).localeCompare(courseNameWithClass(b), 'id');
    return { current: courses.filter(isCurrentSemester).sort(byName), previous: courses.filter((c) => !isCurrentSemester(c)).sort(byName) };
  }, [courses]);
  const open = previousOpen || q.length > 0;
  const row = (c: CourseRecord) => <CourseRow key={c.id} course={c} color={colors.get(c.id) ?? 1} onToggle={onToggle} />;
  return (
    <div className="obj-scene obj-scene-list m-card rounded-card">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          data-slot="input"
          className="h-10 w-full rounded-[var(--radius-ctl)] border border-transparent pr-3 pl-9 text-[14px] outline-none placeholder:text-muted-foreground focus-visible:border-focus"
          style={{ background: 'var(--layer-card)' }}
          placeholder={ext.courses.search}
          aria-label={ext.courses.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul className="grid gap-2">{current.filter(matches).map(row)}</ul>
      {previous.length > 0 && (
        <Collapsible open={open} onOpenChange={setPreviousOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 rounded-md py-1 text-[14px] font-semibold text-muted-foreground hover:text-foreground">
            {ext.courses.previous(previous.length)}
            <ChevronDownIcon className={`size-4 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 grid gap-2">{previous.filter(matches).map(row)}</ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function CoursesText({ selected, saving, onNext }: { selected: number; saving: boolean; onNext: () => void }) {
  const { locale } = useI18n();
  const { phone, ext } = words(locale);
  useMascot({ state: 'onboarding', look: { x: -1, y: 0 } });
  return (
    <>
      <MascotSlot size={88} className="mb-6" />
      <JTitle id="ob-title">{phone.courses.title}</JTitle>
      <JLine>{selected === 0 ? phone.courses.none : phone.courses.body}</JLine>
      <JActions>
        <Button size="lg" disabled={selected === 0 || saving} onClick={onNext}>
          {ext.courses.next(selected)}
        </Button>
      </JActions>
    </>
  );
}

// ---------- Done: a short celebration, two chips of real data, then Ringkasan ----------

export function SceneDone({ tasks, courses }: { tasks: number; courses: number }) {
  const { locale } = useI18n();
  const { phone, ext } = words(locale);
  return (
    <div className="flex flex-col items-center gap-5">
      <MascotSlot size={176} />
      <div className="flex flex-wrap justify-center gap-2">
        <In i={2}>
          <Chip>{tasks > 0 ? phone.done.tasks(tasks) : phone.done.empty}</Chip>
        </In>
        <In i={3}>
          <Chip>{ext.done.courses(courses)}</Chip>
        </In>
      </div>
    </div>
  );
}

export function DoneText({ onOpen }: { onOpen: () => void }) {
  const { locale } = useI18n();
  const { phone, ext } = words(locale);
  useMascot({ state: 'all-done', celebrate: 1 });
  return (
    <>
      <JTitle id="ob-title">{phone.done.title}</JTitle>
      <JLine>{ext.done.body}</JLine>
      <JActions>
        <Button size="lg" onClick={onOpen}>
          {phone.done.open}
        </Button>
      </JActions>
    </>
  );
}

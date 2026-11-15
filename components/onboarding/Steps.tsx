import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDownIcon, ExternalIcon, SearchIcon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isCourseActive } from '@/lib/courses/active-score';
import { courseNameWithClass } from '@/lib/courses/display-name';
import { id } from '@/lib/i18n/id';
import type { CourseId, CourseRecord } from '@/lib/types';
import type { MascotState } from '@/lib/view/popup-view';

const t = id.onboarding;
export const TOTAL_STEPS = 4;

export function OnboardingShell({ step, mascot, children }: { step: number; mascot: MascotState; children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="flex items-center gap-3">
          <Mascot state={mascot} size={56} />
          <div>
            <p className="text-xs text-muted-foreground">{t.stepOf(step, TOTAL_STEPS)}</p>
            <p className="font-heading text-lg">{id.appName}</p>
          </div>
        </header>
        <section className="flex-1 space-y-5">{children}</section>
        <footer className="border-t border-border pt-3 text-xs text-muted-foreground">
          {id.disclaimer}{' '}
          <a className="underline underline-offset-2 hover:text-foreground" href="/privacy.html" target="_blank" rel="noreferrer">
            {id.privacyLink}
          </a>
        </footer>
      </main>
    </TooltipProvider>
  );
}

export function StepIntro({ noticeOutdated, onContinue }: { noticeOutdated: boolean; onContinue: () => void }) {
  return (
    <>
      <h1 className="text-xl">{t.intro.title}</h1>
      {noticeOutdated && <p className="rounded-md border border-border p-3 text-sm">{t.intro.noticeUpdated}</p>}
      <p className="text-base">{t.intro.lead}</p>
      <ul className="space-y-2 text-sm">
        {t.intro.points.map((p) => (
          <li key={p} className="flex gap-2">
            <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-orange" />
            {p}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        {id.disclaimer}{' '}
        <a className="underline underline-offset-2" href="/privacy.html" target="_blank" rel="noreferrer">
          {id.privacyLink}
        </a>
      </p>
      <Button size="lg" onClick={onContinue}>
        {t.intro.ok}
      </Button>
    </>
  );
}

export type ConnectStatus = 'checking' | 'need_login' | 'waiting' | 'connected' | 'failed';

export function StepConnect(props: {
  status: ConnectStatus;
  failedReason?: string;
  onOpenSikola: () => void;
  onRetry: () => void;
}) {
  const { status } = props;
  return (
    <>
      <h1 className="text-xl">{t.connect.title}</h1>
      <p role="status" className="text-sm">
        {status === 'checking' && t.connect.checking}
        {(status === 'need_login' || status === 'waiting') && t.connect.needLogin}
        {status === 'connected' && t.connect.connected}
        {status === 'failed' && t.connect.failed(props.failedReason ?? '')}
      </p>
      {(status === 'need_login' || status === 'waiting' || status === 'failed') && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={props.onOpenSikola}>
            {t.connect.openSikola}
            <ExternalIcon className="size-4" />
          </Button>
          <Button variant="outline" onClick={props.onRetry}>
            {t.connect.retry}
          </Button>
        </div>
      )}
      {status === 'waiting' && <p className="text-xs text-muted-foreground">{t.connect.waiting}</p>}
    </>
  );
}

function reasonText(course: CourseRecord): string {
  const parts = course.activeReasons.map((r) => t.courses.reasons[r]);
  return parts.length > 0 ? parts.join(', ') : t.courses.noReason;
}

function CourseRow({ course, onToggle }: { course: CourseRecord; onToggle: (id: CourseId, active: boolean) => void }) {
  const active = isCourseActive(course);
  const switchId = `course-${course.id}`;
  return (
    <li className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
      <div className="min-w-0 flex-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <label htmlFor={switchId} className="block truncate text-sm font-medium">
              {courseNameWithClass(course)}
            </label>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">{course.fullname}</TooltipContent>
        </Tooltip>
        <p className="truncate text-xs text-muted-foreground">
          {reasonText(course)}
          {course.activePin !== null && ` · ${t.courses.pinned}`}
        </p>
      </div>
      <Switch id={switchId} checked={active} onCheckedChange={(v) => onToggle(course.id, v)} />
    </li>
  );
}

export function StepCourses(props: {
  courses: CourseRecord[];
  onToggle: (id: CourseId, active: boolean) => void;
  onReset: () => void;
  onSave: () => void;
  saving?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [othersOpen, setOthersOpen] = useState(false);
  const q = query.trim().toLowerCase();
  const matches = (c: CourseRecord) => !q || c.fullname.toLowerCase().includes(q) || courseNameWithClass(c).toLowerCase().includes(q);

  const { active, others } = useMemo(() => {
    const sorted = [...props.courses].sort((a, b) => b.activeScore - a.activeScore || a.fullname.localeCompare(b.fullname));
    return { active: sorted.filter((c) => isCourseActive(c)), others: sorted.filter((c) => !isCourseActive(c)) };
  }, [props.courses]);

  const shownActive = active.filter(matches);
  const shownOthers = others.filter(matches);
  const anyPinned = props.courses.some((c) => c.activePin !== null);

  return (
    <>
      <h1 className="text-xl">{t.courses.title}</h1>
      <p className="text-sm text-muted-foreground">{t.courses.lead}</p>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8" placeholder={t.courses.search} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t.courses.search} />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm">{t.courses.active(active.length)}</h2>
        {shownActive.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.courses.none}</p>
        ) : (
          <ul className="space-y-1.5">
            {shownActive.map((c) => (
              <CourseRow key={c.id} course={c} onToggle={props.onToggle} />
            ))}
          </ul>
        )}
      </div>

      {others.length > 0 && (
        <Collapsible open={othersOpen || q.length > 0} onOpenChange={setOthersOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md py-1 text-left text-sm font-heading">
            {t.courses.others(others.length)}
            <ChevronDownIcon className={`size-4 transition-transform ${othersOpen || q ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 space-y-1.5">
              {shownOthers.map((c) => (
                <CourseRow key={c.id} course={c} onToggle={props.onToggle} />
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={props.onSave} disabled={props.saving}>
          {t.courses.save}
        </Button>
        {anyPinned && (
          <Button variant="ghost" onClick={props.onReset}>
            {t.courses.reset}
          </Button>
        )}
      </div>
    </>
  );
}

export function StepDone({ tasks, courses, onClose }: { tasks: number; courses: number; onClose: () => void }) {
  return (
    <>
      <h1 className="text-xl">{t.done.title}</h1>
      <p className="text-base">{t.done.summary(tasks, courses)}</p>
      <p className="rounded-md border border-border p-3 text-sm">{t.done.pinHint}</p>
      <Button size="lg" onClick={onClose}>
        {t.done.close}
      </Button>
    </>
  );
}

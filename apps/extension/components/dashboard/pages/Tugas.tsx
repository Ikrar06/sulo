import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '@sulo/ui/i18n';
import { ChevronDownIcon, SearchIcon } from '@sulo/ui/icons';
import { Checkbox } from '@sulo/ui/ui/checkbox';
import { Input } from '@sulo/ui/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@sulo/ui/ui/select';
import { activeCourseIds } from '@sulo/core/courses/active-score';
import { courseAlias } from '@sulo/core/courses/display-name';
import { buildTaskItems, countByStatus, DEFAULT_TASK_FILTER, filterTasks, type TaskFilter, type TaskItem, type TaskStatusFilter } from '@sulo/core/dashboard/tasks';
import { countdownLabel } from '@sulo/core/format/countdown';
import { taskDueLines } from '@sulo/core/format/time';
import { googleCalendarUrl } from '@sulo/core/format/gcal';
import { addStep, removeStep, setCustomDue, setNote, setSnooze, toggleStep } from '@sulo/core/tasks/local-state';
import { urgencyOf } from '@sulo/core/tasks/group';
import { local, timeZone } from '../data';
import { useDoneUndo } from '@sulo/ui/dashboard/done-undo';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { TaskDetails } from '@sulo/ui/dashboard/TaskDetails';
import type { PageProps } from '../types';

const STATUS_FILTERS: readonly TaskStatusFilter[] = ['pending', 'done', 'submitted', 'inactive', 'all'];

const URGENCY_TEXT = { overdue: 'text-urgency-overdue', day: 'text-urgency-soon', threeDays: 'text-urgency-week', normal: 'text-muted-foreground' } as const;

export function TugasPage({ d, data, actions, route }: PageProps) {
  const { m } = useI18n();
  const t = d.tugas;
  const user = data.user!;
  const items = useMemo(() => buildTaskItems(user), [user]);
  const counts = useMemo(() => countByStatus(items), [items]);
  const [filter, setFilter] = useState<TaskFilter>(DEFAULT_TASK_FILTER);
  const linked = route.detail !== null ? Number(route.detail) : null;
  const [open, setOpen] = useState<number | null>(linked);

  // #tugas/<eventId>: show that task whatever its status, opened and in view.
  useEffect(() => {
    if (linked === null) return;
    setFilter({ ...DEFAULT_TASK_FILTER, status: 'all' });
    setOpen(linked);
    window.requestAnimationFrame(() => document.getElementById(`task-${linked}`)?.scrollIntoView({ block: 'center' }));
  }, [linked]);

  const done = useDoneUndo(actions, d, data.today, local);
  // Rows just marked done stay in place for the undo window, whatever the filter.
  const passes = (i: TaskItem) => filter.status === 'all' || i.status === filter.status;
  const shown = filterTasks(items, { ...filter, status: 'all' }).filter((i) => passes(i) || done.lingering.has(i.task.eventId));
  const allClear = filter.status === 'pending' && counts.pending === 0 && filter.courseId === null && filter.query.trim() === '';
  const active = activeCourseIds(user.courses);
  const courses = user.courses.filter((c) => active.has(c.id)).sort((a, b) => courseAlias(a).localeCompare(courseAlias(b), 'id'));
  const state = (fn: Parameters<typeof actions.updateUser<'taskState'>>[1]) => void actions.updateUser('taskState', fn);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" className="pl-8" placeholder={t.search} aria-label={t.search} value={filter.query} onChange={(e) => setFilter({ ...filter, query: e.target.value })} />
        </div>
        <Select value={filter.courseId === null ? 'all' : String(filter.courseId)} onValueChange={(v) => setFilter({ ...filter, courseId: v === 'all' ? null : Number(v) })}>
          <SelectTrigger className="w-56" aria-label={t.course}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allCourses}</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {courseAlias(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v as TaskStatusFilter })}>
          <SelectTrigger className="w-60" aria-label={t.status}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {t.statuses[s]}
                {s !== 'all' ? ` (${counts[s]})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-[12px] text-muted-foreground" role="status">
        {t.count(shown.length)}
      </p>

      {shown.length === 0 ? (
        allClear ? (
          // The list just emptied: celebrate once, then the happy idle mascot (the only one on this page).
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-5 py-8 text-center">
            <Mascot state={done.justCleared ? 'celebrate' : 'all-done'} size={56} />
            <p className="text-[14px] text-muted-foreground">{t.allClear}</p>
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-[14px] text-muted-foreground">{t.empty}</p>
        )
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {shown.map((item) => (
            <TaskRowItem
              key={item.task.eventId}
              item={item}
              expanded={open === item.task.eventId}
              onToggleOpen={() => setOpen(open === item.task.eventId ? null : item.task.eventId)}
              onDone={(checked) => (checked ? done.mark(item.task.eventId, filter.status === 'pending' && counts.pending === 1) : done.unmark(item.task.eventId))}
              collapsing={done.collapsing.has(item.task.eventId)}
              d={d}
              now={data.now}
              dueFormat={data.prefs.dueFormat}
              details={
                <TaskDetails
                  item={item}
                  d={d}
                  now={data.now}
                  timeZone={timeZone}
                  snoozeMorningMin={data.prefs.reminders.snoozeMorningMin}
                  actions={{
                    onOpen: actions.openTab,
                    onAddToCalendar: (i) =>
                      i.task.dueAt !== null &&
                      actions.openTab(googleCalendarUrl({ title: `${i.task.name} (${i.courseName})`, dueAt: i.task.dueAt, details: m.popup.row.calendarDetails(i.courseName, i.task.url) })),
                    onSnooze: (until) => state((s) => setSnooze(s, item.task.eventId, until)),
                    onCustomDue: (at) => state((s) => setCustomDue(s, item.task.eventId, at)),
                    onAddStep: (text) => state((s) => addStep(s, item.task.eventId, text, crypto.randomUUID())),
                    onToggleStep: (id) => state((s) => toggleStep(s, item.task.eventId, id)),
                    onRemoveStep: (id) => state((s) => removeStep(s, item.task.eventId, id)),
                    onNote: (note) => state((s) => setNote(s, item.task.eventId, note)),
                  }}
                />
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRowItem({ item, expanded, onToggleOpen, onDone, d, now, dueFormat, details, collapsing = false }: { item: TaskItem; expanded: boolean; onToggleOpen: () => void; onDone: (done: boolean) => void; d: PageProps['d']; now: number; dueFormat: PageProps['data']['prefs']['dueFormat']; details: ReactNode; collapsing?: boolean }) {
  const { m, locale } = useI18n();
  const t = d.tugas;
  const due = item.task.dueAt;
  const urgency = item.status === 'pending' ? urgencyOf(due, now) : 'normal';
  const steps = item.state.steps;
  const panelId = `task-panel-${item.task.eventId}`;
  return (
    <li id={`task-${item.task.eventId}`} className={collapsing ? 'db-collapse' : undefined}>
      <div className="flex items-start gap-3 px-4 py-3">
        <Checkbox className="mt-1" checked={item.status === 'done'} onCheckedChange={(v) => onDone(v === true)} aria-label={item.status === 'done' ? t.markUndone : t.markDone} />
        <button type="button" className="min-w-0 flex-1 rounded-md text-left outline-none focus-ring:ring-2 focus-ring:ring-focus" aria-expanded={expanded} aria-controls={panelId} onClick={onToggleOpen}>
          <span className={`block text-[14px] leading-6 ${item.status === 'done' ? 'text-muted-foreground line-through' : 'font-semibold'}`}>{item.task.name}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-normal text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: `var(--course-${item.courseColor})` }} />
              {item.courseName}
            </span>
            {item.status !== 'pending' && <span>{t.statuses[item.status]}</span>}
            {item.personalDue && <span className="rounded border border-border px-1 text-[12px]">{t.personalDue}</span>}
            {steps.length > 0 && <span className="tabular-nums">{t.stepsDone(steps.filter((s) => s.done).length, steps.length)}</span>}
          </span>
        </button>
        <span className="shrink-0 text-right text-[14px] leading-6 tabular-nums">
          {due === null ? (
            <span className="text-muted-foreground">{t.noDue}</span>
          ) : (
            <DueLines lines={taskDueLines(due, now, timeZone, m, locale, dueFormat)} tone={URGENCY_TEXT[urgency]} tickAt={dueFormat === 'countdown' && due >= now ? due : null} label={countdownLabel((due - now) * 1000, locale)} />
          )}
        </span>
        <button type="button" className="mt-1 rounded-md p-1 text-muted-foreground outline-none hover:bg-muted focus-ring:ring-2 focus-ring:ring-focus" aria-label={t.details} aria-expanded={expanded} aria-controls={panelId} onClick={onToggleOpen}>
          <ChevronDownIcon className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {expanded && <div id={panelId}>{details}</div>}
    </li>
  );
}

/** Time left on top (urgency color), the full date below; one line in the "due time" mode. */
function DueLines({ lines, tone, tickAt = null, label = null }: { lines: { primary: string; secondary: string | null }; tone: string; tickAt?: number | null; label?: string | null }) {
  return (
    <>
      {/* In countdown mode the shared ticker (App) rewrites this text each second; the label only changes per minute. */}
      <span className={`block tabular-nums ${lines.secondary === null ? '' : tone}`} data-due-at={tickAt ?? undefined} aria-label={tickAt !== null ? (label ?? undefined) : undefined}>
        {lines.primary}
      </span>
      {lines.secondary !== null && <span className="block text-[12px] leading-normal text-muted-foreground">{lines.secondary}</span>}
    </>
  );
}

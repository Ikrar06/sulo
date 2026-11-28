import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '@sulo/ui/i18n';
import { ChevronDownIcon, SearchIcon } from '@sulo/ui/icons';
import { Input } from '@sulo/ui/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@sulo/ui/ui/select';
import { activeCourseIds } from '@sulo/core/courses/active-score';
import { courseAlias } from '@sulo/core/courses/display-name';
import { buildTaskItems, countByStatus, DEFAULT_TASK_FILTER, filterTasks, isFinishedItem, isHistoryStatus, matchesStatus, type TaskFilter, type TaskItem, type TaskStatusFilter } from '@sulo/core/dashboard/tasks';
import { countdownLabel } from '@sulo/core/format/countdown';
import { formatShortDate, taskDueLines } from '@sulo/core/format/time';
import { taskCalendarUrl } from '@sulo/core/format/gcal';
import { taskEvent, taskIcs, taskIcsName } from '@sulo/core/format/task-event';
import { addStep, removeStep, setCustomDue, setNote, setSnooze, toggleStep } from '@sulo/core/tasks/local-state';
import { addOwnTask, isOwnTask, removeOwnTask, updateOwnTask, type OwnTask } from '@sulo/core/tasks/own';
import { Button } from '@sulo/ui/ui/button';
import { EyeIcon, EyeOffIcon, PlusIcon } from '@sulo/ui/dashboard-icons';
import { OwnTaskDialog } from '../OwnTaskDialog';
import { HeaderTools } from '../header-tools';
import type { TaskGradeOutcome } from '@sulo/core/tasks/grade-service';
import { gradeBadge, showsGradeCard, type GradeBadge } from '@sulo/core/tasks/grade-view';
import type { SweepResult } from '@sulo/core/tasks/grade-sweep';
import type { CourseGradeOutcome } from '@sulo/core/tasks/grade-service';
import { urgencyOf } from '@sulo/core/tasks/group';
import { local, timeZone } from '../data';
import { useDoneUndo } from '@sulo/ui/dashboard/done-undo';
import { SuloMascot } from '@sulo/ui/mascot/SuloMascot';
import { TaskDetails } from '@sulo/ui/dashboard/TaskDetails';
import { Chip } from '@sulo/ui/mobile/cards';
import { courseTint } from '@sulo/ui/mobile/tint';
import { URGENCY_TEXT } from '@sulo/ui/urgency';
import { CalendarHoverButton, FADES_FOR_CALENDAR } from '../CalendarHoverButton';
import { CheckCircle } from '@sulo/ui/mobile/controls';
import { FitLine } from '@sulo/ui/mobile/fit-line';
import { useFlip } from '@/lib/ui/flip';
import type { PageProps } from '../types';

// "Belum selesai" first and by default; "Sudah dinilai" next, then the finished kinds (1.1.0): one list, newest
// first (the course filter narrows it, with "Lihat nilai" for that course). Opening the page reads every followed course's
// grade report not read in the last hour (tasks/grade-sweep.ts, owner's exception of 27 Nov 2026); a read grade takes the
// due time's place on the right, its number shown only with "Tampilkan nilai" (prefs.gradesShown, off by default).
const STATUS_FILTERS: readonly TaskStatusFilter[] = ['pending', 'graded', 'done', 'submitted', 'past', 'inactive', 'all'];


export function TugasPage({ d, data, actions, route }: PageProps) {
  const { m } = useI18n();
  const t = d.tugas;
  const user = data.user!;
  const items = useMemo(() => buildTaskItems(user, t.own), [user, t.own]);
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
  const passes = (i: TaskItem) => matchesStatus(i, filter.status);
  const shown = filterTasks(items, { ...filter, status: 'all' }).filter((i) => passes(i) || done.lingering.has(i.task.eventId));
  const allClear = filter.status === 'pending' && counts.pending === 0 && filter.courseId === null && filter.query.trim() === '';
  const active = activeCourseIds(user.courses);
  const courses = user.courses.filter((c) => active.has(c.id)).sort((a, b) => courseAlias(a).localeCompare(courseAlias(b), 'id'));
  const state = (fn: Parameters<typeof actions.updateUser<'taskState'>>[1]) => void actions.updateUser('taskState', fn);
  // "Kalender lain (.ics)": the task as one event in a file the laptop's calendar app opens (Mac Calendar, Outlook),
  // the same event as Google's link (core task-event.ts). Made here and saved by the browser; nothing is sent.
  const downloadIcs = (i: TaskItem, dueAt: number) => {
    const input = { name: i.task.name, courseName: i.courseName, dueAt, url: i.task.url };
    const ics = taskIcs(taskEvent(input, m.popup.row.calendarDetails), `tugas-${i.task.eventId}@sulo`, data.now);
    const href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = taskIcsName(i.task);
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };
  const listRef = useRef<HTMLUListElement>(null);
  useFlip(listRef);
  const history = isHistoryStatus(filter.status);
  const view = { gradesShown: data.prefs.gradesShown, privacyMode: data.prefs.privacyMode };
  const anyGrade = shown.some((i) => i.gradeRead !== null);
  // History newest first.
  const listed = history ? [...shown].sort((a, b) => (b.task.dueAt ?? 0) - (a.task.dueAt ?? 0)) : shown;
  // Opening Tugas checks a few courses' grades (not read in a day); what it marks done is said once.
  const [swept, setSwept] = useState(0);
  useEffect(() => {
    let live = true;
    void actions.send({ type: 'grades/sweep' }).then((r) => {
      if (live) setSwept((r as SweepResult | null)?.markedDone ?? 0);
    });
    return () => {
      live = false;
    };
    // Once per opening of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sweepLine = swept > 0 ? t.gradesSwept(swept) : null;
  // "Lihat nilai" for the course picked in the filter: busy while its page loads, then one line.
  const [courseRead, setCourseRead] = useState<Record<number, { busy: boolean; line: string | null }>>({});
  const readCourse = async (courseId: number) => {
    setCourseRead((s) => ({ ...s, [courseId]: { busy: true, line: s[courseId]?.line ?? null } }));
    const o = ((await actions.send({ type: 'course/grades', courseId, again: true })) as CourseGradeOutcome | null) ?? { status: 'failed' as const, reason: 'NO_ANSWER' };
    const line =
      o.status === 'ok'
        ? t.courseGradesResult(o.graded, o.markedDone.length)
        : o.status === 'cooldown'
          ? t.gradeWait
          : o.status === 'failed' && o.reason === 'REPORT_UNREADABLE'
            ? t.gradeReportUnreadable
            : o.status === 'failed' && (o.reason === 'SESSION_EXPIRED' || o.reason === 'login_required')
              ? t.gradeExpired
              : t.gradeFailed;
    setCourseRead((s) => ({ ...s, [courseId]: { busy: false, line } }));
  };
  const picked = filter.courseId !== null ? courseRead[filter.courseId] : undefined;
  // "Tambah tugas" and "Ubah tugas" (tasks/own.ts): null closed, 'new' adding, a task changing it.
  const [form, setForm] = useState<OwnTask | 'new' | null>(null);
  const editing = form !== null && form !== 'new' ? form : null;

  return (
    <div className="space-y-4">
      {/* An action, so it sits in the header with the other pill buttons; the row below is only filters. */}
      <HeaderTools>
        <Button variant="outline" onClick={() => setForm('new')}>
          <PlusIcon className="size-4" />
          {t.ownAdd}
        </Button>
      </HeaderTools>
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
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-muted-foreground" role="status">
          {t.count(shown.length)}
          {history && anyGrade && !view.gradesShown ? ` · ${t.gradesHidden}` : ''}
          {picked && picked.busy ? ` · ${t.gradeLoading}` : picked?.line ? ` · ${picked.line}` : ''}
          {sweepLine ? ` · ${sweepLine}` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {/* A course picked in the finished lists: its grades now (one page for all its tasks). */}
          {history && filter.courseId !== null && (
            <Button variant="outline" disabled={picked?.busy} onClick={() => void readCourse(filter.courseId!)}>
              {t.gradeSee}
            </Button>
          )}
          {history && anyGrade && (
            <Button variant="outline" onClick={() => void actions.setPrefs({ gradesShown: !view.gradesShown })}>
              {view.gradesShown ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              {view.gradesShown ? t.gradesHide : t.gradesShow}
            </Button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        allClear ? (
          // The list just emptied: celebrate once, then the happy idle mascot (the only one on this page).
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-5 py-8 text-center">
            <SuloMascot mood="happy" size={56} reaction={done.justCleared ? { name: 'allClear', key: 1 } : null} />
            <p className="text-[14px] text-muted-foreground">{t.allClear}</p>
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-[14px] text-muted-foreground">{t.empty}</p>
        )
      ) : (
        <ul ref={listRef} className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {listed.map((item) => (
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
              onOpenTab={actions.openTab}
              grade={gradeBadge(item.gradeRead, view, m.intl)}
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
                      actions.openTab(taskCalendarUrl({ name: i.task.name, courseName: i.courseName, dueAt: i.task.dueAt, url: i.task.url }, m.popup.row.calendarDetails)),
                    onAddToCalendarFile: (i) => i.task.dueAt !== null && downloadIcs(i, i.task.dueAt),
                    onSnooze: (until) => state((s) => setSnooze(s, item.task.eventId, until)),
                    onCustomDue: (at) => state((s) => setCustomDue(s, item.task.eventId, at)),
                    onAddStep: (text) => state((s) => addStep(s, item.task.eventId, text, crypto.randomUUID())),
                    onToggleStep: (id) => state((s) => toggleStep(s, item.task.eventId, id)),
                    onRemoveStep: (id) => state((s) => removeStep(s, item.task.eventId, id)),
                    onNote: (note) => state((s) => setNote(s, item.task.eventId, note)),
                    ...(isOwnTask(item.task) ? { onEditOwn: () => setForm(user.ownTasks.find((o) => o.id === item.task.eventId) ?? null) } : {}),
                    // "Lihat nilai", for an assignment past due, handed in or done: the service worker reads its page.
                    ...(showsGradeCard(item.task, item.status === 'done', data.now)
                      ? { onGrade: async (cmid: number, again: boolean) => ((await actions.send({ type: 'task/grade', cmid, again })) as TaskGradeOutcome | null) ?? { status: 'failed' as const, reason: 'NO_ANSWER' } }
                      : {}),
                  }}
                />
              }
            />
          ))}
        </ul>
      )}
      <OwnTaskDialog
        open={form !== null}
        onOpenChange={(o) => !o && setForm(null)}
        editing={editing}
        courses={user.courses}
        t={t}
        cancelLabel={d.common.cancel}
        onSave={(input) => {
          void actions.updateUser('ownTasks', (list) => (editing ? updateOwnTask(list, editing.id, input) : addOwnTask(list, input, data.now)));
          setForm(null);
        }}
        onRemove={
          editing
            ? () => {
                // The task, then its steps and note.
                void actions.updateUser('ownTasks', (list) => removeOwnTask(list, editing.id)).then(() =>
                  actions.updateUser('taskState', (map) => Object.fromEntries(Object.entries(map).filter(([key]) => key !== String(editing.id)))),
                );
                setForm(null);
              }
            : undefined
        }
      />
    </div>
  );
}

/** A read grade on the right of a row, as tall as the due time's first line; "Dinilai" while hidden, a mask in privacy mode. */
function RowGrade({ grade, t }: { grade: GradeBadge; t: PageProps['d']['tugas'] }) {
  const text = grade.kind === 'value' ? grade.text : grade.kind === 'masked' ? '•••' : t.gradedBadge;
  return (
    <span role="img" aria-label={grade.kind === 'value' ? t.gradeValueLabel(grade.text) : t.gradedBadge} className={`inline-flex h-6 items-center rounded-full bg-muted px-2 whitespace-nowrap select-none ${grade.kind === 'value' ? 'text-[14px] font-semibold text-foreground' : 'text-[12px] font-medium text-muted-foreground'} ${grade.kind === 'masked' ? 'tracking-widest' : ''}`}>
      {text}
    </span>
  );
}

function TaskRowItem({ item, expanded, onToggleOpen, onDone, d, now, dueFormat, onOpenTab, details, collapsing = false, grade = null }: { item: TaskItem; expanded: boolean; onToggleOpen: () => void; onDone: (done: boolean) => void; d: PageProps['d']; now: number; dueFormat: PageProps['data']['prefs']['dueFormat']; onOpenTab: (url: string) => void; details: ReactNode; collapsing?: boolean; grade?: GradeBadge | null }) {
  const { m, locale } = useI18n();
  const t = d.tugas;
  const due = item.task.dueAt;
  // A finished task (done, handed in, long past or graded) has no time left to count: its date, quiet.
  const finished = isFinishedItem(item);
  const urgency = item.status === 'pending' ? urgencyOf(due, now) : 'normal';
  const steps = item.state.steps;
  const panelId = `task-panel-${item.task.eventId}`;
  return (
    <li id={`task-${item.task.eventId}`} data-flip-key={item.task.eventId} className={collapsing ? 'db-collapse' : undefined}>
      {/* The hover and focus fill (skin.css .row-hover): 10 past the content left and right, 6 above and below. */}
      <div className="row-hover group relative flex items-start gap-3 px-4 py-3" style={{ ['--rh-x' as string]: '6px', ['--rh-y' as string]: '6px' }}>
        <span className="mt-px flex">
          <CheckCircle size="sm" checked={item.status === 'done'} onChange={onDone} label={`${item.status === 'done' ? t.markUndone : t.markDone}: ${item.task.name}`} />
        </span>
        <button type="button" className="row-main min-w-0 flex-1 text-left outline-none" aria-expanded={expanded} aria-controls={panelId} onClick={onToggleOpen}>
          <span className={`block text-[14px] leading-6 ${item.status === 'done' ? 'text-muted-foreground line-through' : 'font-semibold'}`}>{item.task.name}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-normal text-muted-foreground">
            <span className="inline-flex min-w-0 text-foreground">
              <Chip small color={courseTint(item.courseColor)}>
                {item.courseName}
              </Chip>
            </span>
            {item.status !== 'pending' && <span>{t.statuses[item.status]}</span>}
            {item.personalDue && <span className="rounded border border-border px-1 text-[12px]">{t.personalDue}</span>}
            {steps.length > 0 && <span className="tabular-nums">{t.stepsDone(steps.filter((s) => s.done).length, steps.length)}</span>}
          </span>
        </button>
        <span className="relative min-w-7 shrink-0 text-right text-[14px] leading-6 tabular-nums">
          {grade ? (
            <>
              <RowGrade grade={grade} t={t} />
              {due !== null && <span className="block text-[12px] leading-normal text-muted-foreground">{formatShortDate(due, timeZone, m)}</span>}
            </>
          ) : due === null ? (
            <span className="text-muted-foreground">{t.noDue}</span>
          ) : finished ? (
            <span className="text-muted-foreground">{formatShortDate(due, timeZone, m)}</span>
          ) : (
            <>
              <span className={`block ${FADES_FOR_CALENDAR}`}>
                <DueLines lines={taskDueLines(due, now, timeZone, m, locale, dueFormat)} tone={URGENCY_TEXT[urgency]} tickAt={dueFormat === 'countdown' && due >= now ? due : null} label={countdownLabel((due - now) * 1000, locale)} />
              </span>

            </>
          )}
        </span>
        {/* Over the due time, centred on the row, 8 px left of the details chevron. */}
        {due !== null && !finished && (
          <span className="absolute top-1/2 right-[52px] -translate-y-1/2">
            <CalendarHoverButton name={item.task.name} courseName={item.courseName} dueAt={due} url={item.task.url} onOpen={onOpenTab} />
          </span>
        )}
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
      <FitLine size="text-m15" text={lines.primary} className={`tabular-nums ${lines.secondary === null ? '' : tone}`}>
        <span data-due-at={tickAt ?? undefined} aria-label={tickAt !== null ? (label ?? undefined) : undefined}>
          {lines.primary}
        </span>
      </FitLine>
      {lines.secondary !== null && <span className="block text-[12px] leading-normal text-muted-foreground">{lines.secondary}</span>}
    </>
  );
}

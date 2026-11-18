// Tugas: every task in the overview's groups (core groupTaskList), with
// Belum selesai / Selesai and a search. Tapping a task opens its details on
// a full screen; marking one done keeps it in place with "Urungkan" for 5
// seconds (core done-undo, shared hook), then it slides away.

import { useMemo, useState } from 'react';
import { groupTaskList } from '@sulo/core/dashboard/overview';
import { buildTaskItems, countByStatus, DEFAULT_TASK_FILTER, filterTasks, type TaskItem } from '@sulo/core/dashboard/tasks';
import { googleCalendarUrl } from '@sulo/core/format/gcal';
import { taskDueLines } from '@sulo/core/format/time';
import { mobileDash } from '@sulo/core/i18n/mobile';
import { urgencyOf } from '@sulo/core/tasks/group';
import { addStep, removeStep, setCustomDue, setNote, setSnooze, toggleStep } from '@sulo/core/tasks/local-state';
import { useDoneUndo } from '@sulo/ui/dashboard/done-undo';
import { TaskDetails } from '@sulo/ui/dashboard/TaskDetails';
import { useI18n } from '@sulo/ui/i18n';
import { SearchIcon } from '@sulo/ui/icons';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { Checkbox } from '@sulo/ui/ui/checkbox';
import { Input } from '@sulo/ui/ui/input';
import { timeZone, useMobileData } from '../shell/data';
import type { Screen } from '../shell/nav';
import { LongList } from './LongList';
import { chip } from './ui';

const URGENCY_TEXT = { overdue: 'text-urgency-overdue', day: 'text-urgency-soon', threeDays: 'text-urgency-week', normal: 'text-muted-foreground' } as const;

type Status = 'pending' | 'done';
type Row = { kind: 'head'; key: string; label: string } | { kind: 'task'; item: TaskItem };

export function TugasScreen({ go }: { go: (s: Screen) => void }) {
  const { m, locale } = useI18n();
  const d = mobileDash(locale);
  const t = d.tugas;
  const { data, actions, platform } = useMobileData();
  const user = data!.user!;
  const now = data!.now;
  const items = useMemo(() => buildTaskItems(user), [user]);
  const counts = useMemo(() => countByStatus(items), [items]);
  const [status, setStatus] = useState<Status>('pending');
  const [query, setQuery] = useState('');
  const done = useDoneUndo(actions, d, data!.today, platform.store);

  const rows = useMemo<Row[]>(() => {
    // Rows just marked done stay in place for the undo window.
    const matching = filterTasks(items, { ...DEFAULT_TASK_FILTER, status: 'all', query }).filter((i) => i.status === status || done.lingering.has(i.task.eventId));
    if (status === 'done') return matching.map((item) => ({ kind: 'task', item }));
    const groups = groupTaskList(matching.map((i) => ({ ...i, dueAt: i.task.dueAt })), now, timeZone);
    return groups.flatMap((g): Row[] => [{ kind: 'head', key: `h-${g.key}`, label: d.ringkasan.groups[g.key] }, ...g.rows.map((item) => ({ kind: 'task' as const, item }))]);
  }, [items, query, status, done.lingering, now, d]);
  const taskCount = rows.filter((r) => r.kind === 'task').length;
  const allClear = status === 'pending' && counts.pending === 0 && query.trim() === '';

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" className="pl-8" placeholder={t.search} aria-label={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="flex gap-2" role="group" aria-label={t.status}>
        {(['pending', 'done'] as const).map((s) => (
          <button key={s} type="button" aria-pressed={status === s} className={chip(status === s)} onClick={() => setStatus(s)}>
            {t.statuses[s]} ({counts[s]})
          </button>
        ))}
      </div>
      <p className="text-[12px] text-muted-foreground" role="status">
        {t.count(taskCount)}
      </p>
      {taskCount === 0 ? (
        allClear ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-5 py-8 text-center">
            <Mascot state={done.justCleared ? 'celebrate' : 'all-done'} size={56} />
            <p className="text-[14px] text-muted-foreground">{t.allClear}</p>
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-[14px] text-muted-foreground">{t.empty}</p>
        )
      ) : (
        <LongList
          items={rows}
          keyOf={(r) => (r.kind === 'head' ? r.key : r.item.task.eventId)}
          className="overflow-hidden rounded-xl border border-border bg-surface"
          render={(r) =>
            r.kind === 'head' ? (
              <h3 className="border-b border-border px-4 pt-3 pb-1 text-[12px] font-semibold text-muted-foreground">{r.label}</h3>
            ) : (
              <div className={`flex items-center gap-1 border-b border-border pr-3 ${done.collapsing.has(r.item.task.eventId) ? 'db-collapse' : ''}`}>
                <span className="flex size-12 shrink-0 items-center justify-center">
                  <Checkbox
                    checked={r.item.status === 'done'}
                    onCheckedChange={(v) => (v === true ? done.mark(r.item.task.eventId, status === 'pending' && counts.pending === 1) : done.unmark(r.item.task.eventId))}
                    aria-label={`${r.item.status === 'done' ? t.markUndone : t.markDone}: ${r.item.task.name}`}
                  />
                </span>
                <button type="button" onClick={() => go({ name: 'tugas', detail: String(r.item.task.eventId) })} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 text-left outline-none focus-ring:ring-2 focus-ring:ring-focus">
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[14px] leading-5 ${r.item.status === 'done' ? 'text-muted-foreground line-through' : 'font-semibold'}`}>{r.item.task.name}</span>
                    <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: `var(--course-${r.item.courseColor})` }} />
                      <span className="truncate">{r.item.courseName}</span>
                    </span>
                  </span>
                  <Due item={r.item} now={now} dueFormat={data!.prefs.dueFormat} noDue={t.noDue} m={m} locale={locale} />
                </button>
              </div>
            )
          }
        />
      )}
    </div>
  );
}

function Due({ item, now, dueFormat, noDue, m, locale }: { item: TaskItem; now: number; dueFormat: Parameters<typeof taskDueLines>[5]; noDue: string; m: ReturnType<typeof useI18n>['m']; locale: 'id' | 'en' }) {
  const due = item.task.dueAt;
  if (due === null) return <span className="shrink-0 text-[12px] text-muted-foreground">{noDue}</span>;
  const lines = taskDueLines(due, now, timeZone, m, locale, dueFormat);
  const tone = URGENCY_TEXT[item.status === 'pending' ? urgencyOf(due, now) : 'normal'];
  return (
    <span className="shrink-0 text-right text-[12px] leading-5 tabular-nums">
      <span className={`block ${lines.secondary === null ? '' : tone}`}>{lines.primary}</span>
      {lines.secondary !== null && <span className="block text-muted-foreground">{lines.secondary}</span>}
    </span>
  );
}

/** One task on a full screen: done with undo, due date, then the shared details (steps, note, snooze, SIKOLA, Google Calendar). */
export function TaskScreen({ eventId }: { eventId: number }) {
  const { m, locale } = useI18n();
  const d = mobileDash(locale);
  const t = d.tugas;
  const { data, actions, platform } = useMobileData();
  const item = useMemo(() => buildTaskItems(data!.user!).find((i) => i.task.eventId === eventId) ?? null, [data, eventId]);
  const done = useDoneUndo(actions, d, data!.today, platform.store);
  if (!item) return <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-[14px] text-muted-foreground">{t.empty}</p>;
  const state = (fn: Parameters<typeof actions.updateUser<'taskState'>>[1]) => void actions.updateUser('taskState', fn);
  const due = item.task.dueAt;
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-surface p-4">
        <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span aria-hidden="true" className="size-2 rounded-full" style={{ background: `var(--course-${item.courseColor})` }} />
          {item.courseName}
        </p>
        <h2 className={`mt-1 text-[20px] leading-7 font-semibold ${item.status === 'done' ? 'text-muted-foreground line-through' : ''}`}>{item.task.name}</h2>
        <p className="mt-1 text-[14px] tabular-nums">{due === null ? t.noDue : taskDueLines(due, data!.now, timeZone, m, locale, 'both').primary}</p>
        {due !== null && <p className="text-[12px] text-muted-foreground tabular-nums">{taskDueLines(due, data!.now, timeZone, m, locale, 'both').secondary}</p>}
        <label className="mt-3 flex min-h-11 items-center gap-3 text-[16px]">
          <Checkbox checked={item.status === 'done'} onCheckedChange={(v) => (v === true ? done.mark(item.task.eventId) : done.unmark(item.task.eventId))} />
          {t.markDone}
        </label>
      </section>
      <section className="m-touch overflow-hidden rounded-xl border border-border bg-surface">
        <TaskDetails
          item={item}
          d={d}
          now={data!.now}
          timeZone={timeZone}
          snoozeMorningMin={data!.prefs.reminders.snoozeMorningMin}
          inset={false}
          actions={{
            onOpen: actions.openExternal,
            onAddToCalendar: (i) => i.task.dueAt !== null && actions.openExternal(googleCalendarUrl({ title: `${i.task.name} (${i.courseName})`, dueAt: i.task.dueAt, details: m.popup.row.calendarDetails(i.courseName, i.task.url) })),
            onSnooze: (until) => state((s) => setSnooze(s, item.task.eventId, until)),
            onCustomDue: (at) => state((s) => setCustomDue(s, item.task.eventId, at)),
            onAddStep: (text) => state((s) => addStep(s, item.task.eventId, text, crypto.randomUUID())),
            onToggleStep: (id) => state((s) => toggleStep(s, item.task.eventId, id)),
            onRemoveStep: (id) => state((s) => removeStep(s, item.task.eventId, id)),
            onNote: (note) => state((s) => setNote(s, item.task.eventId, note)),
          }}
        />
      </section>
    </div>
  );
}

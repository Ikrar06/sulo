import { useId, useState } from 'react';
import { useI18n } from '../i18n';
import { CalendarPlusIcon, ExternalIcon } from '../icons';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { TaskItem } from '@sulo/core/dashboard/tasks';
import { formatClock, formatDue } from '@sulo/core/format/time';
import type { DashMessages } from '@sulo/core/i18n/dashboard';
import { addDays, localParts, zonedToUnix } from '@sulo/core/reminders/zoned';
import { STEP_MAX } from '@sulo/core/tasks/local-state';
import type { UnixSeconds } from '@sulo/core/types';
import { PencilIcon, PlusIcon, XIcon } from '../dashboard-icons';
import { isOwnTask } from '@sulo/core/tasks/own';
import { formatAgo } from '@sulo/core/format/time';
import type { TaskGradeOutcome } from '@sulo/core/tasks/grade-service';
import { gradeLine, showsGradeCard } from '@sulo/core/tasks/grade-view';
import { Private } from '../private';
import { useTaskGrade } from './task-grade';

export interface TaskDetailActions {
  onOpen: (url: string) => void;
  onAddToCalendar: (item: TaskItem) => void;
  onSnooze: (until: UnixSeconds | null) => void;
  onCustomDue: (at: UnixSeconds | null) => void;
  onAddStep: (text: string) => void;
  onToggleStep: (stepId: string) => void;
  onRemoveStep: (stepId: string) => void;
  onNote: (note: string) => void;
  /** A task the student added (tasks/own.ts): its form, in place of SIKOLA's page. */
  onEditOwn?: () => void;
  /** "Lihat nilai" (tasks/grade-service.ts): one read of the assignment page, only when asked. */
  onGrade?: (cmid: number, again: boolean) => Promise<TaskGradeOutcome>;
}

// Every control in the action row is 36 px high.
const action =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-[14px] outline-none hover:bg-muted focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-offset-2 focus-ring:ring-offset-background';

/**
 * One column: what the user keeps about the task (personal due date, steps,
 * note), then one row of actions. Everything here lives only in this browser.
 */
/** inset: lined up under a list row's title (the dashboard); the Android app shows the details on their own screen. */
export function TaskDetails({ item, d, now, timeZone, snoozeMorningMin, actions, inset = true }: { item: TaskItem; d: DashMessages; now: UnixSeconds; timeZone: string; snoozeMorningMin: number; actions: TaskDetailActions; inset?: boolean }) {
  const { m, locale } = useI18n();
  const t = d.tugas;
  const ids = { due: useId(), note: useId() };
  const [step, setStep] = useState('');
  const [note, setNote] = useState(item.state.note);
  const [noteSaved, setNoteSaved] = useState(false);
  const own = isOwnTask(item.task);
  const undated = !own && (item.task.dueAt === null || item.personalDue);
  const current = item.personalDue && item.task.dueAt !== null ? localParts(item.task.dueAt, timeZone) : null;
  const [due, setDue] = useState(current ? `${current.dateKey}T${String(Math.floor(current.minuteOfDay / 60)).padStart(2, '0')}:${String(current.minuteOfDay % 60).padStart(2, '0')}` : '');

  const tomorrow = zonedToUnix(addDays(localParts(now, timeZone).dateKey, 1), snoozeMorningMin, timeZone);
  const snoozeOptions: [string, UnixSeconds][] = [
    [m.time.hours(1), now + 3600],
    [m.time.hours(3), now + 3 * 3600],
    [m.popup.row.snoozeMorning(formatClock(tomorrow, timeZone, m)), tomorrow],
  ];
  const snoozed = item.state.snoozedUntil !== null && item.state.snoozedUntil > now ? item.state.snoozedUntil : null;
  const canSnooze = item.task.dueAt !== null && item.status === 'pending';
  const doneSteps = item.state.steps.filter((s) => s.done).length;

  const setPersonalDue = () => {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(due);
    if (match) actions.onCustomDue(zonedToUnix(match[1]!, Number(match[2]) * 60 + Number(match[3]), timeZone));
  };

  return (
    // Indented to the task title (row padding 16 + checkbox 16 + gap 12 = 44 px), not to the checkbox.
    <div className={inset ? "space-y-4 border-t border-border pt-3 pr-4 pb-4 pl-11" : "space-y-4 p-4"}>{/* lint-ui-allow: 44 px aligns with the title text */}
      {snoozed && <p className="text-[14px]">{t.snoozed(formatDue(snoozed, locale, timeZone))}</p>}

      {actions.onGrade && item.task.cmId !== null && showsGradeCard(item.task, item.status === 'done', now) && (
        <GradeSection key={item.task.cmId} cmid={item.task.cmId} url={item.task.url} now={now} d={d} onGrade={actions.onGrade} />
      )}

      {undated && (
        <div className="space-y-2">
          <label htmlFor={ids.due} className="block text-[14px] font-semibold">
            {t.customDue}
          </label>
          <p className="text-[12px] leading-normal text-muted-foreground">{t.customDueHelp}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input id={ids.due} type="datetime-local" className="w-56" value={due} onChange={(e) => setDue(e.target.value)} />
            <Button variant="outline" onClick={setPersonalDue} disabled={!due}>
              {t.customDueSet}
            </Button>
            {item.personalDue && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDue('');
                  actions.onCustomDue(null);
                }}
              >
                {t.customDueRemove}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[14px] font-semibold">{t.steps}</p>
          {item.state.steps.length > 0 && <span className="text-[12px] text-muted-foreground tabular-nums">{t.stepsDone(doneSteps, item.state.steps.length)}</span>}
        </div>
        {item.state.steps.length === 0 && <p className="text-[12px] text-muted-foreground">{t.stepsHelp}</p>}
        {item.state.steps.length > 0 && (
          <ul className="space-y-1">
            {item.state.steps.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <Checkbox id={`step-${s.id}`} checked={s.done} onCheckedChange={() => actions.onToggleStep(s.id)} />
                <label htmlFor={`step-${s.id}`} className={`flex-1 text-[14px] ${s.done ? 'text-muted-foreground line-through' : ''}`}>
                  {s.text}
                </label>
                <Button size="icon-sm" variant="ghost" aria-label={`${d.common.remove}: ${s.text}`} onClick={() => actions.onRemoveStep(s.id)}>
                  <XIcon className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            actions.onAddStep(step);
            setStep('');
          }}
        >
          {/* Enter in the field submits the form, like the button. Both 40 px high. */}
          <Input className="h-10" aria-label={t.addStep} placeholder={t.stepPlaceholder} maxLength={STEP_MAX} value={step} onChange={(e) => setStep(e.target.value)} />
          <Button type="submit" variant="outline" className="h-10 shrink-0" disabled={!step.trim()}>
            <PlusIcon className="size-4" />
            {t.addStep}
          </Button>
        </form>
      </div>

      <div className="space-y-2">
        <label htmlFor={ids.note} className="block text-[14px] font-semibold">
          {t.note}
        </label>
        <textarea
          id={ids.note}
          rows={3}
          maxLength={2000}
          placeholder={t.notePlaceholder}
          // Starts at three lines (80 px) and grows with the text up to 240 px; no resize handle.
          className="max-h-60 min-h-20 w-full resize-none [field-sizing:content] rounded-lg border border-input bg-transparent px-3 py-2 text-[14px] leading-normal outline-none placeholder:text-muted-foreground focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setNoteSaved(false);
          }}
          onBlur={() => {
            if (note !== item.state.note) {
              actions.onNote(note);
              setNoteSaved(true);
            }
          }}
        />
        {noteSaved && (
          <p role="status" className="text-[12px] text-muted-foreground">
            {t.noteSaved}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {own ? (
          actions.onEditOwn && (
            <button type="button" className={action} data-slot="task-action" onClick={actions.onEditOwn}>
              <PencilIcon className="size-4" />
              {t.ownEdit}
            </button>
          )
        ) : (
          <a className={action} data-slot="task-action" href={item.task.url} target="_blank" rel="noopener noreferrer">
            <ExternalIcon className="size-4" />
            {d.common.openInSikola}
          </a>
        )}
        {item.task.dueAt !== null && (
          <button type="button" className={action} data-slot="task-action" onClick={() => actions.onAddToCalendar(item)}>
            <CalendarPlusIcon className="size-4" />
            {t.addToCalendar}
          </button>
        )}
        {canSnooze && (
          <Select value="" onValueChange={(v) => actions.onSnooze(Number(v))}>
            <SelectTrigger className="h-9 w-auto" aria-label={t.snooze}>
              <SelectValue placeholder={t.snooze} />
            </SelectTrigger>
            <SelectContent>
              {snoozeOptions.map(([label, until]) => (
                <SelectItem key={label} value={String(until)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {snoozed && (
          <Button variant="ghost" className="h-9" onClick={() => actions.onSnooze(null)}>
            {t.cancelSnooze}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * "Nilai": hidden until "Lihat nilai", then the answer (masked in privacy mode), checked when, and SIKOLA's
 * own page where Sulo could not read it. Collapsing the task hides it again.
 */
function GradeSection({ cmid, url, now, d, onGrade }: { cmid: number; url: string; now: UnixSeconds; d: DashMessages; onGrade: NonNullable<TaskDetailActions['onGrade']> }) {
  const { m } = useI18n();
  const t = d.tugas;
  const grade = useTaskGrade((again) => onGrade(cmid, again));
  const s = grade.state;
  const line = s.phase === 'shown' ? gradeLine(s.outcome, m.intl) : null;
  const checkedAt = line && 'fetchedAt' in line ? line.fetchedAt : null;
  const message =
    line === null || line.kind === 'value'
      ? null
      : { none: t.gradeNone, not_shown: t.gradeNotShown, unknown: t.gradeUnknown, failed: t.gradeFailed, expired: t.gradeExpired, wait: t.gradeWait }[line.kind];
  const offerSikola = line !== null && (line.kind === 'unknown' || line.kind === 'failed' || line.kind === 'not_shown');
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[14px] font-semibold">{t.grade}</p>
        {checkedAt !== null && <span className="text-[12px] text-muted-foreground">{t.gradeChecked(formatAgo(checkedAt, now, m))}</span>}
      </div>
      {s.phase === 'hidden' && <p className="text-[12px] text-muted-foreground">{t.gradeHelp}</p>}
      {s.phase === 'loading' && (
        <p role="status" className="text-[12px] text-muted-foreground">
          {t.gradeLoading}
        </p>
      )}
      {line?.kind === 'value' && (
        <p className="text-[20px] font-semibold tabular-nums">
          <Private>{line.text}</Private>
        </p>
      )}
      {message && (
        <p role="status" className="text-[14px] text-muted-foreground">
          {message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {s.phase !== 'shown' ? (
          <Button variant="outline" className="h-9" disabled={s.phase === 'loading'} onClick={grade.see}>
            {t.gradeSee}
          </Button>
        ) : (
          <>
            {line?.kind !== 'expired' && line?.kind !== 'wait' && line?.kind !== 'unknown' && (
              <Button variant="outline" className="h-9" onClick={grade.again}>
                {t.gradeAgain}
              </Button>
            )}
            {offerSikola && (
              // A pill like its neighbours in this row (the action row below keeps its own shape).
              <Button variant="outline" className="h-9" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalIcon className="size-4" />
                  {d.common.openInSikola}
                </a>
              </Button>
            )}
            <Button variant="ghost" className="h-9" onClick={grade.hide}>
              {t.gradeHide}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

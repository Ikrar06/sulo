import { useId, useState } from 'react';
import { useI18n } from '@/components/i18n';
import { CalendarPlusIcon, ExternalIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TaskItem } from '@/lib/dashboard/tasks';
import { formatClock, formatDue } from '@/lib/format/time';
import type { DashMessages } from '@/lib/i18n/dashboard';
import { addDays, localParts, zonedToUnix } from '@/lib/reminders/zoned';
import { STEP_MAX } from '@/lib/tasks/local-state';
import type { UnixSeconds } from '@/lib/types';
import { PlusIcon, XIcon } from './icons';

export interface TaskDetailActions {
  onOpen: (url: string) => void;
  onAddToCalendar: (item: TaskItem) => void;
  onSnooze: (until: UnixSeconds | null) => void;
  onCustomDue: (at: UnixSeconds | null) => void;
  onAddStep: (text: string) => void;
  onToggleStep: (stepId: string) => void;
  onRemoveStep: (stepId: string) => void;
  onNote: (note: string) => void;
}

const action =
  'inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-[14px] outline-none hover:bg-muted focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-offset-2 focus-ring:ring-offset-background';

/**
 * One column: what the user keeps about the task (personal due date, steps,
 * note), then one row of actions. Everything here lives only in this browser.
 */
export function TaskDetails({ item, d, now, timeZone, snoozeMorningMin, actions }: { item: TaskItem; d: DashMessages; now: UnixSeconds; timeZone: string; snoozeMorningMin: number; actions: TaskDetailActions }) {
  const { m, locale } = useI18n();
  const t = d.tugas;
  const ids = { due: useId(), note: useId() };
  const [step, setStep] = useState('');
  const [note, setNote] = useState(item.state.note);
  const [noteSaved, setNoteSaved] = useState(false);
  const undated = item.task.dueAt === null || item.personalDue;
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
    <div className="space-y-4 border-t border-border px-4 pt-3 pb-4">
      {snoozed && <p className="text-[14px]">{t.snoozed(formatDue(snoozed, locale, timeZone))}</p>}

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
          <Input aria-label={t.addStep} placeholder={t.stepPlaceholder} maxLength={STEP_MAX} value={step} onChange={(e) => setStep(e.target.value)} />
          <Button type="submit" variant="outline" disabled={!step.trim()}>
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
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-[14px] leading-normal outline-none placeholder:text-muted-foreground focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
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
        <a className={action} href={item.task.url} target="_blank" rel="noopener noreferrer">
          <ExternalIcon className="size-4" />
          {d.common.openInSikola}
        </a>
        {item.task.dueAt !== null && (
          <button type="button" className={action} onClick={() => actions.onAddToCalendar(item)}>
            <CalendarPlusIcon className="size-4" />
            {t.addToCalendar}
          </button>
        )}
        {canSnooze && (
          <Select value="" onValueChange={(v) => actions.onSnooze(Number(v))}>
            <SelectTrigger className="min-w-44" aria-label={t.snooze}>
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
          <Button variant="ghost" onClick={() => actions.onSnooze(null)}>
            {t.cancelSnooze}
          </Button>
        )}
      </div>
    </div>
  );
}

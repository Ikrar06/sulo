// One task on its own screen (M8c.1): a header card (course chip, title 18,
// time left 22 in its urgency color, the date), a card for a personal due
// date when SIKOLA gives none, "Langkah" and "Catatan" as their own cards,
// and a bar stuck to the bottom: Tandai selesai (primary pill), round
// buttons for SIKOLA and the calendar, and Tunda in a bottom sheet. The tab
// bar is hidden here. Everything writes through core (tasks/local-state).

import { useId, useMemo, useState } from 'react';
import { buildTaskItems } from '@sulo/core/dashboard/tasks';
import { taskCalendarUrl } from '@sulo/core/format/gcal';
import { formatClock, formatDue, taskDueLines } from '@sulo/core/format/time';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { addDays, localParts, zonedToUnix } from '@sulo/core/reminders/zoned';
import { urgencyOf } from '@sulo/core/tasks/group';
import { addStep, removeStep, setCustomDue, setNote, setSnooze, STEP_MAX, toggleStep } from '@sulo/core/tasks/local-state';
import type { UnixSeconds } from '@sulo/core/types';
import { useDoneUndo } from '@sulo/ui/dashboard/done-undo';
import { ClockIcon, MoreIcon, PlusIcon, XIcon } from '@sulo/ui/dashboard-icons';
import { useI18n } from '@sulo/ui/i18n';
import { CalendarPlusIcon, ExternalIcon } from '@sulo/ui/icons';
import { Card, Chip } from '@sulo/ui/mobile/cards';
import { CheckCircle, IconButton, PillButton } from '@sulo/ui/mobile/controls';
import { FitLine } from '@sulo/ui/mobile/fit-line';
import { Sheet, SheetMenu, afterSheetClosed } from '@sulo/ui/mobile/sheet';
import { courseTint } from '@sulo/ui/mobile/tint';
import { Input } from '@sulo/ui/ui/input';
import { timeZone, useMobileData } from '../shell/data';
import { URGENCY_TEXT } from './Tugas';

export function TaskScreen({ eventId }: { eventId: number }) {
  const { m, locale } = useI18n();
  const d = mobileDash(locale);
  const w = mobileWords(locale);
  const t = d.tugas;
  const { data, actions, platform } = useMobileData();
  const now = data!.now;
  const item = useMemo(() => buildTaskItems(data!.user!).find((i) => i.task.eventId === eventId) ?? null, [data, eventId]);
  const done = useDoneUndo(actions, d, data!.today, platform.store);
  const [step, setStep] = useState('');
  const [note, setNoteText] = useState(item?.state.note ?? '');
  const [noteSaved, setNoteSaved] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const ids = { note: useId(), due: useId() };
  if (!item) return <p className="py-8 text-center text-m13 text-muted-foreground">{t.empty}</p>;
  const state = (fn: Parameters<typeof actions.updateUser<'taskState'>>[1]) => void actions.updateUser('taskState', fn);
  const due = item.task.dueAt;
  const isDone = item.status === 'done';
  const lines = due === null ? null : taskDueLines(due, now, timeZone, m, locale, 'both');
  const tone = due === null || item.status !== 'pending' ? '' : URGENCY_TEXT[urgencyOf(due, now)];
  const undated = due === null || item.personalDue;
  const snoozed = item.state.snoozedUntil !== null && item.state.snoozedUntil > now ? item.state.snoozedUntil : null;
  const tomorrow = zonedToUnix(addDays(localParts(now, timeZone).dateKey, 1), data!.prefs.reminders.snoozeMorningMin, timeZone);
  const snoozeOptions: [string, UnixSeconds][] = [
    [m.time.hours(1), now + 3600],
    [m.time.hours(3), now + 3 * 3600],
    [m.popup.row.snoozeMorning(formatClock(tomorrow, timeZone, m)), tomorrow],
  ];
  const doneSteps = item.state.steps.filter((s) => s.done).length;

  return (
    <div className="space-y-3 pb-20">{/* lint-ui-allow: room for the bar stuck to the bottom */}
      <Card>
        <Chip color={courseTint(item.courseColor)}>{item.courseName}</Chip>
        <h2 className={`mt-3 text-m18 ${isDone ? 'text-muted-foreground line-through' : ''}`}>{item.task.name}</h2>
        <FitLine size="text-m22" text={lines === null ? t.noDue : lines.primary} className={`mt-3 font-semibold tabular-nums ${tone}`}>
          {lines === null ? t.noDue : lines.primary}
        </FitLine>
        {lines?.secondary && <p className="text-m13 text-muted-foreground tabular-nums">{lines.secondary}</p>}
        {snoozed && <p className="mt-2 text-m13 text-muted-foreground">{t.snoozed(formatDue(snoozed, locale, timeZone))}</p>}
      </Card>

      {undated && (
        <Card>
          <label htmlFor={ids.due} className="block text-m15 font-semibold">
            {t.customDue}
          </label>
          <p className="mt-1 text-m13 text-muted-foreground">{t.customDueHelp}</p>
          <PersonalDue id={ids.due} current={item.personalDue && due !== null ? due : null} onSet={(at) => state((s) => setCustomDue(s, item.task.eventId, at))} setLabel={t.customDueSet} removeLabel={t.customDueRemove} />
        </Card>
      )}

      <Card>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-m15 font-semibold">{w.app.steps}</h3>
          {item.state.steps.length > 0 && <span className="text-m12 font-normal text-muted-foreground tabular-nums">{t.stepsDone(doneSteps, item.state.steps.length)}</span>}
        </div>
        {item.state.steps.length === 0 && <p className="mt-1 text-m13 text-muted-foreground">{t.stepsHelp}</p>}
        {item.state.steps.length > 0 && (
          <ul className="mt-2">
            {item.state.steps.map((s) => (
              <li key={s.id} className="flex min-h-11 items-center gap-3">
                <CheckCircle checked={s.done} onChange={() => state((x) => toggleStep(x, item.task.eventId, s.id))} label={s.text} />
                <span className={`min-w-0 flex-1 text-m15 ${s.done ? 'text-muted-foreground line-through' : ''}`}>{s.text}</span>
                <IconButton icon={XIcon} inset label={`${d.common.remove}: ${s.text}`} onPress={() => state((x) => removeStep(x, item.task.eventId, s.id))} />
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!step.trim()) return;
            state((s) => addStep(s, item.task.eventId, step, crypto.randomUUID()));
            setStep('');
          }}
        >
          <Input className="rounded-full" aria-label={t.addStep} placeholder={t.stepPlaceholder} maxLength={STEP_MAX} value={step} onChange={(e) => setStep(e.target.value)} />
          <button type="submit" disabled={!step.trim()} aria-label={t.addStep} className="m-hit m-press inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-m-inset outline-none focus-ring:ring-2 focus-ring:ring-focus disabled:opacity-50">
            <PlusIcon className="size-5" />
          </button>
        </form>
      </Card>

      <Card>
        <label htmlFor={ids.note} className="block text-m15 font-semibold">
          {t.note}
        </label>
        <textarea
          id={ids.note}
          rows={3}
          maxLength={2000}
          placeholder={t.notePlaceholder}
          className="mt-2 max-h-60 min-h-20 w-full resize-none [field-sizing:content] rounded-ctl bg-m-inset px-3 py-2 text-m15 font-normal outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-focus"
          value={note}
          onChange={(e) => {
            setNoteText(e.target.value);
            setNoteSaved(false);
          }}
          onBlur={() => {
            if (note !== item.state.note) {
              state((s) => setNote(s, item.task.eventId, note));
              setNoteSaved(true);
            }
          }}
        />
        {noteSaved && (
          <p role="status" className="mt-1 text-m12 font-normal text-muted-foreground">
            {t.noteSaved}
          </p>
        )}
      </Card>

      {/* The bar stuck to the bottom (the tab bar is hidden on details). */}
      <div className="fixed inset-x-0 z-30 px-4" style={{ bottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <div className="m-card mx-auto flex max-w-md items-center gap-2 rounded-full p-2">
          <div className="min-w-0 flex-1">
            <PillButton kind="primary" full onPress={() => (isDone ? done.unmark(item.task.eventId) : done.mark(item.task.eventId))}>
              {isDone ? t.markUndone : t.markDone}
            </PillButton>
          </div>
          {/* One round button for the rest: a sheet of labeled rows. */}
          <IconButton icon={MoreIcon} inset label={w.app.moreActions} onPress={() => setMenuOpen(true)} />
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title={w.app.moreActions}>
        <SheetMenu
          items={[
            { label: d.common.openInSikola, icon: ExternalIcon, onPress: () => (setMenuOpen(false), actions.openExternal(item.task.url)) },
            ...(due !== null ? [{ label: t.addToCalendar, icon: CalendarPlusIcon, onPress: () => (setMenuOpen(false), actions.openExternal(taskCalendarUrl({ name: item.task.name, courseName: item.courseName, dueAt: due }, m.popup.row.calendarDetails))) }] : []),
            ...(due !== null && item.status === 'pending' ? [{ label: w.app.snoozeMenu, icon: ClockIcon, onPress: () => (setMenuOpen(false), afterSheetClosed(() => setSnoozeOpen(true))) }] : []),
          ]}
        />
      </Sheet>

      <Sheet open={snoozeOpen} onOpenChange={setSnoozeOpen} title={w.app.snoozeMenu}>
        <div className="space-y-2">
          {snoozeOptions.map(([label, until]) => (
            <PillButton
              key={label}
              full
              onPress={() => {
                setSnoozeOpen(false);
                afterSheetClosed(() => state((s) => setSnooze(s, item.task.eventId, until)));
              }}
            >
              {label}
            </PillButton>
          ))}
          {snoozed && (
            <PillButton
              full
              onPress={() => {
                setSnoozeOpen(false);
                afterSheetClosed(() => state((s) => setSnooze(s, item.task.eventId, null)));
              }}
            >
              {t.cancelSnooze}
            </PillButton>
          )}
        </div>
      </Sheet>
    </div>
  );
}

function PersonalDue({ id, current, onSet, setLabel, removeLabel }: { id: string; current: UnixSeconds | null; onSet: (at: UnixSeconds | null) => void; setLabel: string; removeLabel: string }) {
  const parts = current !== null ? localParts(current, timeZone) : null;
  const [value, setValue] = useState(parts ? `${parts.dateKey}T${String(Math.floor(parts.minuteOfDay / 60)).padStart(2, '0')}:${String(parts.minuteOfDay % 60).padStart(2, '0')}` : '');
  const apply = () => {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (match) onSet(zonedToUnix(match[1]!, Number(match[2]) * 60 + Number(match[3]), timeZone));
  };
  return (
    <div className="mt-3 space-y-2">
      <Input id={id} type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="flex gap-2">
        <PillButton onPress={apply} disabled={!value}>
          {setLabel}
        </PillButton>
        {current !== null && (
          <PillButton
            onPress={() => {
              setValue('');
              onSet(null);
            }}
          >
            {removeLabel}
          </PillButton>
        )}
      </div>
    </div>
  );
}

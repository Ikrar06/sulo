import { useState } from 'react';
import { useI18n } from '@/components/i18n';
import { ChevronDownIcon, ClockIcon } from '@/components/icons';
import { formatDueClock } from '@/lib/format/time';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { DueFormat } from '@/lib/prefs';
import type { Urgency } from '@/lib/tasks/group';
import type { UnixSeconds } from '@/lib/types';
import { dueText, type TaskGroupView, type TaskRow } from '@/lib/view/popup-view';
import { RowMenu, type SnoozeOption } from './Menus';

const URGENCY_TEXT: Record<Urgency, string> = {
  overdue: 'text-urgency-overdue',
  day: 'text-urgency-soon',
  threeDays: 'text-urgency-week',
  normal: 'text-muted-foreground',
};

const COURSE_DOT = ['', 'bg-course-1', 'bg-course-2', 'bg-course-3', 'bg-course-4', 'bg-course-5', 'bg-course-6', 'bg-course-7', 'bg-course-8'];

export interface RowActions {
  onDone: (eventId: number) => void;
  /** Urungkan on a row just marked done. */
  onUndo?: (eventId: number) => void;
  onOpenTask: (url: string) => void;
  onAddToCalendar: (row: TaskRow) => void;
  onSnooze: (eventId: number, until: UnixSeconds | null) => void;
}

export interface DueContext {
  format: DueFormat;
  now: UnixSeconds;
  timeZone: string;
  snoozeOptions: SnoozeOption[];
}

/**
 * Two lines on the left (task name, then course), due time on the right in
 * the urgency color. With "Keduanya" the due day and time sit under the time
 * left, level with the course line. The urgency color always follows the
 * time left, whatever the format.
 */
function Row({ row, due, actions }: { row: TaskRow; due: DueContext; actions: RowActions }) {
  const { m } = useI18n();
  const text = dueText(row, due.format, due.now, due.timeZone, m);
  return (
    <li className="group relative flex items-start gap-3 rounded-lg py-2.5 pr-10 pl-3 transition-colors hover:bg-surface-raised has-focus-ring:bg-surface-raised">
      <button
        type="button"
        onClick={() => actions.onOpenTask(row.url)}
        aria-label={m.popup.openTask(row.name)}
        className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0 after:rounded-lg focus-ring:after:ring-2 focus-ring:after:ring-focus"
      >
        <span className="line-clamp-2 text-[14px] leading-[19px] font-semibold" title={row.name}>
          {row.name}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[12px] leading-4 text-muted-foreground">
          <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${COURSE_DOT[row.courseColor] ?? COURSE_DOT[1]}`} />
          <span className="truncate" title={row.courseName}>
            {row.courseName}
          </span>
          {row.marker !== null && (
            <span className="shrink-0 rounded-full border border-border px-1.5 text-[11px] leading-4 font-medium text-foreground">
              {row.marker === 'new' ? m.popup.updates.markerNew : m.popup.updates.markerDue}
            </span>
          )}
          {row.snoozedUntil !== null && (
            <span className="flex shrink-0 items-center" title={m.popup.row.snoozedUntil(formatDueClock(row.snoozedUntil, due.now, due.timeZone, m))}>
              <ClockIcon aria-hidden="true" className="size-3" />
              <span className="sr-only">{m.popup.row.snoozedUntil(formatDueClock(row.snoozedUntil, due.now, due.timeZone, m))}</span>
            </span>
          )}
        </span>
      </button>
      <div className="flex shrink-0 flex-col items-end text-right">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={`text-[12.5px] leading-[19px] font-medium tabular-nums ${URGENCY_TEXT[row.urgency]}`}
              data-due-at={text.ticking && row.dueAt !== null ? row.dueAt : undefined}
            >
              {text.primary}
            </span>
          </TooltipTrigger>
          {row.fullDate && <TooltipContent>{row.fullDate}</TooltipContent>}
        </Tooltip>
        {text.secondary && <span className="mt-1 text-[12px] leading-4 text-muted-foreground tabular-nums">{text.secondary}</span>}
      </div>
      {/* The row menu has its own 32 px slot on the right, so the due time is never covered. */}
      <div className="absolute top-1/2 right-1 -translate-y-1/2">
        <RowMenu
          row={row}
          snoozeOptions={due.snoozeOptions}
          onDone={() => actions.onDone(row.eventId)}
          onAddToCalendar={() => actions.onAddToCalendar(row)}
          onSnooze={(until) => actions.onSnooze(row.eventId, until)}
        />
      </div>
    </li>
  );
}

/** A row marked done in the last 5 seconds: kept where it was, as "Selesai · Urungkan". */
export interface DoneLinger {
  row: TaskRow;
  group: TaskGroupView['key'];
  index: number;
  leaving: boolean;
}

function DoneRow({ linger, onUndo }: { linger: DoneLinger; onUndo?: (eventId: number) => void }) {
  const { m } = useI18n();
  return (
    <li className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${linger.leaving ? 'db-collapse' : ''}`}>
      <span className="min-w-0 flex-1 truncate text-[14px] leading-[19px] text-muted-foreground line-through" title={linger.row.name}>
        {linger.row.name}
      </span>
      <span role="status" className="shrink-0 text-[12.5px] text-muted-foreground">
        {m.popup.row.doneShort}
      </span>
      {onUndo && (
        <>
          <span aria-hidden="true" className="text-muted-foreground">
            ·
          </span>
          <button
            type="button"
            onClick={() => onUndo(linger.row.eventId)}
            className="shrink-0 rounded-sm text-[12.5px] font-semibold underline-offset-2 outline-none hover:underline focus-ring:ring-2 focus-ring:ring-focus"
          >
            {m.popup.row.undo}
          </button>
        </>
      )}
    </li>
  );
}

export function Group({ group, due, actions, lingering = [] }: { group: TaskGroupView; due: DueContext; actions: RowActions; lingering?: readonly DoneLinger[] }) {
  const { m } = useI18n();
  const [open, setOpen] = useState(!group.collapsedByDefault);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="pt-1">
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-left text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">
        <span>{m.popup.groups[group.key]}</span>
        <span className="tabular-nums font-normal">{group.rows.length}</span>
        <ChevronDownIcon className={`ml-auto size-3.5 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul>
          {merged(group.rows, lingering).map((item) =>
            'linger' in item ? <DoneRow key={item.linger.row.eventId} linger={item.linger} onUndo={actions.onUndo} /> : <Row key={item.row.eventId} row={item.row} due={due} actions={actions} />,
          )}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** The group's rows with just-done rows put back at their old place. */
function merged(rows: readonly TaskRow[], lingering: readonly DoneLinger[]): ({ row: TaskRow } | { linger: DoneLinger })[] {
  const out: ({ row: TaskRow } | { linger: DoneLinger })[] = rows.filter((r) => !lingering.some((l) => l.row.eventId === r.eventId)).map((row) => ({ row }));
  for (const l of [...lingering].sort((a, b) => a.index - b.index)) out.splice(Math.min(l.index, out.length), 0, { linger: l });
  return out;
}

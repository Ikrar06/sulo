import { useState } from 'react';
import { useI18n } from '@/components/i18n';
import { ChevronDownIcon } from '@/components/icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { DueFormat } from '@/lib/prefs';
import type { Urgency } from '@/lib/tasks/group';
import type { UnixSeconds } from '@/lib/types';
import { dueText, type TaskGroupView, type TaskRow } from '@/lib/view/popup-view';
import { RowMenu } from './Menus';

const URGENCY_TEXT: Record<Urgency, string> = {
  overdue: 'text-urgency-overdue',
  day: 'text-urgency-soon',
  threeDays: 'text-urgency-week',
  normal: 'text-muted-foreground',
};

const COURSE_DOT = ['', 'bg-course-1', 'bg-course-2', 'bg-course-3', 'bg-course-4', 'bg-course-5', 'bg-course-6', 'bg-course-7', 'bg-course-8'];

export interface RowActions {
  onDone: (eventId: number) => void;
  onOpenTask: (url: string) => void;
  onAddToCalendar: (row: TaskRow) => void;
}

export interface DueContext {
  format: DueFormat;
  now: UnixSeconds;
  timeZone: string;
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
    <li className="group relative flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-raised focus-within:bg-surface-raised">
      <button
        type="button"
        onClick={() => actions.onOpenTask(row.url)}
        aria-label={m.popup.openTask(row.name)}
        className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring"
      >
        <span className="line-clamp-2 text-[14px] leading-[19px] font-semibold">{row.name}</span>
        <span className="mt-1 flex items-center gap-1.5 text-[12px] leading-4 text-muted-foreground">
          <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${COURSE_DOT[row.courseColor] ?? COURSE_DOT[1]}`} />
          <span className="truncate">{row.courseName}</span>
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
      {/* Hover and focus reveal the row menu over the due time, like mail apps do. */}
      <div className="absolute top-1/2 right-2 -translate-y-1/2">
        <RowMenu row={row} onDone={() => actions.onDone(row.eventId)} onAddToCalendar={() => actions.onAddToCalendar(row)} />
      </div>
    </li>
  );
}

export function Group({ group, due, actions }: { group: TaskGroupView; due: DueContext; actions: RowActions }) {
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
          {group.rows.map((row) => (
            <Row key={row.eventId} row={row} due={due} actions={actions} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

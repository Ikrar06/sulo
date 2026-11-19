// "Tambah ke Google Calendar" on a task row (Tugas, Ringkasan): the popup's
// row action (packages/ui/src/row-actions.ts), a 28 px circle on a faint fill, that takes the due time's place while the row
// (a `group`) is hovered or has keyboard focus inside, over the time column
// so the row never shifts. Pointer events only while shown, so a touch screen
// (no hover) never taps an invisible button; there the action stays in the
// task's details. A link opened by the user's click: nothing is sent.

import { taskCalendarUrl } from '@sulo/core/format/gcal';
import { useI18n } from '@sulo/ui/i18n';
import { CalendarPlusIcon } from '@sulo/ui/icons';
import { FADES_FOR_ACTIONS, ROW_ACTION, ROW_ACTION_SHOWN } from '@sulo/ui/row-actions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@sulo/ui/ui/tooltip';

/** The due time's classes: it fades out (120 ms) while the button shows. */
export const FADES_FOR_CALENDAR = FADES_FOR_ACTIONS;

export function CalendarHoverButton({ name, courseName, dueAt, url, onOpen, className = '' }: { name: string; courseName: string; dueAt: number; url: string; onOpen: (url: string) => void; className?: string }) {
  const { m } = useI18n();
  const label = m.popup.row.addToCalendar;
  // Its own provider, like the header's privacy toggle: the dashboard has no page-wide one.
  return (
    <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} onClick={() => onOpen(taskCalendarUrl({ name, courseName, dueAt, url }, m.popup.row.calendarDetails))} className={`${ROW_ACTION} ${ROW_ACTION_SHOWN} ${className}`}>
          <CalendarPlusIcon />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
    </TooltipProvider>
  );
}

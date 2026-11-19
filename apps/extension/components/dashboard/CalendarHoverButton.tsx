// "Tambah ke Google Calendar" on a task row (Tugas, Ringkasan): a 28 px
// circle in a neutral color that takes the due time's place while the row
// (a `group`) is hovered or has keyboard focus inside, over the time column
// so the row never shifts. Pointer events only while shown, so a touch screen
// (no hover) never taps an invisible button; there the action stays in the
// task's details. A link opened by the user's click: nothing is sent.

import { taskCalendarUrl } from '@sulo/core/format/gcal';
import { useI18n } from '@sulo/ui/i18n';
import { CalendarPlusIcon } from '@sulo/ui/icons';
import { Button } from '@sulo/ui/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@sulo/ui/ui/tooltip';

/** The due time's classes: it fades out (120 ms) while the button shows. */
export const FADES_FOR_CALENDAR = 'transition-opacity duration-[120ms] group-hover:opacity-0 group-focus-ring:opacity-0';

export function CalendarHoverButton({ name, courseName, dueAt, url, onOpen, className = '' }: { name: string; courseName: string; dueAt: number; url: string; onOpen: (url: string) => void; className?: string }) {
  const { m } = useI18n();
  const label = m.popup.row.addToCalendar;
  // Its own provider, like the header's privacy toggle: the dashboard has no page-wide one.
  return (
    <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={label}
          onClick={() => onOpen(taskCalendarUrl({ name, courseName, dueAt, url }, m.popup.row.calendarDetails))}
          className={`pointer-events-none size-7 text-muted-foreground opacity-0 transition-opacity duration-[120ms] group-hover:pointer-events-auto group-hover:opacity-100 group-focus-ring:pointer-events-auto group-focus-ring:opacity-100 hover:text-foreground ${className}`}
        >
          <CalendarPlusIcon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
    </TooltipProvider>
  );
}

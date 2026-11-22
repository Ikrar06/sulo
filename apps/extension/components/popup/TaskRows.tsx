import { useState } from 'react';
import { useI18n } from '@sulo/ui/i18n';
import { CalendarPlusIcon, ChevronDownIcon, ClockIcon } from '@sulo/ui/icons';
import { Chip } from '@sulo/ui/mobile/cards';
import { CheckCircle } from '@sulo/ui/mobile/controls';
import { FitLine } from '@sulo/ui/mobile/fit-line';
import { courseTint } from '@sulo/ui/mobile/tint';
import { URGENCY_TEXT } from '@sulo/ui/urgency';
import { FADES_FOR_ACTIONS, ROW_ACTION, ROW_ACTION_SHOWN } from '@sulo/ui/row-actions';
import { countdownLabel } from '@sulo/core/format/countdown';
import { formatDueClock, localeOf } from '@sulo/core/format/time';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@sulo/ui/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sulo/ui/ui/tooltip';
import type { DueFormat } from '@sulo/core/prefs';
import type { UnixSeconds } from '@sulo/core/types';
import { dueText, type TaskGroupView, type TaskRow } from '@sulo/core/view/popup-view';
import { RowMenu, type SnoozeOption } from './Menus';


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
    // The right column: the due time, then the check circle, whose right edge is the group chevron's.
    // The hover and focus fill (skin.css .row-hover) reaches 10 past the content left and right and 6 above
    // and below (the row's own 10 px padding less 4); nothing in the row moves.
    <li data-flip-key={row.eventId} className="row-hover group relative mx-3 flex items-start gap-3 py-2.5" style={{ ['--rh-x' as string]: '-10px', ['--rh-y' as string]: '4px' }}>
      <button
        type="button"
        onClick={() => actions.onOpenTask(row.url)}
        aria-label={m.popup.openTask(row.name)}
        className="row-main min-w-0 flex-1 text-left outline-none after:absolute after:inset-0"
      >
        <span className="line-clamp-2 text-[14px] leading-[19px] font-semibold" title={row.name}>
          {row.name}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[12px] leading-4 text-muted-foreground">
          <span className="min-w-0 shrink text-foreground" title={row.courseName}>
            <Chip small color={courseTint(row.courseColor)}>
              {row.courseName}
            </Chip>
          </span>
          {row.marker !== null && (
            <span className="shrink-0 rounded-full border border-border px-1.5 text-[11px] leading-4 font-medium text-foreground">
              {row.marker === 'new' ? m.popup.updates.markerNew : m.popup.updates.markerDue}
            </span>
          )}
          {row.snoozedUntil !== null && (
            <span className="flex shrink-0 items-center" title={m.popup.row.snoozedUntil(formatDueClock(row.snoozedUntil, due.now, due.timeZone, m))}>
              <ClockIcon aria-hidden="true" className="size-4" />
              <span className="sr-only">{m.popup.row.snoozedUntil(formatDueClock(row.snoozedUntil, due.now, due.timeZone, m))}</span>
            </span>
          )}
        </span>
      </button>
      {/* At least as wide as the two buttons that take its place, so the row never shifts. */}
      <div className="relative flex min-w-[60px] shrink-0 flex-col items-end text-right">
        <div className={`flex flex-col items-end ${FADES_FOR_ACTIONS}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* One line always (the phone's FitLine); the shared ticker rewrites the inner span in countdown mode. */}
            <span className="block">
              <FitLine size="text-m12" text={text.primary} className={`py-0.5 tabular-nums ${URGENCY_TEXT[row.urgency]}`}>
                <span
                  data-due-at={text.ticking && row.dueAt !== null ? row.dueAt : undefined}
                  aria-label={text.ticking && row.dueAt !== null ? (countdownLabel((row.dueAt - due.now) * 1000, localeOf(m)) ?? undefined) : undefined}
                >
                  {text.primary}
                </span>
              </FitLine>
            </span>
          </TooltipTrigger>
          {row.fullDate && <TooltipContent>{row.fullDate}</TooltipContent>}
        </Tooltip>
        {text.secondary && <span className="mt-1 text-[12px] leading-4 text-muted-foreground tabular-nums">{text.secondary}</span>}
        </div>
      </div>
      {/* While the row is hovered or focused, the due time gives its place to two circles, centred on the
          row like the check circle: from the right, the circle, "add to calendar" 8 px from it, the row
          menu (snooze) 4 px further; in that order for the keyboard too, left to right. A calendar link opens only on the user's click; nothing is sent. */}
      <div className="absolute top-1/2 right-[30px] flex -translate-y-1/2 items-center gap-1">
          <RowMenu
            row={row}
            snoozeOptions={due.snoozeOptions}
            onDone={() => actions.onDone(row.eventId)}
            onAddToCalendar={() => actions.onAddToCalendar(row)}
            onSnooze={(until) => actions.onSnooze(row.eventId, until)}
          />
          {row.dueAt !== null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label={m.popup.row.addToCalendar} onClick={() => actions.onAddToCalendar(row)} className={`${ROW_ACTION} ${ROW_ACTION_SHOWN}`}>
                  <CalendarPlusIcon />
                </button>
              </TooltipTrigger>
              <TooltipContent>{m.popup.row.addToCalendar}</TooltipContent>
            </Tooltip>
          )}
      </div>
      <span className="relative z-10 flex self-center">
        <CheckCircle size="sm" checked={false} onChange={() => actions.onDone(row.eventId)} label={`${m.popup.row.markDone}: ${row.name}`} />
      </span>
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
    <li data-flip-key={linger.row.eventId} className={`mx-3 flex items-center gap-3 py-2.5 ${linger.leaving ? 'db-collapse' : ''}`}>
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
      {/* The same circle, filled, at the same place: unticking it is the undo. */}
      <CheckCircle size="sm" checked onChange={() => onUndo?.(linger.row.eventId)} label={`${m.popup.row.undo}: ${linger.row.name}`} />
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
        <ChevronDownIcon className={`ml-auto size-4 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
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

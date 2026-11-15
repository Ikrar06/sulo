import type { ReactNode } from 'react';
import { useI18n } from '@/components/i18n';
import { BellIcon, CalendarPlusIcon, CheckIcon, ClockIcon, CopyIcon, MoreIcon, SettingsIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CopyScope } from '@/lib/format/copy-list';
import { LANGUAGE_NAMES, LOCALES, type Locale } from '@/lib/i18n';
import { DUE_FORMATS, type DueFormat } from '@/lib/prefs';
import type { UnixSeconds } from '@/lib/types';
import type { TaskRow } from '@/lib/view/popup-view';

export interface SnoozeOption {
  label: string;
  until: UnixSeconds;
}

function MenuButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={label}>
            {children}
          </Button>
        </DropdownMenuTrigger>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** One format only (plain text for WhatsApp), so the menu just picks the scope. */
export function CopyMenu({ onCopy }: { onCopy: (scope: CopyScope) => void }) {
  const { m } = useI18n();
  const c = m.popup.copy;
  return (
    <DropdownMenu>
      <MenuButton label={c.button}>
        <CopyIcon className="size-4" />
      </MenuButton>
      <DropdownMenuContent align="end" className="w-60">
        {(['week', 'all'] as CopyScope[]).map((scope) => (
          <DropdownMenuItem key={scope} onSelect={() => onCopy(scope)}>
            {c[scope]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface SettingsMenuProps {
  dueFormat: DueFormat;
  onSetDueFormat: (format: DueFormat) => void;
  onSetLocale: (locale: Locale) => void;
  onManageCourses: () => void;
  onOpenReminders: () => void;
}

/** Small settings menu for M2; the full settings page comes with the dashboard (M5a). */
export function SettingsMenu({ dueFormat, onSetDueFormat, onSetLocale, onManageCourses, onOpenReminders }: SettingsMenuProps) {
  const { m, locale } = useI18n();
  const s = m.popup.settings;
  return (
    <DropdownMenu>
      <MenuButton label={s.button}>
        <SettingsIcon className="size-4" />
      </MenuButton>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={onManageCourses}>{s.manageCourses}</DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenReminders}>
          <BellIcon className="size-4" />
          {s.reminders}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{s.dueFormat}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={dueFormat} onValueChange={(v) => onSetDueFormat(v as DueFormat)}>
          {DUE_FORMATS.map((f) => (
            <DropdownMenuRadioItem key={f} value={f}>
              {s.formats[f]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{s.language}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={(v) => onSetLocale(v as Locale)}>
          {LOCALES.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} lang={l}>
              {LANGUAGE_NAMES[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface RowMenuProps {
  row: TaskRow;
  snoozeOptions: SnoozeOption[];
  onDone: () => void;
  onAddToCalendar: () => void;
  /** null cancels the snooze. */
  onSnooze: (until: UnixSeconds | null) => void;
}

/** Per-task menu: mark as done, snooze the reminder, add to Google Calendar (a link the user opens). */
export function RowMenu({ row, snoozeOptions, onDone, onAddToCalendar, onSnooze }: RowMenuProps) {
  const { m } = useI18n();
  const r = m.popup.row;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={r.menu(row.name)}
          className="row-menu relative z-10 size-7 bg-surface-raised opacity-0 group-hover:opacity-100 group-focus-ring:opacity-100 focus-ring:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onSelect={onDone}>
          <CheckIcon className="size-4" />
          {r.markDone}
        </DropdownMenuItem>
        {row.dueAt !== null && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ClockIcon className="size-4" />
              {r.snooze}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              {snoozeOptions
                .filter((o) => o.until < (row.dueAt as UnixSeconds))
                .map((o) => (
                  <DropdownMenuItem key={o.label} onSelect={() => onSnooze(o.until)}>
                    {r.snoozeFor(o.label)}
                  </DropdownMenuItem>
                ))}
              {row.snoozedUntil !== null && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => onSnooze(null)}>{r.unsnooze}</DropdownMenuItem>
                </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {row.dueAt !== null && (
          <DropdownMenuItem onSelect={onAddToCalendar}>
            <CalendarPlusIcon className="size-4" />
            {r.addToCalendar}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import type { ReactNode } from 'react';
import { useI18n } from '@/components/i18n';
import { CalendarPlusIcon, CheckIcon, CopyIcon, MoreIcon, SettingsIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CopyScope } from '@/lib/format/copy-list';
import { LANGUAGE_NAMES, LOCALES, type Locale } from '@/lib/i18n';
import { DUE_FORMATS, type DueFormat } from '@/lib/prefs';
import type { TaskRow } from '@/lib/view/popup-view';

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
}

/** Small settings menu for M2; the full settings page comes with the dashboard (M5a). */
export function SettingsMenu({ dueFormat, onSetDueFormat, onSetLocale, onManageCourses }: SettingsMenuProps) {
  const { m, locale } = useI18n();
  const s = m.popup.settings;
  return (
    <DropdownMenu>
      <MenuButton label={s.button}>
        <SettingsIcon className="size-4" />
      </MenuButton>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={onManageCourses}>{s.manageCourses}</DropdownMenuItem>
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

/** Per-task menu: mark as done, add to Google Calendar (a link the user opens). */
export function RowMenu({ row, onDone, onAddToCalendar }: { row: TaskRow; onDone: () => void; onAddToCalendar: () => void }) {
  const { m } = useI18n();
  const r = m.popup.row;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={r.menu(row.name)}
          className="row-menu relative z-10 size-7 bg-surface-raised opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
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
          <DropdownMenuItem onSelect={onAddToCalendar}>
            <CalendarPlusIcon className="size-4" />
            {r.addToCalendar}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

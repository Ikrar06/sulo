import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { ROW_ACTION, ROW_ACTION_SHOWN } from '@sulo/ui/row-actions';
import { useI18n } from '@sulo/ui/i18n';
import { CalendarPlusIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, CopyIcon, MoreIcon, SettingsIcon } from '@sulo/ui/icons';
import { Button } from '@sulo/ui/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@sulo/ui/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sulo/ui/ui/tooltip';
import type { CopyScope } from '@sulo/core/format/copy-list';
import { LANGUAGE_NAMES, LOCALES, type Locale } from '@sulo/core/i18n';
import { DUE_FORMATS, type DueFormat } from '@sulo/core/prefs';
import type { UnixSeconds } from '@sulo/core/types';
import type { TaskRow } from '@sulo/core/view/popup-view';
import { rowMenuNav, type RowMenuEvent, type RowMenuView } from './row-menu-nav';

export interface SnoozeOption {
  label: string;
  until: UnixSeconds;
}

function MenuButton({ label, children, triggerRef }: { label: string; children: ReactNode; triggerRef?: Ref<HTMLButtonElement> }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenuTrigger asChild>
          <Button ref={triggerRef} size="icon-sm" variant="ghost" aria-label={label}>
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
  /** Omitted while another account is detected (its courses are hidden). */
  onManageCourses?: () => void;
  onOpenReminders?: () => void;
  onOpenDashboard: () => void;
  /** The dashboard's Settings page (where "Hapus semua data" lives, at the bottom). */
  onOpenSettings: () => void;
  /** The ⚙ button, so the dialog can return focus to it when it closes. */
  triggerRef?: Ref<HTMLButtonElement>;
}

/** Small settings menu for M2; the full settings page comes with the dashboard (M5a). */
export function SettingsMenu({ dueFormat, onSetDueFormat, onSetLocale, onManageCourses, onOpenReminders, onOpenDashboard, onOpenSettings, triggerRef }: SettingsMenuProps) {
  const { m, locale } = useI18n();
  const s = m.popup.settings;
  return (
    <DropdownMenu>
      <MenuButton label={s.button} triggerRef={triggerRef}>
        <SettingsIcon className="size-4" />
      </MenuButton>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={onOpenDashboard}>{s.openDashboard}</DropdownMenuItem>
        {onManageCourses && <DropdownMenuItem onSelect={onManageCourses}>{s.manageCourses}</DropdownMenuItem>}
        {onOpenReminders && (
          <DropdownMenuItem onSelect={onOpenReminders}>{s.reminders}</DropdownMenuItem>
        )}
        {(onManageCourses || onOpenReminders) && <DropdownMenuSeparator />}
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpenSettings}>{s.button}</DropdownMenuItem>
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

/**
 * Per-task menu: mark as done, snooze the reminder, add to Google Calendar
 * (a link the user opens). Opens on click. "Tunda pengingat" drills down in
 * place (same menu, same width) instead of opening a side submenu, which the
 * 380 px popup could not fit. Navigation rules live in row-menu-nav.ts.
 */
export function RowMenu({ row, snoozeOptions, onDone, onAddToCalendar, onSnooze }: RowMenuProps) {
  const { m } = useI18n();
  const r = m.popup.row;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<RowMenuView>('main');
  const contentRef = useRef<HTMLDivElement>(null);
  const cameBack = useRef(false);

  // After a view change, keep keyboard focus inside the menu: the first
  // choice in the snooze view, or "Tunda pengingat" when coming back.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const content = contentRef.current;
      if (!content) return;
      const target =
        view === 'snooze'
          ? content.querySelector<HTMLElement>('[role="menuitem"]')
          : cameBack.current
            ? content.querySelector<HTMLElement>('[data-snooze-entry]')
            : null;
      target?.focus();
      cameBack.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [view, open]);

  const apply = (event: RowMenuEvent) => {
    const next = rowMenuNav(view, event);
    if (next.view !== view) {
      cameBack.current = next.view === 'main';
      setView(next.view);
    }
    if (next.effect === 'close') setOpen(false);
    return next;
  };

  const choices = snoozeOptions.filter((o) => row.dueAt !== null && o.until < row.dueAt);
  const itemClass = 'gap-2 py-1.5';

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) apply({ type: 'open' });
      }}
    >
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={r.menu(row.name)} className={`row-menu ${ROW_ACTION} ${ROW_ACTION_SHOWN}`}>
          <MoreIcon />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        ref={contentRef}
        align="end"
        side="bottom"
        sideOffset={4}
        collisionPadding={8}
        className="w-56 rounded-lg border border-border bg-surface p-1 text-foreground shadow-none ring-0"
        onEscapeKeyDown={(e) => {
          // Escape in the snooze view goes back; the next one closes.
          if (apply({ type: 'key', key: 'Escape', onSnoozeItem: false }).effect === 'keepOpen') e.preventDefault();
        }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          const onSnoozeItem = (e.target as HTMLElement).hasAttribute('data-snooze-entry');
          if (apply({ type: 'key', key: e.key, onSnoozeItem }).effect === 'keepOpen') e.preventDefault();
        }}
      >
        <div
          key={view}
          className={`duration-150 animate-in fade-in-0 ${view === 'snooze' ? 'slide-in-from-right-2' : 'slide-in-from-left-2'}`}
        >
          {view === 'main' ? (
            <>
              <DropdownMenuItem className={itemClass} onSelect={onDone}>
                <CheckIcon className="size-4" />
                {r.markDone}
              </DropdownMenuItem>
              {row.dueAt !== null && (
                <DropdownMenuItem
                  className={itemClass}
                  data-snooze-entry=""
                  aria-haspopup="menu"
                  aria-expanded={false}
                  onSelect={(e) => {
                    e.preventDefault();
                    apply({ type: 'enterSnooze' });
                  }}
                >
                  <ClockIcon className="size-4" />
                  <span className="flex-1">{r.snooze}</span>
                  {row.snoozedUntil !== null && <span aria-hidden="true" className="size-1.5 rounded-full bg-foreground" />}
                  <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                </DropdownMenuItem>
              )}
              {row.dueAt !== null && (
                <DropdownMenuItem className={itemClass} onSelect={onAddToCalendar}>
                  <CalendarPlusIcon className="size-4" />
                  {r.addToCalendar}
                </DropdownMenuItem>
              )}
            </>
          ) : (
            <>
              <DropdownMenuItem
                className={`${itemClass} text-muted-foreground`}
                onSelect={(e) => {
                  e.preventDefault();
                  apply({ type: 'back' });
                }}
              >
                <ChevronLeftIcon className="size-4" />
                {r.back}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {choices.map((o) => (
                <DropdownMenuItem key={o.label} className={`${itemClass} pl-8`} onSelect={() => onSnooze(o.until)}>
                  {r.snoozeFor(o.label)}
                </DropdownMenuItem>
              ))}
              {row.snoozedUntil !== null && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className={`${itemClass} pl-8`} onSelect={() => onSnooze(null)}>
                    {r.unsnooze}
                  </DropdownMenuItem>
                </>
              )}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

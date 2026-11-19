import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import { BellIcon, ChevronLeftIcon } from '../icons';
import { Button } from '../ui/button';
import { formatClock } from '@sulo/core/format/time';
import { changeUrl, describeChange } from '@sulo/core/radar/describe';
import { UPDATE_CATEGORIES, type UpdateCategory, type UpdateSettings } from '@sulo/core/radar/settings';
import { addDays, localParts } from '@sulo/core/reminders/zoned';
import { Chip } from '../mobile/cards';
import { SwitchRow } from '../ui/switch-row';
import { courseTint } from '../mobile/tint';
import type { ChangeLogEntry, UnixSeconds } from '@sulo/core/types';

// "Kabar terbaru": the change log grouped by local day, newest first. Built
// to move to the dashboard in M5a unchanged: no popup-specific state inside.

export interface UpdatesPanelProps {
  entries: readonly ChangeLogEntry[];
  courseNames: Readonly<Record<string, string>>;
  /** Course color numbers by id: the course shows as a tinted chip (the phone's), or as plain text without one. */
  courseColors?: Readonly<Record<string, number>>;
  now: UnixSeconds;
  timeZone: string;
  settings: UpdateSettings;
  onOpen: (url: string) => void;
  onMarkAllSeen: () => void;
  onChangeSettings: (next: UpdateSettings) => void;
  /** Shown as a back button when the panel lives inside the popup. */
  onBack?: () => void;
  /** Inside a page that already has the title (dashboard): the heading is for screen readers only. */
  embedded?: boolean;
  /** The "notify me about" checkboxes under the list; the dashboard moves them into a popover. */
  showSettings?: boolean;
  /** Replaces the default one-line empty state. */
  empty?: ReactNode;
}

function dayLabel(at: UnixSeconds, now: UnixSeconds, timeZone: string, today: string, yesterday: string, intl: string): string {
  const key = localParts(at, timeZone).dateKey;
  const todayKey = localParts(now, timeZone).dateKey;
  if (key === todayKey) return today;
  if (key === addDays(todayKey, -1)) return yesterday;
  return new Intl.DateTimeFormat(intl, { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(at * 1000));
}

function Entry({ entry, course, color, timeZone, onOpen }: { entry: ChangeLogEntry; course: string; color?: number; timeZone: string; onOpen: (url: string) => void }) {
  const { m } = useI18n();
  const url = changeUrl(entry.change);
  const body = (
    <>
      <span className="flex items-start gap-2">
        {!entry.seen && <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-foreground" />}
        <span className={`min-w-0 flex-1 text-(length:--fs-body) leading-(--lh-body) ${entry.seen ? 'text-foreground/85' : 'font-semibold'}`}>{describeChange(entry.change, timeZone, m)}</span>
        <span className="shrink-0 text-[12px] leading-(--lh-body) text-muted-foreground tabular-nums">{formatClock(entry.at, timeZone, m)}</span>
      </span>
      {color === undefined ? (
        <span className={`mt-0.5 block truncate text-[12px] leading-(--lh-caption) text-muted-foreground ${entry.seen ? '' : 'pl-3.5'}`} title={course}>{course}</span>
      ) : (
        <span className={`mt-1 flex text-foreground ${entry.seen ? '' : 'pl-3.5'}`} title={course}>
          <Chip small color={courseTint(color)}>
            {course}
          </Chip>
        </span>
      )}
    </>
  );
  return (
    <li>
      {url ? (
        <button
          type="button"
          onClick={() => onOpen(url)}
          className="block w-full rounded-lg px-3 py-2 text-left outline-none hover:bg-surface-raised focus-ring:ring-2 focus-ring:ring-focus"
        >
          {body}
          {!entry.seen && <span className="sr-only">{m.popup.updates.markerNew}</span>}
        </button>
      ) : (
        <div className="px-3 py-2">{body}</div>
      )}
    </li>
  );
}

/** "Beri tahu saya tentang": the four kinds and the quiet-hours note. Shared by the panel and the dashboard's popover; one source (prefs.updates). */
export function UpdateSettingsChecks({ settings, onChange }: { settings: UpdatesPanelProps['settings']; onChange: UpdatesPanelProps['onChangeSettings'] }) {
  const { m } = useI18n();
  const u = m.popup.updates;
  return (
    <>
      {UPDATE_CATEGORIES.map((c: UpdateCategory) => (
        <SwitchRow key={c} checked={settings[c]} onChange={(v) => onChange({ ...settings, [c]: v })}>
          {u.categories[c]}
        </SwitchRow>
      ))}
      <p className="pt-1 text-[12px] leading-(--lh-caption) text-muted-foreground">{u.settingsNote}</p>
    </>
  );
}

export function UpdatesPanel({ entries, courseNames, courseColors, now, timeZone, settings, onOpen, onMarkAllSeen, onChangeSettings, onBack, embedded = false, showSettings = true, empty }: UpdatesPanelProps) {
  const { m } = useI18n();
  const u = m.popup.updates;
  const days = new Map<string, ChangeLogEntry[]>();
  for (const e of entries) {
    const label = dayLabel(e.at, now, timeZone, u.today, u.yesterday, m.intl);
    days.set(label, [...(days.get(label) ?? []), e]);
  }
  const unseen = entries.some((e) => !e.seen);
  const courseOf = (e: ChangeLogEntry) => (e.change.courseId === null ? u.otherCourse : (courseNames[String(e.change.courseId)] ?? u.otherCourse));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-1 px-2 pt-2.5 pb-1.5">
        {onBack && (
          <Button size="icon-sm" variant="ghost" aria-label={u.back} onClick={onBack}>
            <ChevronLeftIcon className="size-4" />
          </Button>
        )}
        {embedded ? <h2 className="sr-only">{u.title}</h2> : <h1 className="flex-1 font-heading text-[17px] leading-5">{u.title}</h1>}
        {embedded && <span className="flex-1" />}
        {unseen && (
          <Button size="sm" variant="ghost" onClick={onMarkAllSeen}>
            {u.markAll}
          </Button>
        )}
      </header>
      <div className="flex-1 overflow-y-auto pb-2">
        {entries.length === 0 ? (
          (empty ?? <p className="px-4 py-6 text-center text-(length:--fs-body) text-muted-foreground">{u.empty}</p>)
        ) : (
          [...days.entries()].map(([label, list]) => (
            <section key={label} className="px-1 pt-1">
              <h2 className="px-3 py-1.5 text-(length:--fs-caption) font-semibold text-muted-foreground">{label}</h2>
              <ul>
                {list.map((e) => (
                  <Entry key={e.id} entry={e} course={courseOf(e)} color={e.change.courseId === null ? undefined : courseColors?.[String(e.change.courseId)]} timeZone={timeZone} onOpen={onOpen} />
                ))}
              </ul>
            </section>
          ))
        )}
        {showSettings && (
          <section className="mx-4 mt-2 border-t border-border pt-3">
            <h2 className="flex items-center gap-1.5 text-(length:--fs-caption) font-semibold text-muted-foreground">
              <BellIcon className="size-3.5" aria-hidden="true" />
              {u.settings}
            </h2>
            <UpdateSettingsChecks settings={settings} onChange={onChangeSettings} />
          </section>
        )}
      </div>
    </div>
  );
}

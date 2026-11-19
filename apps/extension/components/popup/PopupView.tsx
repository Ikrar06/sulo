import { lazy, Suspense, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '@sulo/ui/i18n';
import { ChevronRightIcon, RefreshIcon } from '@sulo/ui/icons';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { Button } from '@sulo/ui/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@sulo/ui/ui/tooltip';
import type { CopyScope } from '@sulo/core/format/copy-list';
import { formatAgo, formatClock } from '@sulo/core/format/time';
import type { ReminderSettings } from '@sulo/core/reminders/settings';
import { addDays, localParts, zonedToUnix } from '@sulo/core/reminders/zoned';
import type { Locale } from '@sulo/core/i18n';
import type { DueFormat } from '@sulo/core/prefs';
import { useQuietRefresh } from '@/components/quiet-refresh';
import { BrandMark } from '@/components/BrandMark';
import { COLLAPSE_MS, UNDO_MS } from '@sulo/core/tasks/done-undo';
import { GROUP_ORDER } from '@sulo/core/tasks/group';
import type { RequestLogEntry } from '@sulo/core/net/scheduler';
import type { UnixSeconds } from '@sulo/core/types';
import type { MascotState, PopupView as View, TaskRow } from '@sulo/core/view/popup-view';
import { useCountdownTicker } from '@/components/countdown-ticker';
import { formatDateKey, type Countdown } from '@sulo/core/calendar/countdown';
import { CopyMenu, SettingsMenu, type SnoozeOption } from './Menus';
// Rarely opened panels load on demand, so opening the popup stays light.
const RemindersPanel = lazy(() => import('@sulo/ui/reminders/RemindersPanel').then((mod) => ({ default: mod.RemindersPanel })));
const UpdatesPanel = lazy(() => import('@sulo/ui/updates/UpdatesPanel').then((mod) => ({ default: mod.UpdatesPanel })));
import type { UpdateSettings } from '@sulo/core/radar/settings';
import { StatusLine } from './StatusLine';
import { MismatchScreen } from './AccountScreens';
import { Group, type DoneLinger } from './TaskRows';

export interface PopupActions {
  onDone: (eventId: number) => void;
  /** Urungkan on a row just marked done. */
  onUndo: (eventId: number) => void;
  onOpenTask: (url: string) => void;
  onAddToCalendar: (row: TaskRow) => void;
  /** Resolves true when the click sent nothing and the data is recent ("Sudah terbaru"). */
  onRefresh: () => Promise<boolean>;
  onCopy: (scope: CopyScope) => void;
  onOpenOnboarding: (hash?: string) => void;
  onOpenSikola: () => void;
  onReport: () => void;
  onOpenPrivacy: () => void;
  onSetDueFormat: (format: DueFormat) => void;
  onSetLocale: (locale: Locale) => void;
  onSnooze: (eventId: number, until: UnixSeconds | null) => void;
  onSetReminders: (settings: ReminderSettings) => void;
  onTestNotification: () => Promise<void>;
  onSetUpdates: (settings: UpdateSettings) => void;
  onMarkAllSeen: () => void;
  /** Another account: "Pakai akun ini" and "Nanti". */
  onUseNewAccount: () => void;
  onDeferAccount: () => void;
  /** "Hapus semua data", after the confirmation dialog. */
  /** Opens the dashboard at a page hash, e.g. "#kalender" ('' = Ringkasan). */
  onOpenDashboard: (hash: string) => void;
}

/** Inert actions for the onboarding example card and the dev preview. */
export const NO_ACTIONS: PopupActions = {
  onDone: () => {},
  onUndo: () => {},
  onOpenTask: () => {},
  onAddToCalendar: () => {},
  onRefresh: async () => false,
  onCopy: () => {},
  onOpenOnboarding: () => {},
  onOpenSikola: () => {},
  onReport: () => {},
  onOpenPrivacy: () => {},
  onSetDueFormat: () => {},
  onSetLocale: () => {},
  onSnooze: () => {},
  onSetReminders: () => {},
  onTestNotification: async () => {},
  onSetUpdates: () => {},
  onMarkAllSeen: () => {},
  onUseNewAccount: () => {},
  onDeferAccount: () => {},
  onOpenDashboard: () => {},
};

export interface PopupViewProps extends PopupActions {
  view: View;
  now: UnixSeconds;
  timeZone: string;
  dueFormat: DueFormat;
  reminders: ReminderSettings;
  /** Open the reminder settings panel on first render (dev preview). */
  updatesSettings: UpdateSettings;
  initialPanel?: 'reminders' | 'updates';
  /** Increment to play the celebrate sequence (last task marked done). */
  celebrate?: number;
  note?: string | null;
  /** Static mascot (also automatic under prefers-reduced-motion). */
  mascotStill?: boolean;
  /** Dev and tester builds: request counters and the request log. */
  dev?: {
    openMs: number | null;
    budgetLimit: number;
    callLimit: number;
    requestLog: readonly RequestLogEntry[];
    /** Development builds only: one session-time call, to verify nosessionupdate. */
    onProbeSession?: () => Promise<string>;
  } | null;
  /**
   * Example card in onboarding: no header mascot (a larger one perches on the
   * card) and no footer (the page already shows the disclaimer once).
   */
  sample?: boolean;
}

/** Development builds only (lazy, so production and tester bundles never contain it). */
const DevPanel = import.meta.env.MODE === 'development' ? lazy(() => import('./DevPanel')) : null;

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={label} onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function countdownText(c: Countdown, t: ReturnType<typeof useI18n>['m']): string {
  const k = t.popup.important;
  switch (c.kind) {
    case 'today':
      return k.today;
    case 'tomorrow':
      return k.tomorrow;
    case 'days':
      return k.days(c.n);
    case 'ongoing':
      return k.ongoing(formatDateKey(c.until, t.intl, { day: 'numeric', month: 'short' }));
    case 'ongoingOpen':
      return k.ongoingOpen;
  }
}

/** One quiet line under the title: the nearest academic date and its countdown. */
function ImportantLine({ judul, countdown, onOpen }: { judul: string; countdown: Countdown; onOpen: () => void }) {
  const { m } = useI18n();
  const when = countdownText(countdown, m);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={m.popup.important.open(`${judul}, ${when}`)}
      className="mx-3 flex w-[calc(100%-24px)] items-baseline gap-2 rounded-md px-1 pb-1.5 text-left text-[12.5px] leading-4 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus"
    >
      <span className="shrink-0 font-semibold tabular-nums">{when}</span>
      <span className="min-w-0 truncate text-muted-foreground">{judul}</span>
    </button>
  );
}

function EmptyState({ celebrate, still }: { celebrate: number; still?: boolean }) {
  const t = useI18n().m.popup;
  return (
    <div className="flex flex-col items-center px-6 pt-6 pb-8 text-center">
      <Mascot state="all-done" size={132} celebrate={celebrate} still={still} grounded />
      <p className="mt-3 font-heading text-[17px]">{t.emptyTitle}</p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{t.emptyBody}</p>
    </div>
  );
}

export function PopupView(props: PopupViewProps) {
  const { view, now } = props;
  const { m } = useI18n();
  const t = m.popup;
  const listRef = useRef<HTMLDivElement>(null);
  useCountdownTicker(listRef, props.dueFormat === 'countdown' && !props.sample, props.timeZone, m);
  const [panel, setPanel] = useState<'list' | 'reminders' | 'updates'>(props.initialPanel ?? 'list');
  const settingsRef = useRef<HTMLButtonElement>(null);
  const mismatch = view.screen === 'mismatch';
  const celebrate = props.celebrate ?? 0;
  // Snooze choices: 1 hour, 3 hours, tomorrow morning at the chosen time.
  const snoozeOptions = useMemo<SnoozeOption[]>(() => {
    const tomorrow = zonedToUnix(addDays(localParts(now, props.timeZone).dateKey, 1), props.reminders.snoozeMorningMin, props.timeZone);
    return [
      { label: m.time.hours(1), until: now + 3600 },
      { label: m.time.hours(3), until: now + 3 * 3600 },
      { label: t.row.snoozeMorning(formatClock(tomorrow, props.timeZone, m)), until: tomorrow },
    ];
  }, [now, props.timeZone, props.reminders.snoozeMorningMin, m, t]);
  const due = { format: props.dueFormat, now, timeZone: props.timeZone, snoozeOptions };
  const openReminders = () => setPanel('reminders');
  // Another account: the stored account's update time is hidden too.
  const quiet = useQuietRefresh(props.onRefresh);
  const updated =
    view.screen === 'mismatch' ? '' : view.syncing ? t.updating : quiet.upToDate ? t.upToDate : view.lastSyncAt ? t.updatedAgo(formatAgo(view.lastSyncAt, now, m)) : t.neverUpdated;
  // Rows marked done stay in place as "Selesai · Urungkan" for 5 seconds, then close (no toast in the popup).
  const [lingering, setLingering] = useState<(DoneLinger & { token: number })[]>([]);
  const token = useRef(0);
  const markDone = (eventId: number) => {
    const g = view.groups.find((x) => x.rows.some((r) => r.eventId === eventId));
    const index = g ? g.rows.findIndex((r) => r.eventId === eventId) : -1;
    const mine = ++token.current;
    if (g) setLingering((l) => [...l.filter((x) => x.row.eventId !== eventId), { row: g.rows[index]!, group: g.key, index, leaving: false, token: mine }]);
    props.onDone(eventId);
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => setLingering((l) => l.map((x) => (x.token === mine ? { ...x, leaving: true } : x))), UNDO_MS);
    window.setTimeout(() => setLingering((l) => l.filter((x) => x.token !== mine)), UNDO_MS + (still ? 0 : COLLAPSE_MS));
  };
  const undo = (eventId: number) => {
    setLingering((l) => l.filter((x) => x.row.eventId !== eventId));
    props.onUndo(eventId);
  };
  const rowActions = { ...props, onDone: markDone, onUndo: undo };
  // A group emptied by a just-done row still shows that row until it leaves.
  const groups = GROUP_ORDER.flatMap((key) => {
    const g = view.groups.find((x) => x.key === key);
    if (g) return [g];
    return lingering.some((l) => l.group === key) ? [{ key, rows: [], collapsedByDefault: false }] : [];
  });
  const empty = view.onboarded && groups.length === 0;

  return (
    <TooltipProvider delayDuration={450}>
      <div className="flex max-h-[560px] w-[380px] flex-col bg-background text-foreground">
        {panel === 'reminders' ? (
          <Suspense fallback={null}>
          <RemindersPanel
            settings={props.reminders}
            timeZone={props.timeZone}
            onChange={props.onSetReminders}
            onTest={props.onTestNotification}
            onBack={() => setPanel('list')}
            onOpenUpdates={() => setPanel('updates')}
          />
          </Suspense>
        ) : panel === 'updates' ? (
          <Suspense fallback={null}>
          <UpdatesPanel
            entries={view.updates}
            courseNames={view.courseNames}
            now={now}
            timeZone={props.timeZone}
            settings={props.updatesSettings}
            onOpen={props.onOpenTask}
            onMarkAllSeen={props.onMarkAllSeen}
            onChangeSettings={props.onSetUpdates}
            onBack={() => setPanel('list')}
          />
          </Suspense>
        ) : (
          <>
        <header className="flex items-center gap-2.5 px-3 pt-3 pb-2">
          {!props.sample && <BrandMark size={28} />}
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-[17px] leading-5">{t.title}</h1>
            <p className="truncate text-[12px] leading-4 text-muted-foreground">{updated}</p>
          </div>
          {(view.onboarded || mismatch) && (
            <div className="flex items-center">
              <IconButton label={t.refresh} onClick={quiet.click} disabled={view.syncing}>
                <RefreshIcon className={`size-4 ${view.syncing ? 'motion-safe:animate-spin' : quiet.spinning ? 'motion-safe:animate-[spin_300ms_ease-out_1]' : ''}`} />
              </IconButton>
              {!mismatch && <CopyMenu onCopy={props.onCopy} />}
              <SettingsMenu
                dueFormat={props.dueFormat}
                onSetDueFormat={props.onSetDueFormat}
                onSetLocale={props.onSetLocale}
                onManageCourses={mismatch ? undefined : () => props.onOpenOnboarding('#courses')}
                onOpenReminders={mismatch ? undefined : openReminders}
                onOpenDashboard={() => props.onOpenDashboard('')}
                onOpenSettings={() => props.onOpenDashboard('#pengaturan')}
                triggerRef={settingsRef}
              />
            </div>
          )}
        </header>

        {view.important && !props.sample && (
          <ImportantLine judul={view.important.judul} countdown={view.important.countdown} onOpen={() => props.onOpenDashboard('#kalender')} />
        )}
        <div ref={listRef} className="flex-1 overflow-y-auto pb-2">
          <div className="space-y-2 px-3">
            {view.banner && <StatusLine banner={view.banner} now={now} actions={{ ...props, onOpenReminders: openReminders }} />}
            {props.note && (
              <p role="status" className="px-1 text-[12px] text-muted-foreground">
                {props.note}
              </p>
            )}
            {view.onboarded && view.reviewSuggestedCount > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-raised px-3 py-2.5 text-[13px] leading-snug">
                <span>{t.reviewCourses(view.reviewSuggestedCount)}</span>
                <Button size="xs" variant="outline" className="shrink-0" onClick={() => props.onOpenOnboarding('#courses')}>
                  {t.review}
                </Button>
              </div>
            )}
          </div>

          {mismatch ? (
            <MismatchScreen deferred={view.mismatchDeferred} still={props.mascotStill} onUseNew={props.onUseNewAccount} onDefer={props.onDeferAccount} />
          ) : !view.onboarded ? (
            <div className="flex flex-col items-center px-8 pt-4 pb-8 text-center">
              <Mascot state="onboarding" size={116} still={props.mascotStill} />
              <p className="mt-3 font-heading text-[17px]">{t.notOnboardedTitle}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{t.notOnboardedBody}</p>
              <Button className="mt-4" onClick={() => props.onOpenOnboarding()}>
                {t.continueSetup}
              </Button>
            </div>
          ) : empty ? (
            <EmptyState celebrate={celebrate} still={props.mascotStill} />
          ) : (
            <div className="px-1">
              {groups.map((g) => (
                <Group key={g.key} group={g} due={due} actions={rowActions} lingering={lingering.filter((l) => l.group === g.key)} />
              ))}
            </div>
          )}

          {view.onboarded && !props.sample && (
            <div className="px-1 pt-1">
              <button
                type="button"
                onClick={() => setPanel('updates')}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] outline-none hover:bg-surface-raised focus-ring:ring-2 focus-ring:ring-focus"
              >
                {view.updatesUnseen > 0 && <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-amber" />}
                <span className={`flex-1 ${view.updatesUnseen > 0 ? 'font-semibold' : 'text-muted-foreground'}`}>
                  {view.updatesUnseen > 0 ? m.popup.updates.line(view.updatesUnseen) : m.popup.updates.lineNone}
                </span>
                <ChevronRightIcon className="size-3.5 text-muted-foreground" />
              </button>
            </div>
          )}

          {view.onboarded && (view.inactiveCourseTaskCount > 0 || view.probablySubmittedCount > 0) && (
            <div className="space-y-1 px-4 pt-2 text-[12px] leading-4 text-muted-foreground">
              {view.inactiveCourseTaskCount > 0 && (
                <button type="button" className="block text-left underline-offset-2 hover:text-foreground hover:underline" onClick={() => props.onOpenOnboarding('#courses')}>
                  {t.inactiveTasks(view.inactiveCourseTaskCount)}
                </button>
              )}
              {view.probablySubmittedCount > 0 && <p>{t.probablySubmitted(view.probablySubmittedCount)}</p>}
            </div>
          )}
          {props.dev && DevPanel && (
            <Suspense fallback={null}>
              <DevPanel view={view} dev={props.dev} />
            </Suspense>
          )}
        </div>

          </>
        )}

        {!props.sample && <footer className="flex items-center justify-between border-t border-border px-4 py-2 text-[11.5px] text-muted-foreground">
          <span>{m.disclaimerShort}</span>
          <button type="button" className="underline-offset-2 hover:text-foreground hover:underline" onClick={props.onOpenPrivacy}>
            {m.privacyLink}
          </button>
        </footer>}
      </div>
    </TooltipProvider>
  );
}


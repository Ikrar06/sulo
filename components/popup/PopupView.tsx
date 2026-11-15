import { useRef, type ReactNode } from 'react';
import { useI18n } from '@/components/i18n';
import { RefreshIcon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CopyScope } from '@/lib/format/copy-list';
import { formatAgo } from '@/lib/format/time';
import type { Locale } from '@/lib/i18n';
import type { DueFormat } from '@/lib/prefs';
import type { RequestSource, UnixSeconds } from '@/lib/types';
import type { MascotState, PopupView as View, TaskRow } from '@/lib/view/popup-view';
import { useCountdownTicker } from './countdown';
import { CopyMenu, SettingsMenu } from './Menus';
import { StatusLine } from './StatusLine';
import { Group } from './TaskRows';

export interface PopupActions {
  onDone: (eventId: number) => void;
  onOpenTask: (url: string) => void;
  onAddToCalendar: (row: TaskRow) => void;
  onRefresh: () => void;
  onCopy: (scope: CopyScope) => void;
  onOpenOnboarding: (hash?: string) => void;
  onOpenSikola: () => void;
  onReport: () => void;
  onOpenPrivacy: () => void;
  onSetDueFormat: (format: DueFormat) => void;
  onSetLocale: (locale: Locale) => void;
}

/** Inert actions for the onboarding example card and the dev preview. */
export const NO_ACTIONS: PopupActions = {
  onDone: () => {},
  onOpenTask: () => {},
  onAddToCalendar: () => {},
  onRefresh: () => {},
  onCopy: () => {},
  onOpenOnboarding: () => {},
  onOpenSikola: () => {},
  onReport: () => {},
  onOpenPrivacy: () => {},
  onSetDueFormat: () => {},
  onSetLocale: () => {},
};

export interface PopupViewProps extends PopupActions {
  view: View;
  now: UnixSeconds;
  timeZone: string;
  dueFormat: DueFormat;
  /** Increment to play the celebrate sequence (last task marked done). */
  celebrate?: number;
  note?: string | null;
  /** Static mascot (also automatic under prefers-reduced-motion). */
  mascotStill?: boolean;
  dev?: { openMs: number | null; budgetLimit: number } | null;
  /**
   * Example card in onboarding: no header mascot (a larger one perches on the
   * card) and no footer (the page already shows the disclaimer once).
   */
  sample?: boolean;
}

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

function DevPanel({ view, dev }: { view: View; dev: NonNullable<PopupViewProps['dev']> }) {
  const t = useI18n().m.popup;
  const sources = Object.entries(view.budget.bySource ?? {}) as [RequestSource, number][];
  return (
    <details className="mx-3 rounded-md border border-dashed border-border px-2 py-1 text-2xs text-muted-foreground">
      <summary>{t.dev.title}</summary>
      <p className="tabular-nums">{t.dev.requests(view.budget.used, dev.budgetLimit)}</p>
      <ul className="tabular-nums">
        {sources.map(([s, n]) => (
          <li key={s}>
            {t.dev.sources[s]}: {n}
          </li>
        ))}
      </ul>
      <p className="tabular-nums">{t.dev.withCourseList(view.budget.withCourseList ?? 0)}</p>
      {dev.openMs !== null && <p className="tabular-nums">{t.dev.openMs(dev.openMs)}</p>}
    </details>
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
  const celebrate = props.celebrate ?? 0;
  const due = { format: props.dueFormat, now, timeZone: props.timeZone };
  const updated = view.syncing ? t.updating : view.lastSyncAt ? t.updatedAgo(formatAgo(view.lastSyncAt, now, m)) : t.neverUpdated;
  const empty = view.onboarded && view.groups.length === 0;
  const headerMascot: MascotState = empty && view.mascot === 'all-done' ? 'idle' : view.mascot;

  return (
    <TooltipProvider delayDuration={450}>
      <div className="flex max-h-[560px] w-[380px] flex-col bg-background text-foreground">
        <header className="flex items-center gap-2.5 px-3 pt-3 pb-2">
          {!props.sample && <Mascot state={headerMascot} size={36} celebrate={empty ? 0 : celebrate} still={props.mascotStill} />}
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-[17px] leading-5">{t.title}</h1>
            <p className="truncate text-[12px] leading-4 text-muted-foreground">{updated}</p>
          </div>
          {view.onboarded && (
            <div className="flex items-center">
              <IconButton label={t.refresh} onClick={props.onRefresh} disabled={view.syncing}>
                <RefreshIcon className={`size-4 ${view.syncing ? 'motion-safe:animate-spin' : ''}`} />
              </IconButton>
              <CopyMenu onCopy={props.onCopy} />
              <SettingsMenu
                dueFormat={props.dueFormat}
                onSetDueFormat={props.onSetDueFormat}
                onSetLocale={props.onSetLocale}
                onManageCourses={() => props.onOpenOnboarding('#courses')}
              />
            </div>
          )}
        </header>

        <div ref={listRef} className="flex-1 overflow-y-auto pb-2">
          <div className="space-y-2 px-3">
            {view.banner && <StatusLine banner={view.banner} now={now} actions={props} />}
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

          {!view.onboarded ? (
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
              {view.groups.map((g) => (
                <Group key={g.key} group={g} due={due} actions={props} />
              ))}
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
          {props.dev && <DevPanel view={view} dev={props.dev} />}
        </div>

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

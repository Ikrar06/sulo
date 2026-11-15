import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, CopyIcon, RefreshIcon, SettingsIcon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CopyFormat, CopyScope } from '@/lib/format/copy-list';
import { formatAgo } from '@/lib/format/time';
import { id } from '@/lib/i18n/id';
import type { Urgency } from '@/lib/tasks/group';
import type { RequestSource, UnixSeconds } from '@/lib/types';
import type { Banner, MascotState, PopupView as View, TaskGroupView, TaskRow } from '@/lib/view/popup-view';

const t = id.popup;

const URGENCY_TEXT: Record<Urgency, string> = {
  overdue: 'text-urgency-overdue',
  day: 'text-urgency-soon',
  threeDays: 'text-urgency-week',
  normal: 'text-urgency-normal',
};
const URGENCY_DOT: Record<Urgency, string> = {
  overdue: 'bg-urgency-overdue',
  day: 'bg-urgency-soon',
  threeDays: 'bg-urgency-week',
  normal: 'bg-urgency-normal',
};

export interface PopupActions {
  onDone: (eventId: number) => void;
  onOpenTask: (url: string) => void;
  onRefresh: () => void;
  onCopy: (scope: CopyScope, format: CopyFormat) => void;
  onOpenOnboarding: (hash?: string) => void;
  onOpenSikola: () => void;
  onReport: () => void;
  onOpenPrivacy: () => void;
}

export interface PopupViewProps extends PopupActions {
  view: View;
  now: UnixSeconds;
  mascotOverride?: MascotState;
  copiedNote?: string | null;
  dev?: { openMs: number | null; budgetLimit: number } | null;
}

function BannerView({ banner, actions }: { banner: Banner; actions: PopupActions }) {
  const b = id.banner;
  const base = 'flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-xs';
  switch (banner.kind) {
    case 'disabled_remotely':
      return <p role="status" className={`${base} border-status-disabled`}>{banner.message || b.disabledFallback}</p>;
    case 'session_expired':
      return (
        <div role="status" className={`${base} border-status-stale`}>
          <span>{b.sessionExpired}</span>
          <Button size="xs" onClick={actions.onOpenSikola}>
            {b.openSikola}
          </Button>
        </div>
      );
    case 'parser_broken':
      return (
        <div role="status" className={`${base} border-status-broken`}>
          <span>{b.parserBroken}</span>
          <Button size="xs" variant="outline" onClick={actions.onReport}>
            {b.report}
          </Button>
        </div>
      );
    case 'budget_exhausted':
      return <p role="status" className={`${base} border-border`}>{b.budget}</p>;
    case 'offline':
      return <p role="status" className={`${base} border-status-offline`}>{b.offline}</p>;
    case 'stale':
      return (
        <div role="status" className={`${base} border-status-stale`}>
          <span>{b.stale(banner.hours)}</span>
          <Button size="xs" variant="outline" onClick={actions.onRefresh}>
            {b.syncNow}
          </Button>
        </div>
      );
  }
}

function Row({ row, onDone, onOpenTask }: { row: TaskRow; onDone: (id: number) => void; onOpenTask: (url: string) => void }) {
  return (
    <li className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-raised focus-within:bg-surface-raised">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${URGENCY_DOT[row.urgency]}`} />
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="w-10 shrink-0 truncate text-2xs font-semibold text-muted-foreground tabular-nums">{row.courseLabel}</span>
        </TooltipTrigger>
        <TooltipContent>{row.courseName}</TooltipContent>
      </Tooltip>
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left text-sm hover:underline focus-visible:underline"
        onClick={() => onOpenTask(row.url)}
        title={row.name}
      >
        {row.name}
      </button>
      <Button
        size="xs"
        variant="outline"
        className="hidden shrink-0 group-hover:inline-flex group-focus-within:inline-flex"
        onClick={() => onDone(row.eventId)}
      >
        {t.done}
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`shrink-0 text-xs tabular-nums ${URGENCY_TEXT[row.urgency]}`}>{row.remaining}</span>
        </TooltipTrigger>
        {row.fullDate && <TooltipContent>{row.fullDate}</TooltipContent>}
      </Tooltip>
      <button type="button" aria-label={t.openTask(row.name)} className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => onOpenTask(row.url)}>
        <ChevronRightIcon className="size-4" />
      </button>
    </li>
  );
}

function Group({ group, onDone, onOpenTask }: { group: TaskGroupView; onDone: (id: number) => void; onOpenTask: (url: string) => void }) {
  const [open, setOpen] = useState(!group.collapsedByDefault);
  const label = `${t.groups[group.key]} (${group.rows.length})`;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between px-2 pt-2 pb-1 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        <span className="tabular-nums">{label}</span>
        <ChevronDownIcon className={`size-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul>
          {group.rows.map((row) => (
            <Row key={row.eventId} row={row} onDone={onDone} onOpenTask={onOpenTask} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CopyMenu({ onCopy }: { onCopy: (scope: CopyScope, format: CopyFormat) => void }) {
  const formats: CopyFormat[] = ['plain', 'whatsapp', 'markdown'];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <CopyIcon className="size-3.5" />
          {t.copy.button}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {(['week', 'all'] as CopyScope[]).map((scope, i) => (
          <div key={scope}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{t.copy[scope]}</DropdownMenuLabel>
            {formats.map((f) => (
              <DropdownMenuItem key={f} onSelect={() => onCopy(scope, f)}>
                {t.copy[f]}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DevPanel({ view, dev }: { view: View; dev: NonNullable<PopupViewProps['dev']> }) {
  const sources = Object.entries(view.budget.bySource ?? {}) as [RequestSource, number][];
  return (
    <details className="rounded-md border border-dashed border-border px-2 py-1 text-2xs text-muted-foreground">
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

export function PopupView(props: PopupViewProps) {
  const { view, now } = props;
  const mascot = props.mascotOverride ?? view.mascot;
  const synced = view.syncing ? t.syncing : view.lastSyncAt ? t.syncedAgo(formatAgo(view.lastSyncAt, now)) : t.neverSynced;

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex max-h-[560px] w-[380px] flex-col bg-background text-foreground">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Mascot state={mascot} size={32} />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg leading-tight">{t.title}</h1>
            <p className="truncate text-2xs text-muted-foreground tabular-nums">{synced}</p>
          </div>
          {view.onboarded && (
            <>
              <Button size="icon-sm" variant="ghost" aria-label={t.refresh} title={t.refresh} onClick={props.onRefresh} disabled={view.syncing}>
                <RefreshIcon className={`size-4 ${view.syncing ? 'motion-safe:animate-spin' : ''}`} />
              </Button>
              <CopyMenu onCopy={props.onCopy} />
              <Button size="icon-sm" variant="ghost" aria-label={t.manageCourses} title={t.manageCourses} onClick={() => props.onOpenOnboarding('#courses')}>
                <SettingsIcon className="size-4" />
              </Button>
            </>
          )}
        </header>

        <div className="flex-1 space-y-2 overflow-y-auto px-2 py-2">
          {view.banner && <BannerView banner={view.banner} actions={props} />}
          {props.copiedNote && (
            <p role="status" className="px-2 text-xs text-muted-foreground">
              {props.copiedNote}
            </p>
          )}

          {!view.onboarded ? (
            <div className="space-y-3 px-2 py-6 text-center">
              <p className="font-heading text-base">{t.notOnboardedTitle}</p>
              <p className="text-sm text-muted-foreground">{t.notOnboardedBody}</p>
              <Button onClick={() => props.onOpenOnboarding()}>{t.continueSetup}</Button>
            </div>
          ) : (
            <>
              {view.reviewSuggestedCount > 0 && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs">
                  <span>{t.reviewCourses(view.reviewSuggestedCount)}</span>
                  <Button size="xs" variant="outline" onClick={() => props.onOpenOnboarding('#courses')}>
                    {t.review}
                  </Button>
                </div>
              )}
              {view.groups.length === 0 ? (
                <div className="space-y-1 px-2 py-8 text-center">
                  <p className="text-sm">{t.empty}</p>
                  <p className="text-xs text-muted-foreground">{t.emptyHint}</p>
                </div>
              ) : (
                view.groups.map((g) => <Group key={g.key} group={g} onDone={props.onDone} onOpenTask={props.onOpenTask} />)
              )}
              <div className="space-y-0.5 px-2 pt-1 text-2xs text-muted-foreground">
                {view.inactiveCourseTaskCount > 0 && (
                  <button type="button" className="block text-left underline-offset-2 hover:underline" onClick={() => props.onOpenOnboarding('#courses')}>
                    {t.inactiveTasks(view.inactiveCourseTaskCount)}
                  </button>
                )}
                {view.probablySubmittedCount > 0 && <p>{t.probablySubmitted(view.probablySubmittedCount)}</p>}
              </div>
            </>
          )}
          {props.dev && <DevPanel view={view} dev={props.dev} />}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-border px-3 py-1.5 text-2xs text-muted-foreground">
          <span className="truncate">{id.disclaimerShort}</span>
          <button type="button" className="shrink-0 underline-offset-2 hover:underline" onClick={props.onOpenPrivacy}>
            {id.privacyLink}
          </button>
        </footer>
      </div>
    </TooltipProvider>
  );
}

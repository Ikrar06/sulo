// One compact status line, the same in the popup and on the dashboard's data
// pages: a small line icon in a status color, the text, and an action when
// there is one. No box, no colored edge, no tinted background; the mascot's
// expression carries the mood. No quota numbers, ever (those are dev only).
// Sizes follow the surface's caption scale (--fs-caption: 12.5 in the popup,
// 12 on the dashboard).

import type { ReactNode } from 'react';
import { browserTimeZone, formatDue, localeOf } from '@sulo/core/format/time';
import type { UnixSeconds } from '@sulo/core/types';
import type { Banner } from '@sulo/core/view/popup-view';
import { useI18n } from './i18n';
import { AlertIcon, BellOffIcon, ClockIcon, KeyIcon, OfflineIcon, PauseIcon } from './icons';

export interface StatusActions {
  onOpenSikola: () => void;
  /** "Salin info" for a sync that could not read SIKOLA. */
  onReport: () => void;
  onRefresh: () => void;
  onOpenReminders: () => void;
}

export function StatusLine({ banner, actions, className = 'px-3 py-1.5' }: { banner: Banner; now?: UnixSeconds; actions: StatusActions; className?: string }): ReactNode {
  const { m } = useI18n();
  const b = m.banner;
  const icon = 'size-4 shrink-0';
  const since = (at: UnixSeconds | null) => (at ? formatDue(at, localeOf(m), browserTimeZone()) : null);
  const line = (Icon: ReactNode, text: string, action?: [string, () => void]) => (
    <div role="status" className={`flex items-center gap-2.5 text-(length:--fs-caption) leading-(--lh-caption) ${className}`}>
      {Icon}
      <span className="min-w-0 flex-1 text-foreground/85">{text}</span>
      {action && (
        <button
          type="button"
          onClick={action[1]}
          className="shrink-0 rounded-sm font-medium text-foreground underline-offset-2 outline-none hover:underline focus-ring:ring-2 focus-ring:ring-focus"
        >
          {action[0]}
        </button>
      )}
    </div>
  );
  switch (banner.kind) {
    case 'disabled_remotely':
      return line(<PauseIcon className={`${icon} text-status-disabled`} />, banner.message || b.disabledFallback);
    case 'session_expired':
      // Calm: a muted icon, the time of the data still shown, and "Masuk lagi" (M7.2).
      return line(<KeyIcon className={`${icon} text-muted-foreground`} />, b.sessionExpired(since(banner.lastSyncAt)), [b.signIn, actions.onOpenSikola]);
    case 'offline':
      return line(<OfflineIcon className={`${icon} text-status-offline`} />, b.offline);
    case 'syncing':
      // A small ring turning (still under reduced motion); the old data stays below.
      return line(<span aria-hidden="true" className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground border-r-transparent motion-reduce:animate-none" />, b.syncing);
    case 'parser_broken':
      return line(<AlertIcon className={`${icon} text-status-broken`} />, b.parserBroken, [b.report, actions.onReport]);
    case 'limit':
      return line(<PauseIcon className={`${icon} text-status-disabled`} />, b.limit);
    case 'saver':
      return line(<ClockIcon className={`${icon} text-status-stale`} />, b.saver);
    case 'stale':
      return line(<ClockIcon className={`${icon} text-status-stale`} />, b.stale(since(banner.lastSyncAt)), [b.refreshNow, actions.onRefresh]);
    case 'notifications_off':
      return line(<BellOffIcon className={`${icon} text-status-disabled`} />, b.notificationsOff, [b.notificationsHow, actions.onOpenReminders]);
  }
}

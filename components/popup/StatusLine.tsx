import type { ReactNode } from 'react';
import { useI18n } from '@/components/i18n';
import { BellOffIcon, ClockIcon, KeyIcon, OfflineIcon, PauseIcon } from '@/components/icons';
import { browserTimeZone, formatDue, localeOf } from '@/lib/format/time';
import type { UnixSeconds } from '@/lib/types';
import type { Banner } from '@/lib/view/popup-view';

export interface StatusActions {
  onOpenSikola: () => void;
  onReport: () => void;
  onRefresh: () => void;
  onOpenReminders: () => void;
}

/**
 * One compact status line under the header: a small line icon in a status
 * color, the text, and an action when there is one. No box, no colored edge,
 * no tinted background; the mascot's expression carries the mood.
 */
export function StatusLine({ banner, now, actions }: { banner: Banner; now: UnixSeconds; actions: StatusActions }) {
  const { m } = useI18n();
  const b = m.banner;
  const icon = 'size-4 shrink-0';
  const line = (Icon: ReactNode, text: string, action?: [string, () => void]) => (
    <div role="status" className="flex items-center gap-2.5 px-3 py-1.5 text-[12.5px] leading-[17px]">
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
      return line(<KeyIcon className={`${icon} text-status-stale`} />, b.sessionExpired, [b.openSikola, actions.onOpenSikola]);
    case 'offline':
      return line(<OfflineIcon className={`${icon} text-status-offline`} />, b.offline);
    case 'stale':
      return line(<ClockIcon className={`${icon} text-status-stale`} />, b.stale(banner.lastSyncAt ? formatDue(banner.lastSyncAt, localeOf(m), browserTimeZone()) : null), [
        b.refreshNow,
        actions.onRefresh,
      ]);
    case 'notifications_off':
      return line(<BellOffIcon className={`${icon} text-status-disabled`} />, b.notificationsOff, [b.notificationsHow, actions.onOpenReminders]);
  }
}

import { ClockIcon, ExternalIcon, KeyIcon } from '@/components/icons';
import { SIKOLA_LOGIN_URL } from '@/lib/links';
import { formatDue } from '@/lib/format/time';
import type { DashMessages } from '@/lib/i18n/dashboard';
import type { Banner } from '@/lib/view/popup-view';

/**
 * One notice under the page header on data pages, from the same selector as
 * the popup (bannerFor in lib/view/popup-view.ts). Only what the user can act
 * on: an expired session, or data that could not be updated for 12 hours.
 * A full-width card with a faint tint, a 16 px icon, 14 px text and at most
 * one action; no colored edge.
 */
export function StatusNotice({ banner, d, locale, timeZone, className = '' }: { banner: Banner | null; d: DashMessages; locale: 'id' | 'en'; timeZone: string; className?: string }) {
  if (!banner) return null;
  const n = d.notice;
  if (banner.kind === 'session_expired')
    return (
      <div role="status" className={`db-notice flex flex-wrap items-center gap-3 rounded-xl border border-border px-5 py-3 ${className}`}>
        <KeyIcon aria-hidden="true" className="size-4 shrink-0 text-foreground" />
        <p className="min-w-0 flex-1 text-[14px]">{n.sessionExpired}</p>
        <a
          href={SIKOLA_LOGIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[14px] font-medium outline-none hover:bg-surface-raised focus-ring:ring-2 focus-ring:ring-focus"
        >
          {n.openSikola}
          <ExternalIcon className="size-3.5 text-muted-foreground" />
        </a>
      </div>
    );
  if (banner.kind === 'stale' && banner.lastSyncAt !== null)
    return (
      <div role="status" className={`db-notice flex items-center gap-3 rounded-xl border border-border px-5 py-3 ${className}`}>
        <ClockIcon aria-hidden="true" className="size-4 shrink-0 text-foreground" />
        <p className="min-w-0 flex-1 text-[14px]">{n.stale(formatDue(banner.lastSyncAt, locale, timeZone))}</p>
      </div>
    );
  return null;
}

import type { ComponentType, ReactNode, SVGProps } from 'react';
import { browser } from 'wxt/browser';
import { useI18n } from '@/components/i18n';
import { ChevronRightIcon, RefreshIcon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { Button } from '@/components/ui/button';
import { useQuietRefresh } from '@/components/quiet-refresh';
import { formatAgo } from '@/lib/format/time';
import { PAGES, routeHash, type Page } from '@/lib/dashboard/routes';
import type { DashMessages } from '@/lib/i18n/dashboard';
import { BookIcon, CalendarIcon, GearIcon, HelpIcon, HomeIcon, InfoIcon, NewsIcon, TasksIcon } from './icons';
import './dashboard.css';

// One plain background for the whole page, like onboarding: no panels with
// gradients, no glows, no colored edge lines. Depth from thin borders and
// the --bg / --surface difference.

const ICONS: Record<Page, ComponentType<SVGProps<SVGSVGElement>>> = {
  ringkasan: HomeIcon,
  tugas: TasksIcon,
  'mata-kuliah': BookIcon,
  kabar: NewsIcon,
  kalender: CalendarIcon,
  pengaturan: GearIcon,
  bantuan: HelpIcon,
  tentang: InfoIcon,
};

export interface ShellProps {
  page: Page;
  d: DashMessages;
  /** Unseen "Kabar terbaru" entries, shown as a count next to the link. */
  unseen: number;
  lastSyncAt: number | null;
  now: number;
  syncing: boolean;
  /** Resolves true when the click sent nothing and the data is recent ("Sudah terbaru"). */
  onRefresh: (() => Promise<boolean>) | null;
  /** The refresh button's text ("Perbarui" by default; "Muat ulang daftar" on Mata kuliah). */
  refreshLabel?: string;
  /** "Diperbarui 5 menit lalu" next to the button; off where it would mislead. */
  showUpdated?: boolean;
  onOpenPrivacy: () => void;
  children: ReactNode;
}

export function DashboardShell({ page, d, unseen, lastSyncAt, now, syncing, onRefresh, refreshLabel, showUpdated = true, onOpenPrivacy, children }: ShellProps) {
  const { m } = useI18n();
  const quiet = useQuietRefresh(onRefresh ?? (async () => false));
  const updated = syncing ? d.common.updating : quiet.upToDate ? m.popup.upToDate : lastSyncAt ? m.popup.updatedAgo(formatAgo(lastSyncAt, now, m)) : m.popup.neverUpdated;
  return (
    <div className="db-layout">
      <aside className="db-side">
        <a href={routeHash('ringkasan')} className="db-brand rounded-lg outline-none focus-ring:ring-2 focus-ring:ring-focus">
          <Mascot state="idle" size={32} still />
          <span className="font-heading text-[20px]">Sulo</span>
        </a>
        <nav aria-label={d.nav.label} className="db-nav">
          {PAGES.map((p) => {
            const Icon = ICONS[p];
            const current = p === page;
            return (
              <a
                key={p}
                href={routeHash(p)}
                aria-current={current ? 'page' : undefined}
                // Active: --nav-active (3:1 on the sidebar) with semibold text and icon in text color. Hover: half as strong, weight unchanged.
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] whitespace-nowrap outline-none focus-ring:ring-2 focus-ring:ring-focus ${
                  current ? 'bg-nav-active font-semibold text-foreground' : 'text-muted-foreground hover:bg-nav-hover hover:text-foreground'
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{d.nav[p]}</span>
                {p === 'kabar' && unseen > 0 && (
                  <span className="min-w-6 rounded-full bg-surface-raised px-2 text-center text-[12px] leading-5 font-semibold text-foreground tabular-nums">{unseen}</span>
                )}
              </a>
            );
          })}
        </nav>
        <footer className="db-side-footer flex flex-col gap-1 text-[12px] leading-normal text-muted-foreground">
          <span>{m.disclaimerShort}</span>
          <span className="flex items-center gap-1.5">{/* lint-ui-allow: 6 px separator gap, as specified */}
            <button type="button" className="rounded underline-offset-2 outline-none hover:text-foreground hover:underline focus-ring:ring-2 focus-ring:ring-focus" onClick={onOpenPrivacy}>
              {m.privacyLink}
            </button>
            <span aria-hidden="true">·</span>
            {/* Read from the manifest, never written by hand. */}
            <span className="tabular-nums">v{browser.runtime.getManifest().version}</span>
          </span>
        </footer>
      </aside>
      <main className="db-main">
        <header className="db-header">
          <h1 className="font-heading text-[20px] leading-8">{d.nav[page]}</h1>
          {onRefresh && (
            <div className="flex items-center gap-3">
              {showUpdated && (
                <span className="text-[12px] text-muted-foreground" role="status">
                  {updated}
                </span>
              )}
              <Button variant="outline" onClick={quiet.click} disabled={syncing}>
                <RefreshIcon className={`size-4 ${syncing ? 'motion-safe:animate-spin' : quiet.spinning ? 'motion-safe:animate-[spin_300ms_ease-out_1]' : ''}`} />
                {refreshLabel ?? d.common.refresh}
              </Button>
            </div>
          )}
        </header>
        <div className="db-content">{children}</div>
      </main>
    </div>
  );
}

/**
 * A section with a quiet heading; depth from the border and --surface only.
 * Padding 20, title 16 px semibold, 12 px between title and body.
 */
export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-surface p-5 ${className}`}>
      {(title || action) && (
        // Baseline-aligned with the title; in a narrow card the action moves under it instead of breaking into two lines.
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          {title && <h2 className="text-[16px] leading-6 font-semibold">{title}</h2>}
          {action && <div className="shrink-0 whitespace-nowrap">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** "Lihat semua …" in a card header: 14 px muted with a 14 px chevron. */
export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="inline-flex items-center gap-1 rounded text-[14px] text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-ring:ring-2 focus-ring:ring-focus">
      {children}
      <ChevronRightIcon className="size-3.5 self-center" />
    </a>
  );
}

import type { ComponentType, ReactNode, SVGProps } from 'react';
import { browser } from 'wxt/browser';
import { useI18n } from '@/components/i18n';
import { RefreshIcon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { Button } from '@/components/ui/button';
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
  onRefresh: (() => void) | null;
  onOpenPrivacy: () => void;
  children: ReactNode;
}

export function DashboardShell({ page, d, unseen, lastSyncAt, now, syncing, onRefresh, onOpenPrivacy, children }: ShellProps) {
  const { m } = useI18n();
  const updated = syncing ? d.common.updating : lastSyncAt ? m.popup.updatedAgo(formatAgo(lastSyncAt, now, m)) : m.popup.neverUpdated;
  return (
    <div className="db-layout">
      <aside className="db-side">
        <a href={routeHash('ringkasan')} className="db-brand rounded-lg outline-none focus-ring:ring-2 focus-ring:ring-focus">
          <Mascot state="idle" size={34} still />
          <span className="font-heading text-[19px]">Sulo</span>
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
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] whitespace-nowrap outline-none focus-ring:ring-2 focus-ring:ring-focus ${
                  current ? 'bg-surface-raised font-semibold text-foreground' : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{d.nav[p]}</span>
                {p === 'kabar' && unseen > 0 && (
                  <span className="rounded-full bg-brand-amber/20 px-1.5 text-[11.5px] font-semibold text-foreground tabular-nums">{unseen}</span>
                )}
              </a>
            );
          })}
        </nav>
        <footer className="db-side-footer flex flex-col gap-1 text-[12px] leading-normal text-muted-foreground">
          <span>{m.disclaimerShort}</span>
          <span className="flex items-center gap-1.5">
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
          <h1 className="font-heading text-[26px] leading-8 tracking-[-0.01em]">{d.nav[page]}</h1>
          {onRefresh && (
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-muted-foreground" role="status">
                {updated}
              </span>
              <Button variant="outline" onClick={onRefresh} disabled={syncing}>
                <RefreshIcon className={`size-4 ${syncing ? 'motion-safe:animate-spin' : ''}`} />
                {d.common.refresh}
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
 * Padding 16 (20 when `large`), title 16 px, 12 px between title and body.
 */
export function Card({ title, action, children, className = '', large = false }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; large?: boolean }) {
  return (
    <section className={`rounded-xl border border-border bg-surface ${large ? 'p-5' : 'p-4'} ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-[16px] leading-6 font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

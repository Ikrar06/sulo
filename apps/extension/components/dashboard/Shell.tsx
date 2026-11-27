import { useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { browser } from 'wxt/browser';
import { useI18n } from '@sulo/ui/i18n';
import { RefreshIcon } from '@sulo/ui/icons';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@sulo/ui/ui/button';
import { useQuietRefresh } from '@/components/quiet-refresh';
import { HeaderToolsSlot } from './header-tools';
import { formatAgo } from '@sulo/core/format/time';
import { PAGES, routeHash, type Page } from '@sulo/core/dashboard/routes';
import type { DashMessages } from '@sulo/core/i18n/dashboard';
import {
  AttendanceIcon,
  AttendanceSolidIcon,
  BookIcon,
  BookSolidIcon,
  CalendarIcon,
  CalendarSolidIcon,
  ClockIcon,
  ClockSolidIcon,
  EyeIcon,
  EyeOffIcon,
  GearIcon,
  GearSolidIcon,
  GradeIcon,
  GradeSolidIcon,
  HelpIcon,
  HelpSolidIcon,
  HomeIcon,
  HomeSolidIcon,
  InfoIcon,
  InfoSolidIcon,
  NewsIcon,
  NewsSolidIcon,
  TasksIcon,
  TasksSolidIcon,
} from '@sulo/ui/dashboard-icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@sulo/ui/ui/tooltip';
import { neosiaWords } from '@sulo/core/i18n/neosia';
import './dashboard.css';

// One plain background for the whole page, like onboarding: no panels with
// gradients, no glows, no colored edge lines. Depth from thin borders and
// the --bg / --surface difference.

type IconType = ComponentType<SVGProps<SVGSVGElement>>;
/** Each page's drawing, and the same drawing filled for the current page. */
const ICONS: Record<Page, { line: IconType; selected: IconType }> = {
  ringkasan: { line: HomeIcon, selected: HomeSolidIcon },
  tugas: { line: TasksIcon, selected: TasksSolidIcon },
  'mata-kuliah': { line: BookIcon, selected: BookSolidIcon },
  presensi: { line: AttendanceIcon, selected: AttendanceSolidIcon },
  kabar: { line: NewsIcon, selected: NewsSolidIcon },
  kalender: { line: CalendarIcon, selected: CalendarSolidIcon },
  jadwal: { line: ClockIcon, selected: ClockSolidIcon },
  nilai: { line: GradeIcon, selected: GradeSolidIcon },
  pengaturan: { line: GearIcon, selected: GearSolidIcon },
  bantuan: { line: HelpIcon, selected: HelpSolidIcon },
  tentang: { line: InfoIcon, selected: InfoSolidIcon },
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
  /** Sidebar pages left out (Jadwal while the NEOSIA module is off). */
  hiddenPages?: ReadonlySet<Page>;
  /** Privacy mode: the eye button in the header, only on pages with names, grades or credits. */
  privacy: { on: boolean; toggle: () => void } | null;
  children: ReactNode;
}

export function DashboardShell({ page, d, unseen, lastSyncAt, now, syncing, onRefresh, refreshLabel, showUpdated = true, onOpenPrivacy, hiddenPages, privacy, children }: ShellProps) {
  const { m, locale } = useI18n();
  const nw = neosiaWords(locale);
  const quiet = useQuietRefresh(onRefresh ?? (async () => false));
  const [toolsSlot, setToolsSlot] = useState<HTMLElement | null>(null);
  const updated = syncing ? d.common.updating : quiet.upToDate ? m.popup.upToDate : lastSyncAt ? m.popup.updatedAgo(formatAgo(lastSyncAt, now, m)) : m.popup.neverUpdated;
  return (
    <div className="db-layout">
      <aside className="db-side">
        <a href={routeHash('ringkasan')} className="db-brand rounded-lg outline-none focus-ring:ring-2 focus-ring:ring-focus">
          <BrandMark size={28} />
          <span className="font-heading text-[20px]">Sulo</span>
        </a>
        <nav aria-label={d.nav.label} className="db-nav">
          {PAGES.filter((p) => !hiddenPages?.has(p)).map((p) => {
            const current = p === page;
            const Icon = current ? ICONS[p].selected : ICONS[p].line;
            return (
              <a
                key={p}
                href={routeHash(p)}
                aria-current={current ? 'page' : undefined}
                // Active: a thin surface-raised fill, semibold text, and the icon filled in text color. Hover: half that fill, weight unchanged. No gradient.
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] whitespace-nowrap outline-none focus-ring:ring-2 focus-ring:ring-focus ${
                  current ? 'bg-surface-raised font-semibold text-foreground' : 'text-muted-foreground hover:bg-nav-hover hover:text-foreground'
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
          <div className="flex items-center gap-3">
          {/* The page's own actions (header-tools.tsx), before Perbarui. */}
          <span ref={setToolsSlot} className="contents" />
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
            {/* Privacy mode: masks names, grades, GPA and credits (packages/ui/src/private.tsx). A crossed eye while on. */}
            {privacy && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" aria-pressed={privacy.on} aria-label={nw.privacyToggle} onClick={privacy.toggle}>
                      {privacy.on ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>{nw.privacyToggle}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </header>
        <div className="db-content">
          <HeaderToolsSlot.Provider value={toolsSlot}>{children}</HeaderToolsSlot.Provider>
        </div>
      </main>
    </div>
  );
}


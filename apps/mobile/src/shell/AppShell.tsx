// The app once signed in: a header with Perbarui, the screen, and the tab
// bar. Android's back button follows nav.ts; links with dashboard hashes
// (#tugas/123) and tapped reminders open the right screen. Updating happens
// only when the user asks (pull, Perbarui) or opens the app after 15
// minutes (App.tsx), always as the user's own activity.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { App as CapApp } from '@capacitor/app';
import { formatAgo } from '@sulo/core/format/time';
import { mobileDash } from '@sulo/core/i18n/mobile';
import { mobileWords } from '@sulo/core/i18n/mobile';
import { buildTaskItems } from '@sulo/core/dashboard/tasks';
import { useI18n } from '@sulo/ui/i18n';
import { RefreshIcon } from '@sulo/ui/icons';
import { ArrowLeftIcon } from '@sulo/ui/dashboard-icons';
import { back as goBack, current, open, parseScreen, selectTab, START, type NavState, type Screen, type Tab } from './nav';
import { screenForNotification } from './notify-route';
import { useMobileData } from './data';
import { PullToRefresh } from './PullToRefresh';
import { TabBar } from './TabBar';
import { Screens } from '../screens/Screens';

export interface ShellProps {
  expired: boolean;
  busy: boolean;
  note: string;
  lastSyncAt: number | null;
  onRefresh: () => void;
  onSignIn: () => void;
  onSignedOut: () => void;
  /** Set once by App when a reminder was tapped while the app was closed. */
  initialScreen?: Screen | null;
}

export function AppShell(props: ShellProps) {
  const { m, locale } = useI18n();
  const w = mobileWords(locale);
  const d = mobileDash(locale);
  const { data, platform } = useMobileData();
  const [nav, setNav] = useState<NavState>(() => (props.initialScreen ? open(START, props.initialScreen) : START));
  const navRef = useRef(nav);
  navRef.current = nav;
  const scroller = useRef<HTMLElement | null>(null);

  const go = useCallback((screen: Screen) => setNav((s) => open(s, screen)), []);

  // Dashboard links are hashes: turn them into screens, then clear the hash.
  useEffect(() => {
    const onHash = () => {
      if (!window.location.hash) return;
      go(parseScreen(window.location.hash));
      history.replaceState(null, '', window.location.pathname);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [go]);

  // Android's back button.
  useEffect(() => {
    const handle = CapApp.addListener('backButton', () => {
      const next = goBack(navRef.current);
      if (next === 'exit') void CapApp.exitApp();
      else setNav(next);
    });
    return () => void handle.then((h) => h.remove());
  }, []);

  // A reminder tapped while the app runs.
  useEffect(() => platform.notifier.onClick((id) => go(screenForNotification(id))), [platform, go]);

  // A new screen starts at the top.
  const top = current(nav);
  // (Newer WebViews return a promise from scrollTo: never return it from the effect.)
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [top.name, top.detail]);

  if (!data) return null;
  const overdue = data.user ? buildTaskItems(data.user).filter((i) => i.status === 'pending' && i.task.dueAt !== null && i.task.dueAt < data.now).length : 0;
  const title = top.name === 'tugas' && top.detail !== null ? w.app.taskTitle : top.name === 'presensi' && top.detail !== null ? w.app.presensiCourse : top.name === 'lainnya' ? w.app.lainnya : top.name === 'privasi' ? w.app.privasi : d.nav[top.name];
  const updated = props.lastSyncAt === null ? w.connected.never : w.connected.updated(formatAgo(props.lastSyncAt, data.now, m));

  return (
    <div className="db-layout m-root bg-bg text-foreground">
      <Header
        title={title}
        canGoBack={nav.stack.length > 0}
        onBack={() => setNav((s) => {
          const next = goBack(s);
          return next === 'exit' ? s : next;
        })}
        backLabel={w.app.back}
        refreshLabel={props.busy ? w.connected.refreshing : w.connected.refresh}
        busy={props.busy}
        showRefresh={!props.expired}
        onRefresh={props.onRefresh}
      />
      <main ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <PullToRefresh disabled={props.expired || props.busy} onRefresh={props.onRefresh} labels={{ pull: w.app.pull, release: w.app.release }} scroller={scroller}>
          <div className="mx-auto max-w-2xl space-y-4 px-4 pt-3 pb-6">
            {/* Presensi shows its own fetch time; one "Diperbarui" line per screen. */}
            <StatusLine expired={props.expired} note={props.note} updated={top.name === 'presensi' ? '' : updated} busy={props.busy} onSignIn={props.onSignIn} w={w} />
            <Screens screen={top} go={go} onSignedOut={props.onSignedOut} />
          </div>
        </PullToRefresh>
      </main>
      <TabBar active={nav.tab} overdue={overdue} onSelect={(tab: Tab) => setNav((s) => selectTab(s, tab))} label={w.app.tabsLabel} labels={{ ...d.nav, lainnya: w.app.lainnya }} overdueLabel={w.app.overdue} />
    </div>
  );
}

function Header(props: { title: string; canGoBack: boolean; onBack: () => void; backLabel: string; refreshLabel: string; busy: boolean; showRefresh: boolean; onRefresh: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-2">
      {props.canGoBack ? (
        <button type="button" aria-label={props.backLabel} onClick={props.onBack} className="inline-flex size-11 items-center justify-center rounded-lg outline-none focus-ring:ring-2 focus-ring:ring-focus">
          <ArrowLeftIcon className="size-5" />
        </button>
      ) : (
        <span className="w-2" aria-hidden="true" />
      )}
      <h1 className="min-w-0 flex-1 truncate text-[16px] font-semibold">{props.title}</h1>
      {props.showRefresh && (
        <button type="button" onClick={props.onRefresh} disabled={props.busy} aria-label={props.refreshLabel} className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none disabled:opacity-50 focus-ring:ring-2 focus-ring:ring-focus">
          <RefreshIcon className={`size-5 ${props.busy ? 'animate-spin motion-reduce:animate-none' : ''}`} />
        </button>
      )}
    </header>
  );
}

/** One quiet line: the session ended (with a button), a note from the last update, or when it was updated. */
function StatusLine({ expired, note, updated, busy, onSignIn, w }: { expired: boolean; note: string; updated: string; busy: boolean; onSignIn: () => void; w: ReturnType<typeof mobileWords> }): ReactNode {
  if (expired)
    return (
      <p className="flex items-center gap-3 text-[14px]" role="status">
        <span className="min-w-0 flex-1">{w.connected.expiredLine}</span>
        <button type="button" disabled={busy} onClick={onSignIn} className="inline-flex h-11 shrink-0 items-center rounded-lg bg-primary px-4 text-[14px] font-medium text-primary-foreground outline-none disabled:opacity-50 focus-ring:ring-2 focus-ring:ring-focus">
          {w.connected.signInAgain}
        </button>
      </p>
    );
  if (!note && !updated) return null;
  return (
    <p className="text-[12px] text-muted-foreground" role="status">
      {note || updated}
    </p>
  );
}

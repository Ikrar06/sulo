// The app once signed in (M8c.1, cards): a header without a rule on the
// screen's own color (the screen's 26 px name left, round buttons right;
// scrolled, the name settles to 18 on a solid background), the screen, and
// the floating tab bar, hidden on details and while the keyboard is open.
// Details get a round back button and a centered 18 px title. Android's back
// button follows nav.ts; dashboard hashes and tapped reminders open their
// screen. Updating happens only when the user asks (pull, Perbarui) or opens
// the app after 15 minutes (App.tsx); after Perbarui a short snackbar.

import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { formatAgo } from '@sulo/core/format/time';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { buildTaskItems } from '@sulo/core/dashboard/tasks';
import { routeHash } from '@sulo/core/dashboard/routes';
import { ArrowLeftIcon } from '@sulo/ui/dashboard-icons';
import { useI18n } from '@sulo/ui/i18n';
import { BellIcon, RefreshIcon } from '@sulo/ui/icons';
import { IconButton } from '@sulo/ui/mobile/controls';
import { useToast } from '@sulo/ui/ui/toast';
import { back as goBack, current, open, parseScreen, selectTab, START, type NavState, type Screen, type Tab } from './nav';
import { screenForNotification } from './notify-route';
import { useMobileData } from './data';
import { PullToRefresh } from './PullToRefresh';
import { ScreenHeaderProvider } from './screen-header';
import { ScreenRefreshProvider } from './screen-refresh';
import { TabBar, TAB_BAR_SPACE } from './TabBar';
import { TaskDateProvider } from './task-date';
import { Screens } from '../screens/Screens';
import { REFRESHED_EVENT } from '../events';

/** The data's age shows under the header only past an hour. */
export const STALE_SHOWN_SEC = 3600;
/** Scrolled this far, the header settles to its small size. */
const COMPACT_AT = 24;

/** Screens without SIKOLA data: no Perbarui there. */
const NO_DATA_SCREENS = new Set(['lainnya', 'pengaturan', 'bantuan', 'tentang', 'privasi']);

export interface ShellProps {
  expired: boolean;
  busy: boolean;
  lastSyncAt: number | null;
  /** Runs Perbarui; resolves with the line to show (empty: updated). */
  onRefresh: () => Promise<string>;
  onSignIn: () => void;
  onSignedOut: () => void;
  /** Set once by App when a reminder was tapped while the app was closed. */
  initialScreen?: Screen | null;
}

/** True while a text field has focus (the keyboard is up). */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const editable = (el: Element | null) => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes((el as HTMLInputElement).type)) || (el as HTMLElement).isContentEditable);
    const update = () => setOpen(editable(document.activeElement));
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', () => window.setTimeout(update, 0));
    return () => document.removeEventListener('focusin', update);
  }, []);
  return open;
}

export function AppShell(props: ShellProps) {
  const { m, locale } = useI18n();
  const w = mobileWords(locale);
  const d = mobileDash(locale);
  const toast = useToast();
  const { data, platform } = useMobileData();
  const [nav, setNav] = useState<NavState>(() => (props.initialScreen ? open(START, props.initialScreen) : START));
  const [online, setOnline] = useState(() => navigator.onLine);
  const [compact, setCompact] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [taskDate, setTaskDate] = useState<string | null>(null);
  const [slotMain, setSlotMain] = useState<HTMLElement | null>(null);
  const [slotEnd, setSlotEnd] = useState<HTMLElement | null>(null);
  const [slotTools, setSlotTools] = useState<HTMLElement | null>(null);
  const keyboard = useKeyboardOpen();
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

  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);

  // A reminder tapped while the app runs.
  useEffect(() => platform.notifier.onClick((id) => go(screenForNotification(id))), [platform, go]);

  // A new screen starts at the top, with its large header. (scrollTo may return a promise: never return it.)
  const top = current(nav);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setCompact(false);
    setScrolled(false);
  }, [top.name, top.detail]);
  // The date filter from Ringkasan lasts only while Tugas is open.
  useEffect(() => {
    if (nav.tab !== 'tugas') setTaskDate(null);
  }, [nav.tab]);

  const { onRefresh } = props;
  // A screen may update in its own way (Presensi); otherwise Perbarui is a sync.
  const screenRefresh = useRef<(() => Promise<string>) | null>(null);
  const refresh = useCallback(async () => {
    const note = await (screenRefresh.current ?? onRefresh)();
    window.dispatchEvent(new CustomEvent(REFRESHED_EVENT, { detail: { fresh: note === '' } }));
    const now = platform.clock.now();
    toast.show({ message: note || w.connected.updated(formatAgo(now, now, m)), duration: 2500 });
  }, [onRefresh, toast, w, m, platform]);

  if (!data) return null;
  const detail = nav.stack.length > 0;
  const overdue = data.user ? buildTaskItems(data.user).filter((i) => i.status === 'pending' && i.task.dueAt !== null && i.task.dueAt < data.now).length : 0;
  const title = top.name === 'tugas' && top.detail !== null ? w.app.taskTitle : top.name === 'presensi' && top.detail !== null ? w.app.presensiCourse : top.name === 'lainnya' ? w.app.lainnya : top.name === 'privasi' ? w.app.privasi : d.nav[top.name];
  const dataScreen = !NO_DATA_SCREENS.has(top.name);
  const stale = dataScreen && props.lastSyncAt !== null && data.now - props.lastSyncAt > STALE_SHOWN_SEC ? w.connected.updated(formatAgo(props.lastSyncAt, data.now, m)) : null;
  const notice = props.expired ? 'expired' : !online ? 'offline' : null;
  const showTabs = !detail && !keyboard;
  const actions = (
    <>
      {top.name === 'kalender' && <IconButton icon={BellIcon} label={d.kalender.notifyAria} href={routeHash('pengaturan', 'kalender')} />}
      {dataScreen && !props.expired && <IconButton icon={RefreshIcon} label={props.busy ? w.connected.refreshing : w.connected.refresh} onPress={() => void refresh()} disabled={props.busy} spinning={props.busy} />}
    </>
  );
  const small = detail || compact;

  return (
    <div className="db-layout m-root bg-m-screen text-foreground">
      <header className={`m-head relative z-20 flex shrink-0 items-center gap-2 bg-m-screen px-4 ${small ? 'm-head-small h-14' : 'min-h-16 py-3'}`}>
        {detail ? (
          <>
            <IconButton
              icon={ArrowLeftIcon}
              label={w.app.back}
              onPress={() =>
                setNav((s) => {
                  const next = goBack(s);
                  return next === 'exit' ? s : next;
                })
              }
            />
            <h1 className="min-w-0 flex-1 truncate text-center text-m18">{title}</h1>
            <span className="flex w-10 shrink-0 justify-end">{actions}</span>
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              {/* A screen may fill this with its own large header (Ringkasan); the name then stays for TalkBack. */}
              <div ref={setSlotMain} className="m-slot-main" />
              <h1 className={`m-title origin-left truncate text-m26 transition-transform duration-200 ease-out motion-reduce:transition-none ${small ? 'scale-[0.6923]' : top.name === 'ringkasan' ? 'sr-only' : ''}`}>{title}</h1>
            </div>
            <span className="flex shrink-0 items-center gap-2">
              <span ref={setSlotTools} className="contents" />
              {actions}
              <span ref={setSlotEnd} className="m-slot-end contents" />
            </span>
          </>
        )}
      </header>
      {(notice || stale) && (
        <p role="status" className="mx-4 mb-2 flex min-h-9 items-center gap-3 rounded-full bg-m-inset px-4 text-m13">
          <span className="min-w-0 flex-1 truncate">{notice === 'expired' ? w.connected.expiredLine : notice === 'offline' ? w.app.offline : stale}</span>
          {notice === 'expired' && (
            <button type="button" disabled={props.busy} onClick={props.onSignIn} className="m-hit shrink-0 rounded-full text-m13 font-medium underline underline-offset-2 outline-none focus-ring:ring-2 focus-ring:ring-focus">
              {w.connected.signInAgain}
            </button>
          )}
        </p>
      )}
      <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Scroll-edge fade under the header, only once the content has moved. */}
      <div aria-hidden="true" className={`m-fade-top pointer-events-none absolute inset-x-0 top-0 z-20 h-5 transition-opacity duration-150 motion-reduce:transition-none ${scrolled ? 'opacity-100' : 'opacity-0'}`} />
      <main
        ref={scroller}
        onScroll={(e) => {
          const y = e.currentTarget.scrollTop;
          setCompact(y > COMPACT_AT);
          setScrolled(y > 0);
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <PullToRefresh disabled={!dataScreen || props.expired || props.busy} onRefresh={() => void refresh()} labels={{ pull: w.app.pull, release: w.app.release }} scroller={scroller}>
          <div key={`${top.name}/${top.detail ?? ''}`} className={`mx-auto max-w-2xl px-4 pt-1 ${showTabs ? 'pb-[calc(88px+env(safe-area-inset-bottom))]' : 'pb-[calc(24px+env(safe-area-inset-bottom))]'} ${detail ? 'm-push' : ''}`}>{/* lint-ui-allow: the floating tab bar's height (64) plus 24, over the safe area */}
            <ScreenHeaderProvider value={{ main: slotMain, end: slotEnd, tools: slotTools }}>
              <ScreenRefreshProvider slot={screenRefresh}>
                <TaskDateProvider value={{ date: taskDate, setDate: setTaskDate }}>
                  <Screens screen={top} go={go} onSignedOut={props.onSignedOut} />
                </TaskDateProvider>
              </ScreenRefreshProvider>
            </ScreenHeaderProvider>
          </div>
        </PullToRefresh>
      </main>
      </div>
      {/* Above the floating tab bar: a 32 px fade, then the screen color solid beside and below the bar. */}
      {showTabs && <div aria-hidden="true" className="m-fade-bottom pointer-events-none fixed inset-x-0 bottom-0 z-20" style={{ height: `calc(${TAB_BAR_SPACE + 32}px + env(safe-area-inset-bottom))` }} />}
      {showTabs && <TabBar active={nav.tab} overdue={overdue} onSelect={(tab: Tab) => setNav((s) => selectTab(s, tab))} label={w.app.tabsLabel} labels={{ ...d.nav, lainnya: w.app.lainnya }} overdueLabel={w.app.overdue} />}
    </div>
  );
}

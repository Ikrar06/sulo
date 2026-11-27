// The app once signed in (M8c.1, cards): a header without a rule on the
// screen's own color (the screen's 26 px name follows the finger up to the
// round buttons' line at 18, shell/head-progress.ts), the screen, and
// the floating tab bar, hidden on details and while the keyboard is open.
// Details get a round back button and a centered 18 px title. Android's back
// button follows nav.ts; dashboard hashes and tapped reminders open their
// screen. Updating happens only when the user asks (pull, Perbarui) or opens
// the app after 15 minutes (App.tsx); after Perbarui a short snackbar.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { App as CapApp } from '@capacitor/app';
import { formatAgo } from '@sulo/core/format/time';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { buildTaskItems } from '@sulo/core/dashboard/tasks';
import { routeHash } from '@sulo/core/dashboard/routes';
import { ArrowLeftIcon } from '@sulo/ui/dashboard-icons';
import { useI18n } from '@sulo/ui/i18n';
import { BellIcon, RefreshIcon } from '@sulo/ui/icons';
import { IconButton } from '@sulo/ui/mobile/controls';
import { closeTopSheet } from '@sulo/ui/mobile/sheet-motion';
import { useToast } from '@sulo/ui/ui/toast';
import { back as goBack, current, motionBetween, open, parseScreen, START, tapTab, type NavState, type Screen, type Tab } from './nav';
import { opensSignIn, screenForNotification } from './notify-route';
import { SuloSession } from '../session';
import { readRemoteConfig } from '@sulo/core/remote/remote-config';
import { useMobileData } from './data';
import { PullToRefresh } from './PullToRefresh';
import { ScreenHeaderProvider } from './screen-header';
import { ScreenRefreshProvider } from './screen-refresh';
import { TabBar } from './TabBar';
import { TaskDateProvider } from './task-date';
import { effectiveScroll, HEAD_P_RANGE, HEAD_Q_RANGE, HEAD_S_RANGE, headProgress, useCssScrollTimeline } from './head-progress';
import { Screens } from '../screens/Screens';
import { REFRESHED_EVENT } from '../events';
import { LineSlot, SyncStatusLine, SyncUiContext } from './SyncStatusLine';
import { IDLE, type SyncUi } from './sync-status';
import { useSipakamase } from '../sipakamase/SipakamaseProvider';
import { useNeosiaIfAny } from '../neosia/NeosiaProvider';
import { endedSources } from '../relogin';

/** The data's age shows under the header only past an hour. */
export const STALE_SHOWN_SEC = 3600;

/** Screens without SIKOLA data: no Perbarui there. */
const NO_DATA_SCREENS = new Set(['lainnya', 'pengaturan', 'bantuan', 'tentang', 'privasi']);

/** "Masuk lagi ke SIKOLA untuk memperbarui." with its action words underlined (case-insensitive; plain when absent). */
function splitAction(line: string, action: string) {
  const at = line.toLowerCase().indexOf(action.toLowerCase());
  if (at < 0) return line;
  return (
    <>
      {line.slice(0, at)}
      <span className="font-medium underline underline-offset-2">{line.slice(at, at + action.length)}</span>
      {line.slice(at + action.length)}
    </>
  );
}

export interface ShellProps {
  expired: boolean;
  busy: boolean;
  /** The one updating state (shell/sync-status.ts). */
  syncUi?: SyncUi;
  /** "Coba lagi" on the failure line. */
  onRetry?: () => void;
  /** How many news the last sync found (a toast only then), and a counter that moves on each sync. */
  news?: { count: number; seq: number };
  lastSyncAt: number | null;
  /** Runs Perbarui; resolves with the line to show (empty: updated). */
  onRefresh: () => Promise<string>;
  /** SIKOLA's sign-in; resolves once it closed (signed in or not). */
  onSignIn: () => Promise<void> | void;
  onSignedOut: () => void;
  /** iPhone, "Lihat data terakhir" (read-only.ts): the kept data only, no refresh, one line that stays. */
  readOnly?: boolean;
  /** Opens the guide's "Memperbarui Sulo" part. */
  onUpdateHelp?: () => void;
  /** Set once by App when a reminder was tapped while the app was closed. */
  initialScreen?: Screen | null;
}

/** True while a text field has focus (the keyboard is up). */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const editable = (el: Element | null) => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes((el as HTMLInputElement).type)) || (el as HTMLElement).isContentEditable);
    // A field inside a sheet never flips this: the sheet covers the tab bar,
    // and a shell re-render there would land in the sheet's opening or exit frames.
    const inSheet = (el: EventTarget | null) => el instanceof Element && el.closest('.m-sheet') !== null;
    const update = () => {
      const el = document.activeElement;
      if (!inSheet(el)) setOpen(editable(el));
    };
    const onIn = (e: FocusEvent) => !inSheet(e.target) && update();
    const onOut = (e: FocusEvent) => !inSheet(e.target) && window.setTimeout(update, 0);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
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
  /** The maintainer paused Sulo (config enabled false): its message, else null. */
  const [paused, setPaused] = useState<string | null>(null);
  const [taskDate, setTaskDate] = useState<string | null>(null);
  const [slotTools, setSlotTools] = useState<HTMLElement | null>(null);
  const keyboard = useKeyboardOpen();
  const navRef = useRef(nav);
  navRef.current = nav;
  const scroller = useRef<HTMLElement | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  /** The header: the scroll progress is written here, where everything that reads it lives, not on the root (every element under the root would have its style worked out again on each scrolled frame). */
  const head = useRef<HTMLElement | null>(null);
  /** CSS scroll-driven header where supported (decided once); else a passive listener writes the same variables. */
  const [cssTimeline] = useState(useCssScrollTimeline);
  /** Where each tab's first screen was scrolled to, kept across tab switches (no state, no re-render). */
  const positions = useRef(new Map<string, number>());

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
      // An open sheet first, with its own exit animation.
      if (closeTopSheet()) return;
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

  // The global switch: no request from anywhere, no sign-in offered, one calm line.
  useEffect(() => {
    const read = () => void readRemoteConfig(platform.store).then((c) => setPaused(c.enabled ? null : c.message.trim() || w.watch.paused));
    read();
    const onVisible = () => document.visibilityState === 'visible' && read();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [platform, w]);

  // A reminder tapped while the app runs.
  // "Masuk lagi" opens SIKOLA's sign-in; after it, the sync runs and background watching starts again (App.signIn).
  const onSignIn = props.onSignIn;
  // "Masuk lagi" from a notification: every source whose session ended, one sign-in page after another
  // (owner's decision of 26 Nov 2026); each is the source's own page, the system's password autofill untouched.
  const sipakamase = useSipakamase();
  const neosia = useNeosiaIfAny();
  const reloginAll = useCallback(async () => {
    const ended = await endedSources(platform).catch(() => [] as string[]);
    if (props.expired) await onSignIn();
    if (ended.includes('Sipakamase')) await sipakamase.signIn();
    if (ended.includes('NEOSIA') && neosia) await neosia.open('login');
  }, [platform, props.expired, onSignIn, sipakamase, neosia]);
  const openNotice = useCallback((id: string) => (opensSignIn(id) ? void reloginAll() : go(screenForNotification(id))), [go, reloginAll]);
  useEffect(() => platform.notifier.onClick(openNotice), [platform, openNotice]);
  // A background-watching notification tapped (posted natively): its id waits in the worker's store.
  useEffect(() => {
    const take = () => void SuloSession.watchTakeOpen().then(({ id }) => id && openNotice(id)).catch(() => undefined);
    take();
    const onVisible = () => document.visibilityState === 'visible' && take();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [openNotice]);

  /**
   * A tab tapped. Another tab: switch. The tab already shown: a screen open on
   * top of its first one closes; already on its first screen, the list
   * scrolls back to the top (smoothly; at once under reduced motion).
   */
  const onTab = useCallback(
    (tab: Tab) => {
      const action = tapTab(navRef.current, tab);
      if (action.kind === 'scroll-top') {
        const el = scroller.current;
        if (!el || el.scrollTop === 0) return;
        const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        return;
      }
      setNav(action.next);
    },
    [],
  );

  // A tab's first screen comes back where it was left; a detail opens at the top.
  const top = current(nav);
  const screenKey = `${top.name}/${top.detail ?? ''}`;
  const isDetail = nav.stack.length > 0;
  // The screen before this one, for the direction of the change (nav.ts motionBetween); set after each commit.
  // Above the early return below: hooks run in the same order on every render.
  const shownNav = useRef(nav);
  useEffect(() => {
    shownNav.current = nav;
  }, [nav]);
  const motion = motionBetween(shownNav.current, nav);
  const writeHead = useCallback(() => {
    const el = scroller.current;
    const h = head.current;
    if (!el || !h || cssTimeline) return;
    const y = effectiveScroll(el.scrollTop, el.scrollHeight, el.clientHeight);
    h.style.setProperty('--head-p', String(headProgress(y, HEAD_P_RANGE)));
    h.style.setProperty('--head-q', String(headProgress(y, HEAD_Q_RANGE)));
    h.style.setProperty('--head-s', String(headProgress(y, HEAD_S_RANGE)));
  }, [cssTimeline]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = isDetail ? 0 : (positions.current.get(screenKey) ?? 0);
    writeHead();
  }, [screenKey, isDetail, writeHead]);
  // The CSS path animates only while there is something to scroll: an inactive scroll
  // timeline would otherwise leave the header small (the Lainnya bug). A class, not state.
  useEffect(() => {
    const el = scroller.current;
    const r = root.current;
    if (!el || !r) return;
    const check = () => {
      r.classList.toggle('m-scrollable', el.scrollHeight > el.clientHeight + 1);
      writeHead();
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.lastElementChild) ro.observe(el.lastElementChild);
    return () => ro.disconnect();
  }, [screenKey, writeHead]);

  // Follows the finger: one write per frame at most, passive, no state.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      if (!isDetail) positions.current.set(screenKey, el.scrollTop);
      if (!cssTimeline && frame === 0) frame = requestAnimationFrame(() => ((frame = 0), writeHead()));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [screenKey, isDetail, cssTimeline, writeHead]);
  // The date filter from Ringkasan lasts only while Tugas is open.
  useEffect(() => {
    if (nav.tab !== 'tugas') setTaskDate(null);
  }, [nav.tab]);

  const { onRefresh } = props;
  // A screen may update in its own way (Presensi); otherwise Perbarui is a sync.
  const screenRefresh = useRef<(() => Promise<string>) | null>(null);
  const refresh = useCallback(async () => {
    const custom = screenRefresh.current;
    const note = await (custom ?? onRefresh)();
    window.dispatchEvent(new CustomEvent(REFRESHED_EVENT, { detail: { fresh: note === '' } }));
    // A screen's own update (Presensi) keeps its toast; a sync shows the status line instead.
    if (custom) {
      const now = platform.clock.now();
      toast.show({ message: note || w.connected.updated(formatAgo(now, now, m)), duration: 2500 });
    }
  }, [onRefresh, toast, w, m, platform]);
  // A sync that found something new: the toast, as before.
  const newsSeq = props.news?.seq ?? 0;
  const newsCount = props.news?.count ?? 0;
  useEffect(() => {
    if (newsSeq === 0 || newsCount === 0) return;
    const now = platform.clock.now();
    toast.show({ message: w.connected.updated(formatAgo(now, now, m)), duration: 2500 });
  }, [newsSeq]);

  if (!data) return null;
  const detail = nav.stack.length > 0;
  const overdue = data.user ? buildTaskItems(data.user).filter((i) => i.status === 'pending' && i.task.dueAt !== null && i.task.dueAt < data.now).length : 0;
  const title = top.name === 'tugas' && top.detail !== null ? w.app.taskTitle : top.name === 'presensi' && top.detail !== null ? w.app.presensiCourse : top.name === 'lainnya' ? w.app.lainnya : top.name === 'privasi' ? w.app.privasi : d.nav[top.name];
  const dataScreen = !NO_DATA_SCREENS.has(top.name);
  const stale = dataScreen && props.lastSyncAt !== null && data.now - props.lastSyncAt > STALE_SHOWN_SEC ? w.connected.updated(formatAgo(props.lastSyncAt, data.now, m)) : null;
  const notice = paused !== null ? 'paused' : props.expired ? 'expired' : !online ? 'offline' : null;
  const syncUi = props.syncUi ?? IDLE;
  const showTabs = !detail && !keyboard;
  const actions = (
    <>
      {top.name === 'kalender' && <IconButton icon={BellIcon} label={d.kalender.notifyAria} href={routeHash('pengaturan', 'kalender')} />}
      {dataScreen && !props.expired && !props.readOnly && paused === null && <IconButton icon={RefreshIcon} label={props.busy ? w.connected.refreshing : w.connected.refresh} onPress={() => void refresh()} disabled={props.busy} spinning={props.busy} />}
    </>
  );
  const ringkasan = top.name === 'ringkasan';
  /** Main screens: the large title follows the finger to the bar's line; Ringkasan's greeting is its own large header. */
  const bigTitle = !detail && !ringkasan;

  return (
    <SyncUiContext.Provider value={syncUi}>
    <div ref={root} className={`db-layout m-root bg-m-screen text-foreground ${cssTimeline ? 'm-sdt' : ''}`}>
      {/* The bar is a sticky layer inside what scrolls: 56 px at rest, rising 8 px to 48 (layout-free, by the compositor). */}
      <main ref={scroller} className="m-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <header ref={head} className={`m-head sticky z-30 flex min-h-14 shrink-0 items-center gap-2 bg-m-screen px-4 ${detail ? 'top-0' : 'm-head-shrink'}`}>
          {detail ? (
            // Three columns so the title stays centered whatever sits on the right (a screen's tools, Perbarui).
            <div className="grid w-full grid-cols-[minmax(40px,1fr)_minmax(0,auto)_minmax(40px,1fr)] items-center gap-2">
              <span className="flex">
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
              </span>
              <h1 className="min-w-0 truncate text-center text-m18">{title}</h1>
              <span className="flex items-center justify-end gap-2">
                <span ref={setSlotTools} className="contents" />
                {actions}
              </span>
            </div>
          ) : (
            <>
              <div className="relative flex min-w-0 flex-1 items-center self-stretch">
                {/* 26 px on the buttons' line, shrinking in place toward 18 as the finger moves (transform only).
                    Both titles span the whole row and are made anew for each screen: as a transformed layer that took
                    its text's width, a shorter title left the longer one's end painted on the iPhone ("Calendarce"). */}
                {bigTitle && <h1 key={`big:${title}`} className="m-title-big min-w-0 flex-1 truncate text-m26 whitespace-nowrap">{title}</h1>}
                {/* The bar's own 18 px name: Ringkasan's, fading in near the end of its greeting; others' under reduced motion. */}
                <p key={`small:${title}`} aria-hidden="true" className={`m-title-small absolute inset-x-0 top-1/2 truncate text-m18 whitespace-nowrap ${ringkasan ? 'm-title-small-q' : ''}`}>
                  {title}
                </p>
                {ringkasan && <h1 className="sr-only">{title}</h1>}
              </div>
              {/* The round buttons never move: the bar's 8 px sticky rise is offset (m-head-still). */}
              <span className="m-head-still flex shrink-0 items-center gap-2">
                <span ref={setSlotTools} className="contents" />
                {actions}
              </span>
            </>
          )}
          {/* Scroll-edge fade just under the bar, its opacity tied to the scroll. */}
          <span aria-hidden="true" className="m-fade-top pointer-events-none absolute inset-x-0 top-full h-5" />
        </header>
        <PullToRefresh disabled={!dataScreen || props.expired || props.readOnly === true || props.busy || paused !== null} onRefresh={() => void refresh()} labels={{ pull: w.app.pull, release: w.app.release }} scroller={scroller}>
          <ScreenFrame key={`${top.name}/${top.detail ?? ''}`} motion={motion} className={`mx-auto max-w-2xl px-4 pt-1 ${showTabs ? 'pb-[calc(var(--m-bar-h)+36px+var(--m-bar-inset))]' : 'pb-[calc(24px+env(safe-area-inset-bottom))]'} ${syncUi.phase === 'done' ? 'm-data-in' : ''}`}>{/* lint-ui-allow: the floating tab bar's height (64) plus 24, over the safe area */}
      {/* The session line is the sign-in button itself (one calm line, the words of the hard rule); offline and stale are plain status. */}
            <LineSlot>
            {props.readOnly ? (
              <button type="button" onClick={props.onUpdateHelp} className="m-hit m-press mb-3 flex min-h-9 items-center rounded-2xl bg-m-inset px-4 py-2 text-left text-m13 outline-none focus-ring:ring-2 focus-ring:ring-focus">
                <span role="status" className="min-w-0">
                  {w.iphone.readOnlyBar} <span className="font-medium underline underline-offset-2">{w.iphone.howToUpdate}</span>
                </span>
              </button>
            ) : syncUi.phase !== 'idle' ? (
              <SyncStatusLine ui={syncUi} w={w} onRetry={props.onRetry ?? (() => void refresh())} />
            ) : notice === 'expired' ? (
              <button type="button" disabled={props.busy} onClick={props.onSignIn} className="m-hit m-press mb-3 flex min-h-9 items-center rounded-2xl bg-m-inset px-4 py-2 text-left text-m13 outline-none focus-ring:ring-2 focus-ring:ring-focus disabled:opacity-50">
                {/* Wraps to two lines with large text rather than cutting off the action. */}
                <span role="status" className="min-w-0">
                  {splitAction(w.connected.expiredLine, w.connected.signInAgain)}
                </span>
              </button>
            ) : (
              (notice || stale) && (
                <p role="status" className="mb-3 flex min-h-9 items-center rounded-full bg-m-inset px-4 text-m13">
                  <span className="min-w-0 truncate">{notice === 'paused' ? paused : notice === 'offline' ? w.app.offline : stale}</span>
                </p>
              )
            )}
            </LineSlot>
            <ScreenHeaderProvider value={{ main: null, end: null, tools: slotTools }}>
              <ScreenRefreshProvider slot={screenRefresh}>
                <TaskDateProvider value={{ date: taskDate, setDate: setTaskDate }}>
                  <Screens screen={top} go={go} onSignedOut={props.onSignedOut} />
                </TaskDateProvider>
              </ScreenRefreshProvider>
            </ScreenHeaderProvider>
          </ScreenFrame>
        </PullToRefresh>
      </main>
      {/* Above the floating tab bar: a 32 px fade, then the screen color solid beside and below the bar. */}
      {showTabs && <div aria-hidden="true" className="m-fade-bottom pointer-events-none fixed inset-x-0 bottom-0 z-20" style={{ height: 'calc(var(--m-bar-h) + 44px + var(--m-bar-inset))' }} />}
      {showTabs && <TabBar active={nav.tab} overdue={overdue} onSelect={onTab} label={w.app.tabsLabel} labels={{ ...d.nav, lainnya: w.app.lainnya }} overdueLabel={w.app.overdue} />}
    </div>
    </SyncUiContext.Provider>
  );
}

/**
 * The screen's box. Its motion (m-push, m-pop) is fixed when it mounts, so a later render, a sync or a status
 * line, never takes the class away halfway and cuts the slide.
 */
function ScreenFrame({ motion, className, children }: { motion: 'push' | 'pop' | null; className: string; children: ReactNode }) {
  const [enter] = useState(motion);
  return <div className={`${className}${enter ? ` m-${enter}` : ''}`}>{children}</div>;
}

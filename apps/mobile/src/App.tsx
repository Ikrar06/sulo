// The Android app's gate: the optional app lock, sign-in, the one-time
// notification question at the end of setup, then the data screens
// (shell/AppShell). Syncs happen only when the user acts: after signing in,
// on opening the app with data older than 15 minutes, pull to refresh and
// Perbarui; each is the user's own activity (nosessionupdate=false). An
// ended session keeps the data on screen with one calm line.

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { resolveLocale, type Locale } from '@sulo/core/i18n';
import { mobileWords, type MobileWords } from '@sulo/core/i18n/mobile';
import { readPrefs } from '@sulo/core/prefs';
import type { Platform } from '@sulo/core/platform';
import { readBudget, restKind } from '@sulo/core/moodle/budget';
import type { SyncOutcome, UnixSeconds } from '@sulo/core/types';
import { I18nProvider } from '@sulo/ui/i18n';
import { PrivacyProvider } from '@sulo/ui/private';
import { ToastProvider } from '@sulo/ui/ui/toast';
import { DEV_EVENT } from './events';
import { LOCK_KEY, signOutEverything } from './account';
import { refreshPublicData } from './public-data';
import { readRemoteConfig } from '@sulo/core/remote/remote-config';
import { applyWatchPlan, processWatchQueue } from './watch-native';
import { markChangesHandled } from '@sulo/core/watch/queue';
import { scheduleReminders } from './reminders';
import { LockScreen, NotifyQuestion, Onboarding } from './screens/Gate';
import { SuloSession, type SessionStatus } from './session';
import { AppShell } from './shell/AppShell';
import { MobileDataProvider, useMobileData } from './shell/data';
import { lastSyncAt, resumeNeedsSync, syncAfterLogin, syncNow } from './sync';

/** The debug screen: loaded only in debug builds; a release build has no trace of it (scripts/check-no-dev-code.mjs). */
const DevScreen = __SULO_DEV__ ? lazy(() => import('./DevScreen').then((m) => ({ default: m.DevScreen }))) : null;

/** Set once the notification question was answered (either way). */
export const NOTIFY_ASKED_KEY = 'mobile:notifyAsked';

/** `rest` says which pause refused the request when the budget did (moodle/budget.ts restKind). */
export function outcomeNote(o: SyncOutcome, w: MobileWords, rest: 'short' | 'day' = 'day'): string {
  if (o.status === 'ok' || o.status === 'session_expired') return '';
  if (o.status === 'skipped' && o.reason === 'FRESH') return w.connected.upToDate;
  // The daily limit (or the loop guard): one calm line; reminders from stored data keep running.
  if (o.status === 'skipped' && o.reason === 'BUDGET_EXHAUSTED') return rest === 'short' ? w.app.restShort : w.app.restDay;
  // Paused by the maintainer: the calm notice says so; no failure line.
  if (o.status === 'skipped' && o.reason === 'DISABLED_REMOTELY') return '';
  if (o.status === 'offline') return w.app.offline;
  return w.connected.failed;
}

export function App({ platform }: { platform: Platform }) {
  const [locale, setLocale] = useState<Locale>('id');
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [locked, setLocked] = useState(false);
  const [askNotify, setAskNotify] = useState(false);
  const [last, setLast] = useState<UnixSeconds | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [dev, setDev] = useState(false);
  const [paused, setPaused] = useState<string | null>(null);
  const w = mobileWords(locale);

  const refreshState = useCallback(async () => {
    setStatus((await SuloSession.status()).status);
    setLast(await lastSyncAt(platform));
  }, [platform]);

  /** Runs a sync and returns the line to show (empty when it went fine). */
  const sync = useCallback(
    async (run: () => Promise<SyncOutcome>): Promise<string> => {
      setBusy(true);
      setNote('');
      let line = w.connected.failed;
      try {
        const outcome = await run();
        const rest = outcome.status === 'skipped' && outcome.reason === 'BUDGET_EXHAUSTED' ? restKind(await readBudget(platform.store, platform.clock), platform.clock.now()) : 'day';
        line = outcomeNote(outcome, w, rest);
        // News found while the app is open lands in Kabar terbaru without a notification.
        await markChangesHandled(platform.store, platform.clock.now()).catch(() => 0);
        await scheduleReminders(platform).catch(() => 0);
        // A sync the user started restarts the background interval.
        await applyWatchPlan(platform).catch(() => undefined);
      } catch {
        line = w.connected.failed;
      } finally {
        await refreshState();
        setBusy(false);
      }
      setNote(line);
      return line;
    },
    [platform, refreshState, w],
  );
  const refresh = useCallback(() => sync(() => syncNow(platform, { userInitiated: true, dev: __SULO_DEV__ })), [platform, sync]);

  // Start: language, lock, state, and reminders from the data already here.
  useEffect(() => {
    void (async () => {
      const loc = resolveLocale((await readPrefs(platform.store)).locale, navigator.language);
      setLocale(loc);
      if ((await platform.store.get<boolean>(LOCK_KEY)) === true) setLocked(true);
      await refreshState();
      // The worker's answers first (before any sync), then reminders and a fresh plan.
      await processWatchQueue(platform).catch(() => null);
      await scheduleReminders(platform).catch(() => 0);
      await refreshPublicData(platform, true);
      const config = await readRemoteConfig(platform.store);
      setPaused(config.enabled ? null : config.message.trim() || mobileWords(loc).watch.paused);
      await applyWatchPlan(platform).catch(() => undefined);
    })();
    const onDev = () => __SULO_DEV__ && setDev(true);
    window.addEventListener(DEV_EVENT, onDev);
    return () => window.removeEventListener(DEV_EVENT, onDev);
  }, [platform, refreshState]);

  // Back in the foreground: lock again if on, and sync when the data is older than 15 minutes.
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      if ((await platform.store.get<boolean>(LOCK_KEY)) === true) setLocked(true);
      void refreshPublicData(platform, true);
      const s = (await SuloSession.status()).status;
      setStatus(s);
      const queue = await processWatchQueue(platform).catch(() => ({ applied: 0, fullSync: false }));
      if (queue.applied > 0) await scheduleReminders(platform).catch(() => 0);
      if (s === 'connected' && (queue.fullSync || resumeNeedsSync(await lastSyncAt(platform), platform.clock.now()))) void refresh();
      else void applyWatchPlan(platform);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [platform, refresh]);

  const signIn = async () => {
    const r = await SuloSession.login();
    if (r.status === 'cancelled') {
      setNote(w.onboarding.cancelled);
      return;
    }
    await sync(() => syncAfterLogin(platform, __SULO_DEV__));
    // The end of setup: ask about notifications once, after the data is here.
    if ((await platform.store.get<boolean>(NOTIFY_ASKED_KEY)) !== true && (await LocalNotifications.checkPermissions()).display !== 'granted') setAskNotify(true);
  };

  if (status === null) return null;
  return (
    <I18nProvider locale={locale}>
      {locked ? (
        <LockScreen
          w={w}
          onUnlocked={() => setLocked(false)}
          onSignOut={async () => {
            await signOutEverything(platform);
            setLocked(false);
            await refreshState();
          }}
        />
      ) : dev && DevScreen ? (
        <Suspense fallback={null}>
          {/* Back: the screens read the session again (a simulated ended session shows its line). */}
          <DevScreen
            platform={platform}
            w={w}
            onBack={() => {
              setDev(false);
              void refreshState();
            }}
          />
        </Suspense>
      ) : status === 'none' ? (
        <Onboarding w={w} note={note} busy={busy} paused={paused} onSignIn={() => void signIn()} />
      ) : askNotify ? (
        <NotifyQuestion
          w={w}
          onDone={async (allow) => {
            if (allow) await LocalNotifications.requestPermissions().catch(() => null);
            await platform.store.set(NOTIFY_ASKED_KEY, true);
            setAskNotify(false);
            await scheduleReminders(platform).catch(() => 0);
          }}
        />
      ) : (
        <MobileDataProvider platform={platform}>
          <Shell
            expired={status === 'expired'}
            busy={busy}
            lastSyncAt={last}
            onRefresh={refresh}
            onSignIn={() => void signIn()}
            onSignedOut={async () => {
              setNote('');
              await refreshState();
            }}
          />
        </MobileDataProvider>
      )}
    </I18nProvider>
  );
}

/** Privacy mode and the toast sit inside the data provider (they read settings). */
function Shell(props: Parameters<typeof AppShell>[0]) {
  const { data } = useMobileData();
  return (
    <PrivacyProvider value={data?.prefs.privacyMode ?? false}>
      <ToastProvider viewportClassName="bottom-[calc(72px+env(safe-area-inset-bottom))]">
        <AppShell {...props} />
      </ToastProvider>
    </PrivacyProvider>
  );
}

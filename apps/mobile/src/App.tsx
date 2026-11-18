// The Android app's gate: the optional app lock, sign-in, the one-time
// notification question at the end of setup, then the data screens
// (shell/AppShell). Syncs happen only when the user acts: after signing in,
// on opening the app with data older than 15 minutes, pull to refresh and
// Perbarui; each is the user's own activity (nosessionupdate=false). An
// ended session keeps the data on screen with one calm line.

import { useCallback, useEffect, useState } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { resolveLocale, type Locale } from '@sulo/core/i18n';
import { mobileWords, type MobileWords } from '@sulo/core/i18n/mobile';
import { readPrefs } from '@sulo/core/prefs';
import type { Platform } from '@sulo/core/platform';
import type { SyncOutcome, UnixSeconds } from '@sulo/core/types';
import { I18nProvider } from '@sulo/ui/i18n';
import { PrivacyProvider } from '@sulo/ui/private';
import { ToastProvider } from '@sulo/ui/ui/toast';
import { DevScreen } from './DevScreen';
import { DEV_EVENT } from './events';
import { LOCK_KEY, signOutEverything } from './account';
import { scheduleReminders } from './reminders';
import { LockScreen, NotifyQuestion, Onboarding } from './screens/Gate';
import { SuloSession, type SessionStatus } from './session';
import { AppShell } from './shell/AppShell';
import { MobileDataProvider, useMobileData } from './shell/data';
import { lastSyncAt, resumeNeedsSync, syncAfterLogin, syncNow } from './sync';

/** Set once the notification question was answered (either way). */
export const NOTIFY_ASKED_KEY = 'mobile:notifyAsked';

export function outcomeNote(o: SyncOutcome, w: MobileWords): string {
  if (o.status === 'ok' || o.status === 'session_expired') return '';
  if (o.status === 'skipped' && o.reason === 'FRESH') return w.connected.upToDate;
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
        line = outcomeNote(await run(), w);
        await scheduleReminders(platform).catch(() => 0);
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
      setLocale(resolveLocale((await readPrefs(platform.store)).locale, navigator.language));
      if ((await platform.store.get<boolean>(LOCK_KEY)) === true) setLocked(true);
      await refreshState();
      await scheduleReminders(platform).catch(() => 0);
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
      const s = (await SuloSession.status()).status;
      setStatus(s);
      if (s === 'connected' && resumeNeedsSync(await lastSyncAt(platform), platform.clock.now())) void refresh();
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
      ) : dev && __SULO_DEV__ ? (
        <DevScreen platform={platform} w={w} onBack={() => setDev(false)} />
      ) : status === 'none' ? (
        <Onboarding w={w} note={note} busy={busy} onSignIn={() => void signIn()} />
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

// The Android app's gate: the optional app lock, the onboarding (sign-in,
// the first sync, setup and the notification question; onboarding/), then
// the data screens (shell/AppShell), which the onboarding mascot lands on. Syncs happen only when the user acts: after signing in,
// on opening the app with data older than 15 minutes, pull to refresh and
// Perbarui; each is the user's own activity (nosessionupdate=false). An
// ended session keeps the data on screen with one calm line.

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { resolveLocale, type Locale } from '@sulo/core/i18n';
import { mobileWords, type MobileWords } from '@sulo/core/i18n/mobile';
import { onboardingWords } from '@sulo/core/i18n/mobile-onboarding';
import { readPrefs } from '@sulo/core/prefs';
import type { Platform } from '@sulo/core/platform';
import { readBudget, restKind } from '@sulo/core/moodle/budget';
import type { SyncOutcome, UnixSeconds } from '@sulo/core/types';
import { I18nProvider } from '@sulo/ui/i18n';
import { PrivacyProvider } from '@sulo/ui/private';
import { ToastProvider } from '@sulo/ui/ui/toast';
import { DEV_EVENT, REFRESHED_EVENT, REPLAY_ONBOARDING_EVENT } from './events';
import { SCENE_TEMPO_KEY, setSceneTempo } from './onboarding/motion';
import { LOCK_KEY, signOutEverything } from './account';
import { refreshPublicData } from './public-data';
import { readRemoteConfig } from '@sulo/core/remote/remote-config';
import { applyWatchPlan, processWatchQueue } from './watch-native';
import { markChangesHandled } from '@sulo/core/watch/queue';
import { scheduleReminders } from './reminders';
import { LockScreen } from './screens/Gate';
import { OnboardingFlow } from './onboarding/OnboardingFlow';
import { readSavedFlow } from './onboarding/data';
import { resume, start, type FlowState } from '@sulo/core/onboarding/mobile-flow';
import { SuloSession, type SessionStatus } from './session';
import { AppShell } from './shell/AppShell';
import { MobileDataProvider, useMobileData } from './shell/data';
import { lastSyncAt, resumeNeedsSync, syncAfterLogin, syncNow } from './sync';

/** The debug screen: loaded only in debug builds; a release build has no trace of it (scripts/check-no-dev-code.mjs). */
const DevScreen = __SULO_DEV__ ? lazy(() => import('./DevScreen').then((m) => ({ default: m.DevScreen }))) : null;

export { NOTIFY_ASKED_KEY } from './onboarding/OnboardingFlow';

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
  /** Where the onboarding is (null: not decided yet); 'finished' shows the app. */
  const [flow, setFlow] = useState<FlowState | null>(null);
  /** The onboarding mascot is landing on Ringkasan (both are mounted). */
  const [landing, setLanding] = useState(false);
  /** Ringkasan is mounted, hidden, under the done screen: "Buka Sulo" then only reveals it. */
  const [warm, setWarm] = useState(false);
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
      const signedIn = (await SuloSession.status()).status !== 'none';
      setFlow(resume(await readSavedFlow(platform), { signedIn, hasData: (await lastSyncAt(platform)) !== null }));
      // The worker's answers first (before any sync), then reminders and a fresh plan.
      await processWatchQueue(platform).catch(() => null);
      await scheduleReminders(platform).catch(() => 0);
      await refreshPublicData(platform, true);
      const config = await readRemoteConfig(platform.store);
      setPaused(config.enabled ? null : config.message.trim() || mobileWords(loc).watch.paused);
      await applyWatchPlan(platform).catch(() => undefined);
    })();
    const onDev = () => __SULO_DEV__ && setDev(true);
    // Debug builds: the scenes' pace chosen on the dev screen, and a replay of the onboarding from the first screen.
    const onReplay = () => {
      if (!__SULO_DEV__) return;
      setDev(false);
      setFlow(start('first'));
    };
    if (__SULO_DEV__) void platform.store.get<number>(SCENE_TEMPO_KEY).then((v) => typeof v === 'number' && setSceneTempo(v));
    window.addEventListener(DEV_EVENT, onDev);
    if (__SULO_DEV__) window.addEventListener(REPLAY_ONBOARDING_EVENT, onReplay);
    return () => {
      window.removeEventListener(DEV_EVENT, onDev);
      if (__SULO_DEV__) window.removeEventListener(REPLAY_ONBOARDING_EVENT, onReplay);
    };
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
    const bar = onboardingWords(locale).signin;
    const r = await SuloSession.login({ close: bar.close, offline: bar.offline, retry: bar.retry });
    if (r.status !== 'connected') {
      setNote(r.status === 'offline' ? w.app.offline : w.onboarding.cancelled);
      return;
    }
    await sync(() => syncAfterLogin(platform, __SULO_DEV__));
  };

  // pnpm mobile:web only: the screenshot and check scripts enter the demo account past the onboarding.
  useEffect(() => {
    if (!(__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web')) return;
    (window as unknown as { __suloEnterDemo?: () => Promise<void> }).__suloEnterDemo = async () => {
      await SuloSession.login();
      await sync(() => syncAfterLogin(platform, false));
      setFlow((f) => (f ? { ...f, step: 'finished' } : f));
    };
  }, [platform, sync]);

  if (status === null || flow === null) return null;
  const onboarding = flow.step !== 'finished' || landing;
  const shell = (
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
          // Keluar: back to sign-in, without the splash and intro (onboarding/data.ts keeps that mark).
          setFlow(resume(await readSavedFlow(platform), { signedIn: false, hasData: false }));
        }}
      />
    </MobileDataProvider>
  );
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
      ) : (
        <>
          {/* One place for Ringkasan, before and after the landing, so it never mounts twice. */}
          {(flow.step === 'finished' || landing || warm) && (
            // One geometry in every phase (no layout work when it is revealed): hidden and inert while it only waits under the onboarding.
            <div className={`contents ${landing ? 'm-landing' : ''} ${flow.step !== 'finished' && !landing ? 'invisible' : ''}`} inert={flow.step !== 'finished' && !landing ? true : undefined}>
              {shell}
            </div>
          )}
          {onboarding && (
            <OnboardingFlow
              platform={platform}
              locale={locale}
              initial={flow}
              paused={paused}
              landing={landing}
              onSynced={() => void refreshState()}
              onNearlyDone={() => {
                void refreshState();
                setWarm(true);
              }}
              onFinish={() => {
                // The hero greets with the same happy face the flying mascot wears (its own 1.5 s cheer), so the hand-over shows nothing.
                window.dispatchEvent(new CustomEvent(REFRESHED_EVENT, { detail: { fresh: true } }));
                setLanding(true);
                // After the landing has started: reading the state again must not share its first frame.
                window.setTimeout(() => void refreshState(), 700);
              }}
              onLanded={() => {
                setLanding(false);
                setWarm(false);
                setFlow({ ...flow, step: 'finished' });
              }}
            />
          )}
        </>
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

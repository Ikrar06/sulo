// The Android app's gate: the optional app lock, the onboarding (sign-in,
// the first sync, setup and the notification question; onboarding/), then
// the data screens (shell/AppShell), which the onboarding mascot lands on. Syncs happen only when the user acts: after signing in,
// on opening the app with data older than 15 minutes, pull to refresh and
// Perbarui; each is the user's own activity (nosessionupdate=false). An
// ended session keeps the data on screen with one calm line.

import { MascotMotionContext } from '@sulo/ui/mascot/Mascot';
import { usePerfTier } from './perf';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
import { SwitchAccount } from './onboarding/SwitchAccount';
import { holdWatching, keepPreviousAccount, switchPending, useOtherAccount } from './switch-account';
import { readSavedFlow, saveFlow } from './onboarding/data';
import { flushSheetWork } from '@sulo/ui/mobile/sheet';
import { resume, start, type FlowState } from '@sulo/core/onboarding/mobile-flow';
import { SuloSession, type SessionStatus } from './session';
import { AppShell } from './shell/AppShell';
import { MobileDataProvider, useMobileData } from './shell/data';
import { lastSyncAt, resumeNeedsSync, syncAfterLogin, syncNow } from './sync';
import { alignSession } from './session-truth';

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

/** Core's session state follows the vault; a change goes into the session history. */
async function alignAndNote(platform: Platform, vault: SessionStatus): Promise<void> {
  const changed = await alignSession(platform, vault).catch(() => null);
  if (changed) await SuloSession.note({ e: changed }).catch(() => undefined);
}

/** The idle mount of Ringkasan waits at most this long. */
const WARM_IDLE_TIMEOUT_MS = 1000;
/** "Buka Sulo" before then: the mascot waits at most this long for the hero to be there. */
const HERO_WAIT_MS = 800;

/** requestIdleCallback with a timeout, or a short timer where it is missing; returns its cancel. */
function whenIdle(fn: () => void, timeout: number): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(fn, { timeout });
    return () => cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 200);
  return () => window.clearTimeout(id);
}
/** Resolves once Ringkasan's hero spot is in the page (the landing's target), or after HERO_WAIT_MS. */
function untilHero(): Promise<void> {
  const end = performance.now() + HERO_WAIT_MS;
  return new Promise((resolve) => {
    const look = () => (document.querySelector('[data-mascot-spot="hero"]') || performance.now() > end ? resolve() : requestAnimationFrame(look));
    requestAnimationFrame(look);
  });
}

export function App({ platform }: { platform: Platform }) {
  const [locale, setLocale] = useState<Locale>('id');
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [locked, setLocked] = useState(false);
  /** Where the onboarding is (null: not decided yet); 'finished' shows the app. */
  const [flow, setFlow] = useState<FlowState | null>(null);
  /** Another SIKOLA account signed in: the "Akun berbeda" question is open (switch-account.ts). */
  const [switching, setSwitching] = useState(false);
  /** The onboarding mascot is landing on Ringkasan (both are mounted). */
  const [landing, setLanding] = useState(false);
  /** Ringkasan is mounted, hidden, under the done screen: "Buka Sulo" then only reveals it. */
  const [warm, setWarm] = useState(false);
  const warmRef = useRef(false);
  const idleMount = useRef<(() => void) | null>(null);
  const mountWarmNow = useCallback(() => {
    idleMount.current?.();
    idleMount.current = null;
    warmRef.current = true;
    setWarm(true);
  }, []);
  const mountWarmWhenIdle = useCallback(() => {
    if (warmRef.current || idleMount.current !== null) return;
    idleMount.current = whenIdle(mountWarmNow, WARM_IDLE_TIMEOUT_MS);
  }, [mountWarmNow]);
  const tier = usePerfTier();
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
  // The start effect runs once; it reaches the current refresh through this.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // Debug builds only: pnpm mobile:test-restart starts a sync like pull-to-refresh (to end the process mid-sync).
  useEffect(() => {
    if (!__SULO_DEV__) return;
    const w = window as unknown as { __suloDevSync?: () => Promise<string> };
    w.__suloDevSync = () => refreshRef.current();
    return () => void delete w.__suloDevSync;
  }, []);

  // Start: language, lock, state, and reminders from the data already here.
  useEffect(() => {
    void (async () => {
      const loc = resolveLocale((await readPrefs(platform.store)).locale, navigator.language);
      setLocale(loc);
      if ((await platform.store.get<boolean>(LOCK_KEY)) === true) setLocked(true);
      await refreshState();
      const now = (await SuloSession.status()).status;
      await alignAndNote(platform, now);
      const signedIn = now !== 'none';
      // A question left open when the app was closed: it is asked again, and nothing runs meanwhile.
      const demoSwitch = __SULO_WEB_FAKE__ && import.meta.env.MODE === 'web' && new URLSearchParams(location.search).get('switch') === '1';
      if (demoSwitch || (now === 'connected' && (await switchPending(platform)))) {
        await holdWatching();
        setSwitching(true);
      }
      setFlow(resume(await readSavedFlow(platform), { signedIn, hasData: (await lastSyncAt(platform)) !== null }));
      // The worker's answers first (before any sync), then reminders and a fresh plan.
      await processWatchQueue(platform).catch(() => null);
      await scheduleReminders(platform).catch(() => 0);
      await refreshPublicData(platform, true);
      const config = await readRemoteConfig(platform.store);
      setPaused(config.enabled ? null : config.message.trim() || mobileWords(loc).watch.paused);
      await applyWatchPlan(platform).catch(() => undefined);
      if (now === 'connected' && (await SuloSession.suspect().catch(() => ({ suspect: false }))).suspect) void refreshRef.current();
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
      // To the background: work still waiting on a closing sheet runs now (Android may end the process).
      if (document.visibilityState === 'hidden') return flushSheetWork();
      if (document.visibilityState !== 'visible') return;
      if ((await platform.store.get<boolean>(LOCK_KEY)) === true) setLocked(true);
      void refreshPublicData(platform, true);
      const s = (await SuloSession.status()).status;
      await alignAndNote(platform, s);
      setStatus(s);
      // The different-account question is open: no sync, no background plan, until it is answered.
      if (await switchPending(platform)) return;
      const queue = await processWatchQueue(platform).catch(() => ({ applied: 0, fullSync: false }));
      if (queue.applied > 0) await scheduleReminders(platform).catch(() => 0);
      // Background watching thought the session ended: only this sync (asking twice) may say so.
      const suspect = s === 'connected' && (await SuloSession.suspect().catch(() => ({ suspect: false }))).suspect;
      if (s === 'connected' && (suspect || queue.fullSync || resumeNeedsSync(await lastSyncAt(platform), platform.clock.now()))) void refresh();
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
    // Another account than the one whose data is here: the sync wrote nothing; ask.
    if (await switchPending(platform)) {
      await holdWatching();
      setSwitching(true);
    }
  };

  // pnpm mobile:web only: the screenshot and check scripts enter the demo account past the onboarding.
  useEffect(() => {
    if (!(__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web')) return;
    (window as unknown as { __suloEnterDemo?: () => Promise<void> }).__suloEnterDemo = async () => {
      await SuloSession.login();
      await sync(() => syncAfterLogin(platform, false));
      // Kept as finished, so a reload opens Ringkasan (a cold open with data, scripts/perf-measure.mjs).
      await saveFlow(platform, { step: 'finished', mode: 'first' });
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
  const lite = tier === 'lite';
  return (
    <I18nProvider locale={locale}>
      <MascotMotionContext.Provider value={{ lite }}>
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
      ) : switching ? (
        <SwitchAccount
          w={onboardingWords(locale)}
          onUse={async () => {
            await useOtherAccount(platform);
            setSwitching(false);
            // The new account: its data comes in with the onboarding from screen 5.
            setFlow(start('switch'));
            await refreshState();
          }}
          onCancel={async () => {
            await keepPreviousAccount(platform);
            await applyWatchPlan(platform).catch(() => undefined);
            await refreshState();
            setSwitching(false);
          }}
        />
      ) : (
        <>
          {/* One place for Ringkasan, before and after the landing, so it never mounts twice. */}
          {(flow.step === 'finished' || landing || warm) && (
            // One geometry in every phase (no layout work when it is revealed): hidden and inert while it only waits under the onboarding.
            <div className={`contents ${landing ? 'm-landing' : ''} ${flow.step !== 'finished' && !landing ? 'invisible' : ''}`} inert={flow.step !== 'finished' && !landing ? true : undefined}>
              {/* Waiting under the onboarding, its mascot holds still. */}
              <MascotMotionContext.Provider value={{ lite, paused: flow.step !== 'finished' && !landing }}>{shell}</MascotMotionContext.Provider>
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
              // Ringkasan's data is read now; its components mount only once the done screen's celebration is over, in idle time.
              onNearlyDone={() => void refreshState()}
              onCelebrated={() => mountWarmWhenIdle()}
              onFinish={() => {
                // "Buka Sulo": the onboarding is finished on disk now, before any landing motion
                // (a process ended during it would otherwise come back on "Semua siap").
                void saveFlow(platform, { step: 'finished', mode: flow.mode });
                const land = () => {
                  // The hero greets with the same happy face the flying mascot wears (its own 1.5 s cheer), so the hand-over shows nothing.
                  window.dispatchEvent(new CustomEvent(REFRESHED_EVENT, { detail: { fresh: true } }));
                  setLanding(true);
                  // After the landing has started: reading the state again must not share its first frame.
                  window.setTimeout(() => void refreshState(), 700);
                };
                if (warmRef.current) return land();
                // "Buka Sulo" before the idle mount: Ringkasan mounts now, and the mascot flies once its hero is there.
                mountWarmNow();
                void untilHero().then(land);
              }}
              onLanded={() => {
                setLanding(false);
                warmRef.current = false;
                setWarm(false);
                setFlow({ ...flow, step: 'finished' });
              }}
            />
          )}
        </>
      )}
      </MascotMotionContext.Provider>
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

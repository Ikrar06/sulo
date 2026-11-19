// The phone's onboarding (M8c.2): core's step machine (onboarding/
// mobile-flow.ts) drives ten screens under one persistent mascot. This file
// only dispatches events and does what a step needs: the sign-in page, the
// first sync with its real stages, and saving the choices. The flow is kept
// in storage at every step, so a closed app comes back where it makes sense.
// No request leaves the phone before sign-in.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { messagesFor, type Locale } from '@sulo/core/i18n';
import { mobileWords } from '@sulo/core/i18n/mobile';
import { onboardingWords } from '@sulo/core/i18n/mobile-onboarding';
import { back as backOf, INTRO, reduce, setupProgress, STEPS, type FlowState } from '@sulo/core/onboarding/mobile-flow';
import type { Platform } from '@sulo/core/platform';
import { readPrefs, writePrefs } from '@sulo/core/prefs';
import { greeting } from '@sulo/core/dashboard/mobile-greeting';
import type { SyncOutcome } from '@sulo/core/types';
import { closeTopSheet } from '@sulo/ui/mobile/sheet-motion';
import { refreshPublicData, readKeepAlive } from '../public-data';
import { scheduleReminders } from '../reminders';
import { SuloSession } from '../session';
import { syncAfterLogin } from '../sync';
import { updateWatch } from '../watch';
import { applyWatchPlan } from '../watch-native';
import { readCounts, readCourseChoices, readDone, readOfferedStages, readReminderSample, saveCourseChoices, saveFlow, saveStages } from './data';
import { FlyingMascotLayer } from './FlyingMascot';
import { MS } from './motion';
import { Intro } from './Intro';
import { Done, Preparing, SignIn, Splash, type DoneTile, type PrepCounts } from './screens-entry';
import { Courses, Nickname, Reminders, type CourseChoice, type ReminderSample } from './screens-setup';
import { StepSwap } from './StepSwap';
import { prepOutcome, PREP_ROWS, type StageEvent } from './stage-timing';

/** Asked once, after the data is here (App.tsx's key). */
export const NOTIFY_ASKED_KEY = 'mobile:notifyAsked';

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export interface FlowProps {
  platform: Platform;
  locale: Locale;
  initial: FlowState;
  /** The maintainer paused Sulo: no sign-in offered, the message shows. */
  paused: string | null;
  /** A sync finished (the app refreshes its own state). */
  onSynced: (o: SyncOutcome) => void;
  /** The last setup screen is showing: the app can get Ringkasan ready underneath, so "Buka Sulo" has nothing heavy left to do. */
  onNearlyDone?: () => void;
  /** The done screen's celebration is over: Ringkasan may be mounted now, in idle time. */
  onCelebrated?: () => void;
  /** "Buka Sulo": the app mounts Ringkasan underneath; the mascot flies to its hero. */
  onFinish: () => void;
  /** Ringkasan is mounted under this layer: the screen fades, the mascot lands on the hero. */
  landing?: boolean;
  /** The mascot reached the hero (or a guard ran out): the app removes this layer. */
  onLanded?: () => void;
}

export function OnboardingFlow({ platform, locale, initial, paused, onSynced, onFinish, onNearlyDone, onCelebrated, landing = false, onLanded }: FlowProps) {
  const w = onboardingWords(locale);
  const app = mobileWords(locale);
  const m = messagesFor(locale);
  const [state, dispatch] = useReducer(reduce, initial);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [courses, setCourses] = useState<{ list: CourseChoice[]; selected: Set<number> }>({ list: [], selected: new Set() });
  const [nickname, setNickname] = useState('');
  const [stages, setStages] = useState<Set<number>>(new Set([1440, 180]));
  const [sample, setSample] = useState<ReminderSample>({ title: w.reminders.sampleTitle, course: w.reminders.sampleCourse });
  const [counts, setCounts] = useState<PrepCounts>({ tasks: 0, courses: 0 });
  const [done, setDone] = useState<{ tasks: number; next: string | null; tiles: DoneTile[] } | null>(null);
  /** Intro pages whose scene has played: going back (or coming back from sign-in) never replays one. */
  const played = useRef(new Set<number>());
  const [watch, setWatch] = useState(true);
  const [watchAllowed, setWatchAllowed] = useState(false);
  /** The line under the switch while the config does not allow watching: the config's own, else a short default. */
  const [watchOff, setWatchOff] = useState('');
  const finishing = useRef(false);
  // The app's callbacks change every render; the first sync must not restart for that.
  const synced = useRef(onSynced);
  synced.current = onSynced;
  const words = useRef({ w, m, locale });
  words.current = { w, m, locale };
  const stateRef = useRef(state);
  stateRef.current = state;

  // Kept at every step, so a closed app resumes (mobile-flow.ts resume).
  useEffect(() => void saveFlow(platform, { step: state.step, mode: state.mode }), [platform, state.step, state.mode]);

  // Android's back button: an open sheet first, then one step back, or out of the app.
  useEffect(() => {
    const handle = CapApp.addListener('backButton', () => {
      if (closeTopSheet()) return;
      const b = backOf(stateRef.current);
      if (b === 'exit') void CapApp.exitApp();
      else dispatch({ type: 'BACK' });
    });
    return () => void handle.then((h) => h.remove());
  }, []);

  // Resumed past the first sync (the app was closed on a setup step): read what it found.
  useEffect(() => {
    if (!['courses', 'nickname', 'reminders'].includes(initial.step)) return;
    void (async () => {
      const choices = await readCourseChoices(platform);
      setCourses({ list: choices.courses, selected: choices.selected });
      dispatch({ type: 'SELECT', selected: choices.selected.size });
      const t = words.current;
      setSample(await readReminderSample(platform, t.w));
    })();
  }, [platform, initial.step]);

  // What the setup screens show, read once there is data.
  useEffect(() => {
    void (async () => {
      const prefs = await readPrefs(platform.store);
      setNickname(prefs.nickname);
      setStages(await readOfferedStages(platform));
      const keep = await readKeepAlive(platform).catch(() => null);
      // pnpm mobile:web: ?watch=off shows the screen as when the config does not allow watching.
      const demoOff = __SULO_WEB_FAKE__ && import.meta.env.MODE === 'web' && new URLSearchParams(location.search).get('watch') === 'off';
      setWatchAllowed(paused === null && !demoOff && (keep?.enabled ?? true));
      setWatchOff(keep?.message?.[locale] ?? app.watch.remoteOff);
    })();
  }, [platform, paused, locale, app]);

  const signIn = async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return dispatch({ type: 'SIGNIN_OFFLINE' });
    // Already signed in (a replay from the debug screen): straight on to the sync.
    if ((await SuloSession.status().catch(() => ({ status: 'none' as const }))).status === 'connected') return dispatch({ type: 'SIGNIN_OK' });
    setBusy(true);
    const r = await SuloSession.login({ close: w.signin.close, offline: w.signin.offline, retry: w.signin.retry }).catch(() => ({ status: 'cancelled' as const }));
    setBusy(false);
    dispatch({ type: r.status === 'connected' ? 'SIGNIN_OK' : r.status === 'offline' ? 'SIGNIN_OFFLINE' : 'SIGNIN_CANCELLED' });
  };

  // Screen 5: the real first sync; the calendar row is the academic calendar from the public repo (not SIKOLA).
  const runSync = useCallback(async () => {
    setEvents([]);
    const seen: StageEvent[] = [];
    const push = (e: StageEvent) => {
      seen.push(e);
      setEvents([...seen]);
      // The chips show what was really found, as soon as it is stored.
      if (e.result === 'ok' && (e.row === 'tasks' || e.row === 'courses')) void readCounts(platform).then(setCounts);
    };
    const calendar = refreshPublicData(platform, true)
      .then(() => push({ row: 'calendar', result: 'ok', at: performance.now() }))
      .catch(() => push({ row: 'calendar', result: 'failed', at: performance.now() }));
    const outcome = await syncAfterLogin(platform, __SULO_DEV__, (stage, result) => push({ row: stage, result, at: performance.now() })).catch((): SyncOutcome => ({ status: 'server_error' }));
    await calendar;
    // A stage that never ran (no follow-up, no recap) is shown as "nanti dicoba lagi".
    for (const row of PREP_ROWS) if (!seen.some((e) => e.row === row)) push({ row, result: 'failed', at: performance.now() });
    synced.current(outcome);
    await scheduleReminders(platform).catch(() => 0);
    const choices = await readCourseChoices(platform);
    setCourses({ list: choices.courses, selected: choices.selected });
    const t = words.current;
    setSample(await readReminderSample(platform, t.w));
    setCounts(await readCounts(platform));
    const result = prepOutcome(seen, outcome.status === 'ok');
    return { result, courseCount: choices.courses.length, selected: choices.selected.size };
  }, [platform]);

  const [prepFinal, setPrepFinal] = useState<{ result: 'ok' | 'partial' | 'failed'; courseCount: number; selected: number } | null>(null);
  useEffect(() => {
    if (state.step !== 'preparing' || state.prep !== 'pending') return;
    setPrepFinal(null);
    let alive = true;
    void runSync().then((r) => {
      if (!alive) return;
      setPrepFinal(r);
      // Nothing came: stay on screen 5 with Coba lagi / Lanjut tanpa data.
      if (r.result === 'failed') dispatch({ type: 'SYNC_DONE', ...r });
    });
    return () => {
      alive = false;
    };
  }, [state.step, state.prep, runSync]);

  const progress = (() => {
    const p = setupProgress(state);
    return p ? { ...p, label: w.stepOf(p.index + 1, p.total) } : null;
  })();
  const backFn = (() => {
    const b = backOf(state);
    return b === 'exit' ? null : () => dispatch({ type: 'BACK' });
  })();
  const next = () => dispatch({ type: 'NEXT' });
  const skip = () => dispatch({ type: 'SKIP' });

  const finishReminders = async (allow: boolean) => {
    await saveStages(platform, stages);
    await updateWatch(platform, { enabled: watchAllowed && watch });
    if (allow) await LocalNotifications.requestPermissions().catch(() => null);
    await platform.store.set(NOTIFY_ASKED_KEY, true);
    await scheduleReminders(platform).catch(() => 0);
    await applyWatchPlan(platform).catch(() => undefined);
    setDone(await readDone(platform, m, locale, timeZone()));
    dispatch({ type: allow ? 'NEXT' : 'SKIP' });
  };

  const finish = () => {
    if (finishing.current) return;
    finishing.current = true;
    onFinish();
  };

  // Done after switching accounts: straight to the app.
  useEffect(() => {
    if (state.step === 'finished') finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  const nearlyDone = useRef(onNearlyDone);
  nearlyDone.current = onNearlyDone;
  useEffect(() => {
    if (state.step !== 'reminders' && state.step !== 'done') return;
    // Already on the reminders screen, once it has arrived: by "Buka Sulo" the work is long done.
    const id = window.setTimeout(() => nearlyDone.current?.(), 900);
    return () => window.clearTimeout(id);
  }, [state.step]);

  // The done screen needs its line even when the reminders step was resumed past.
  useEffect(() => {
    if (state.step === 'done' && done === null) void readDone(platform, m, locale, timeZone()).then(setDone);
  }, [state.step, done, platform, m, locale]);

  const line1 = greeting({ now: platform.clock.now(), timeZone: timeZone(), nickname: '', overdue: 0, dueToday: 0 }, app).line1;

  const introIndex = INTRO.indexOf(state.step);
  const screen = (() => {
    switch (state.step) {
      case 'splash':
        return <Splash w={w} next={next} />;
      case 'intro1':
      case 'intro2':
      case 'intro3':
        return <Intro w={w} index={introIndex} played={played.current} onIndex={(index) => dispatch({ type: 'GOTO_INTRO', index })} onStart={next} onSkip={skip} />;
      case 'signin':
        return <SignIn w={w} note={state.signinNote} busy={busy} paused={paused} onOpen={() => void signIn()} onBack={backFn} />;
      case 'preparing':
        return (
          <Preparing
            w={w}
            events={events}
            counts={counts}
            final={state.prep === 'failed' ? 'failed' : (prepFinal?.result ?? 'pending')}
            onDone={() => prepFinal && dispatch({ type: 'SYNC_DONE', ...prepFinal })}
            onRetry={() => dispatch({ type: 'RETRY' })}
            onWithout={() => dispatch({ type: 'CONTINUE_WITHOUT_DATA' })}
          />
        );
      case 'courses':
        return (
          <Courses
            w={w}
            progress={progress}
            courses={courses.list}
            selected={courses.selected}
            onToggle={(id) =>
              setCourses((c) => {
                const selected = new Set(c.selected);
                if (selected.has(id)) selected.delete(id);
                else selected.add(id);
                dispatch({ type: 'SELECT', selected: selected.size });
                return { ...c, selected };
              })
            }
            onNext={async () => {
              await saveCourseChoices(platform, courses.selected);
              next();
            }}
            onBack={backFn}
          />
        );
      case 'nickname':
        return (
          <Nickname
            w={w}
            progress={progress}
            line1={line1}
            initial={nickname}
            onNext={async (name) => {
              setNickname(name);
              await writePrefs(platform.store, { nickname: name });
              next();
            }}
            onSkip={skip}
            onBack={backFn}
          />
        );
      case 'reminders':
        return <Reminders w={w} progress={progress} sample={sample} stages={stages} onStages={setStages} watch={watch} watchAllowed={watchAllowed} watchOff={watchOff} onWatch={setWatch} onAllow={() => void finishReminders(true)} onLater={() => void finishReminders(false)} onBack={backFn} />;
      case 'done':
        return done ? <Done w={w} tiles={done.tiles} tasks={done.tasks} next={done.next} onOpen={finish} onCelebrated={onCelebrated} /> : null;
      case 'finished':
        return null;
    }
  })();
  // The three intro pages are one screen (the pager); everything else swaps with a slide.
  const swapKey = introIndex >= 0 ? 'intro' : state.step;

  // The landing: the mascot flies to Ringkasan's hero with the happy face,
  // and the hero greets with the same one (App sends it a cheer), so the
  // hand-over is between two identical mascots at the same place, in one
  // frame, with nothing to see. The hero then eases to its own mood. The done screen stays the same
  // mounted instance and only fades away (no effect of it runs again).
  const landed = useRef(false);
  const arrive = useCallback(() => {
    if (landed.current) return;
    landed.current = true;
    const hero = document.querySelector<HTMLElement>(HERO_SPOT);
    const fly = document.querySelector<HTMLElement>('[data-onb-mascot]');
    // The hero shows first, then the flying one goes a frame later: the two
    // are the same mascot at the same place, so there is no fade to dip
    // through. The hero's own entrance hop stays off for this arrival.
    if (hero) {
      hero.style.animation = 'none';
      hero.style.opacity = '1';
    }
    requestAnimationFrame(() => {
      if (fly) {
        fly.style.transition = 'none';
        fly.style.opacity = '0';
      }
      requestAnimationFrame(() => onLanded?.());
    });
  }, [onLanded]);

  return (
    <FlyingMascotLayer spotKey={landing ? 'landing' : swapKey} selector={landing ? HERO_SPOT : undefined} duration={landing ? MS.landing : MS.mascotMove} onArrived={landing ? arrive : undefined} forced={landing ? { state: 'all-done' } : undefined}>
      {/* While landing, the last screen fades away over Ringkasan as it comes in. */}
      <div key="screens" aria-hidden={landing ? true : undefined} className={landing ? 'm-onb-leave pointer-events-none fixed inset-0 z-40' : 'contents'}>
        <StepSwap stepKey={swapKey} order={STEPS.indexOf(state.step)}>
          {screen}
        </StepSwap>
      </div>
      {landing && <LandingGuard key="guard" onLanded={arrive} />}
    </FlyingMascotLayer>
  );
}

/** Ringkasan's hero mascot (HeroMascot.tsx): the landing target. */
export const HERO_SPOT = '[data-mascot-spot="hero"]';

/** A guard ends the landing if the hero never shows. */
function LandingGuard({ onLanded }: { onLanded?: () => void }) {
  useEffect(() => {
    const guard = window.setTimeout(() => onLanded?.(), MS.landing + 600);
    return () => window.clearTimeout(guard);
  }, [onLanded]);
  return null;
}

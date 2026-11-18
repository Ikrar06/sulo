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
import { back as backOf, reduce, setupProgress, type FlowState } from '@sulo/core/onboarding/mobile-flow';
import type { Platform } from '@sulo/core/platform';
import { readPrefs, writePrefs } from '@sulo/core/prefs';
import { greeting } from '@sulo/core/dashboard/mobile-greeting';
import type { SyncOutcome } from '@sulo/core/types';
import type { MascotState } from '@sulo/core/view/popup-view';
import { closeTopSheet } from '@sulo/ui/mobile/sheet-motion';
import { refreshPublicData, readKeepAlive } from '../public-data';
import { scheduleReminders } from '../reminders';
import { SuloSession } from '../session';
import { syncAfterLogin } from '../sync';
import { updateWatch } from '../watch';
import { applyWatchPlan } from '../watch-native';
import { doneSummary, readCourseChoices, readOfferedStages, readReminderSample, saveCourseChoices, saveFlow, saveStages } from './data';
import { FlyingMascotLayer, useMascotCue } from './FlyingMascot';
import { MS } from './motion';
import { Intro1, Intro2, Intro3, Splash } from './screens-intro';
import { Courses, Done, Nickname, Reminders, type CourseChoice, type ReminderSample } from './screens-setup';
import { Preparing, SignIn } from './screens-signin';
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
  /** "Buka Sulo": the app mounts Ringkasan underneath; the mascot flies to its hero. */
  onFinish: () => void;
  /** Ringkasan is mounted under this layer: the screen fades, the mascot lands on the hero. */
  landing?: boolean;
  /** The mascot reached the hero (or a guard ran out): the app removes this layer. */
  onLanded?: () => void;
}

export function OnboardingFlow({ platform, locale, initial, paused, onSynced, onFinish, landing = false, onLanded }: FlowProps) {
  const w = onboardingWords(locale);
  const app = mobileWords(locale);
  const m = messagesFor(locale);
  const [state, dispatch] = useReducer(reduce, initial);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [courses, setCourses] = useState<{ list: CourseChoice[]; selected: Set<number> }>({ list: [], selected: new Set() });
  const [nickname, setNickname] = useState('');
  const [stages, setStages] = useState<Set<number>>(new Set([1440, 180]));
  const [sample, setSample] = useState<ReminderSample>({ title: w.reminders.sample.title, when: w.reminders.sampleWhen, course: w.reminders.sampleCourse });
  const [watch, setWatch] = useState(true);
  const [watchAllowed, setWatchAllowed] = useState(false);
  const [summary, setSummary] = useState('');
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
      setSample(await readReminderSample(platform, t.w, t.m, t.locale, timeZone()));
    })();
  }, [platform, initial.step]);

  // What the setup screens show, read once there is data.
  useEffect(() => {
    void (async () => {
      const prefs = await readPrefs(platform.store);
      setNickname(prefs.nickname);
      setStages(await readOfferedStages(platform));
      const keep = await readKeepAlive(platform).catch(() => null);
      setWatchAllowed(paused === null && (keep?.enabled ?? true));
    })();
  }, [platform, paused]);

  const signIn = async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return dispatch({ type: 'SIGNIN_OFFLINE' });
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
    setSample(await readReminderSample(platform, t.w, t.m, t.locale, timeZone()));
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
    setSummary(await doneSummary(platform, w, m, locale, timeZone()));
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

  // The done screen needs its line even when the reminders step was resumed past.
  useEffect(() => {
    if (state.step === 'done' && summary === '') void doneSummary(platform, w, m, locale, timeZone()).then(setSummary);
  }, [state.step, summary, platform, w, m, locale]);

  const line1 = greeting({ now: platform.clock.now(), timeZone: timeZone(), nickname: '', overdue: 0, dueToday: 0 }, app).line1;

  const screen = (() => {
    switch (state.step) {
      case 'splash':
        return <Splash w={w} next={next} />;
      case 'intro1':
        return <Intro1 w={w} unofficial={app.unofficial} next={next} back={null} skip={skip} />;
      case 'intro2':
        return <Intro2 w={w} unofficial={app.unofficial} next={next} back={backFn} skip={skip} />;
      case 'intro3':
        return <Intro3 w={w} unofficial={app.unofficial} next={next} back={backFn} skip={skip} />;
      case 'signin':
        return <SignIn w={w} welcomeBack={state.mode === 'relogin'} note={state.signinNote} busy={busy} paused={paused} onOpen={() => void signIn()} onBack={backFn} />;
      case 'preparing':
        return (
          <Preparing
            w={w}
            events={events}
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
        return <Reminders w={w} progress={progress} sample={sample} stages={stages} onStages={setStages} watch={watch} watchAllowed={watchAllowed} onWatch={setWatch} onAllow={() => void finishReminders(true)} onLater={() => void finishReminders(false)} onBack={backFn} />;
      case 'done':
        return <Done w={w} summary={summary || w.done.empty} onOpen={finish} />;
      case 'finished':
        return null;
    }
  })();

  if (landing)
    return (
      <FlyingMascotLayer spotKey="landing" selector={HERO_SPOT} duration={MS.landing} onArrived={onLanded}>
        <LandingCue onLanded={onLanded} />
        {/* The last screen fades away over Ringkasan while it comes in. */}
        <div aria-hidden="true" className="m-onb-leave pointer-events-none fixed inset-0 z-40 bg-m-screen">
          {screen}
        </div>
      </FlyingMascotLayer>
    );
  return (
    <FlyingMascotLayer spotKey={state.step} duration={MS.mascotMove}>
      <div key={state.step} className="m-onb-screen">
        {screen}
      </div>
    </FlyingMascotLayer>
  );
}

/** Ringkasan's hero mascot (HeroMascot.tsx): the landing target. */
export const HERO_SPOT = '[data-mascot-spot="hero"]';

/** Lands with the hero's own expression, so the swap shows nothing; a guard ends the landing if the hero never shows. */
function LandingCue({ onLanded }: { onLanded?: () => void }) {
  const [state, setState] = useState<MascotState>('idle');
  useMascotCue({ state });
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const hero = document.querySelector<HTMLElement>(HERO_SPOT);
      const s = hero?.dataset.mascotState as MascotState | undefined;
      if (s) setState(s);
    });
    const guard = window.setTimeout(() => onLanded?.(), MS.landing + 600);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(guard);
    };
  }, [onLanded]);
  return null;
}

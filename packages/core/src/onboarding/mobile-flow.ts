// The Android app's onboarding (M8c.2) as a pure step machine (the extension's own flow is flow.ts): which step
// shows, what moves it on, which steps can be skipped, and where a closed
// app resumes. The screens only dispatch events; nothing here touches the
// network, storage or the clock.
//
// Steps: 0 splash, 1-3 intro, 4 sign-in, 5 preparing (the real first sync),
// 6 courses, 7 nickname, 8 reminders, 9 done, then finished (Ringkasan).

export const STEPS = ['splash', 'intro1', 'intro2', 'intro3', 'signin', 'preparing', 'courses', 'nickname', 'reminders', 'done', 'finished'] as const;
export type Step = (typeof STEPS)[number];

/** first: a new install; relogin: signing in again after Keluar (no splash, no intro); switch: another account was confirmed (sync and courses only). */
export type FlowMode = 'first' | 'relogin' | 'switch';

/** The first sync's result as the preparing screen sees it. */
export type PrepResult = 'pending' | 'ok' | 'partial' | 'failed';

export interface FlowState {
  step: Step;
  mode: FlowMode;
  /** Sign-in closed without signing in, or no connection: one calm line on step 4. */
  signinNote: 'cancelled' | 'offline' | null;
  prep: PrepResult;
  /** Courses offered on step 6 (0 skips it) and how many are ticked. */
  courseCount: number;
  selected: number;
}

export type FlowEvent =
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'SKIP' }
  | { type: 'SIGNIN_OK' }
  | { type: 'SIGNIN_CANCELLED' }
  | { type: 'SIGNIN_OFFLINE' }
  | { type: 'SYNC_DONE'; result: Exclude<PrepResult, 'pending'>; courseCount: number; selected: number }
  | { type: 'RETRY' }
  | { type: 'CONTINUE_WITHOUT_DATA' }
  | { type: 'SELECT'; selected: number }
  /** A page dot was tapped (or a swipe settled) on the intro: 0, 1 or 2. */
  | { type: 'GOTO_INTRO'; index: number };

export const INTRO: readonly Step[] = ['intro1', 'intro2', 'intro3'];
export const SETUP: readonly Step[] = ['courses', 'nickname', 'reminders'];

/** Where a mode begins. */
export function start(mode: FlowMode): FlowState {
  const step: Step = mode === 'first' ? 'splash' : mode === 'relogin' ? 'signin' : 'preparing';
  return { step, mode, signinNote: null, prep: 'pending', courseCount: 0, selected: 0 };
}

/** The setup steps a mode asks (a switched account keeps its nickname and reminders). */
export function setupSteps(mode: FlowMode): readonly Step[] {
  return mode === 'switch' ? ['courses'] : SETUP;
}

/** Optional steps carry "Lewati": the intro (to sign-in), the nickname and the reminders. Courses never. */
export function canSkip(step: Step): boolean {
  return INTRO.includes(step) || step === 'nickname' || step === 'reminders';
}

/** Step 6 needs at least one course ticked; preparing waits for the sync. */
export function canAdvance(state: FlowState): boolean {
  if (state.step === 'courses') return state.selected > 0;
  if (state.step === 'preparing') return state.prep === 'ok' || state.prep === 'partial';
  return state.step !== 'finished';
}

/** The step after setup step `from` for this mode (skipping courses when there are none). */
function afterSetup(state: FlowState, from: Step | null): Step {
  const steps = setupSteps(state.mode).filter((s) => s !== 'courses' || state.courseCount > 0);
  const i = from === null ? -1 : steps.indexOf(from);
  const next = steps[i + 1];
  if (next) return next;
  return state.mode === 'switch' ? 'finished' : 'done';
}

function next(state: FlowState): Step {
  switch (state.step) {
    case 'splash':
      return 'intro1';
    case 'intro1':
      return 'intro2';
    case 'intro2':
      return 'intro3';
    case 'intro3':
      return 'signin';
    case 'signin':
      return 'signin'; // moves on only with SIGNIN_OK
    case 'preparing':
      return afterSetup(state, null);
    case 'courses':
    case 'nickname':
    case 'reminders':
      return afterSetup(state, state.step);
    case 'done':
    case 'finished':
      return 'finished';
  }
}

/** Back one step, or "exit" (Android leaves the app) at the splash, the first intro screen, and the start of a mode. */
export function back(state: FlowState): FlowState | 'exit' {
  const go = (step: Step): FlowState => ({ ...state, step, signinNote: null });
  switch (state.step) {
    case 'splash':
    case 'intro1':
      return 'exit';
    case 'intro2':
      return go('intro1');
    case 'intro3':
      return go('intro2');
    case 'signin':
      return state.mode === 'first' ? go('intro3') : 'exit';
    // Signed in by now: never back to sign-in or a sync again.
    case 'preparing':
      return 'exit';
    case 'courses':
      return 'exit';
    case 'nickname':
      return state.courseCount > 0 ? go('courses') : 'exit';
    case 'reminders':
      return go('nickname');
    // Everything is saved by now: no way back from "Semua siap".
    case 'done':
    case 'finished':
      return state;
  }
}

export function reduce(state: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'NEXT':
      if (!canAdvance(state)) return state;
      return { ...state, step: next(state), signinNote: null };
    case 'SKIP':
      if (!canSkip(state.step)) return state;
      return { ...state, step: INTRO.includes(state.step) ? 'signin' : next(state) };
    case 'BACK': {
      const b = back(state);
      return b === 'exit' ? state : b;
    }
    case 'SIGNIN_OK':
      return state.step === 'signin' ? { ...state, step: 'preparing', signinNote: null, prep: 'pending' } : state;
    case 'SIGNIN_CANCELLED':
      return state.step === 'signin' ? { ...state, signinNote: 'cancelled' } : state;
    case 'SIGNIN_OFFLINE':
      return state.step === 'signin' ? { ...state, signinNote: 'offline' } : state;
    case 'SYNC_DONE': {
      if (state.step !== 'preparing') return state;
      const done = { ...state, prep: event.result, courseCount: event.courseCount, selected: event.selected };
      // Total failure stays here (Coba lagi or Lanjut tanpa data); partial goes on.
      return event.result === 'failed' ? done : { ...done, step: afterSetup(done, null) };
    }
    case 'RETRY':
      return state.step === 'preparing' ? { ...state, prep: 'pending' } : state;
    case 'CONTINUE_WITHOUT_DATA':
      return state.step === 'preparing' && state.prep === 'failed' ? { ...state, courseCount: 0, step: afterSetup({ ...state, courseCount: 0 }, null) } : state;
    case 'SELECT':
      return { ...state, selected: Math.max(0, event.selected) };
    case 'GOTO_INTRO': {
      const target = INTRO[event.index];
      return INTRO.includes(state.step) && target ? { ...state, step: target } : state;
    }
  }
}

/** What is kept in storage between launches. */
export interface SavedFlow {
  step: Step;
  mode: FlowMode;
}

/**
 * Where a launch starts. No saved flow: a signed-in app (installed before
 * this onboarding) is finished; otherwise a new install. A saved flow
 * before sign-in comes back at sign-in (the splash and intro were seen);
 * after sign-in, at the setup step it reached, or at preparing when the
 * first data never arrived. Without a session, it is sign-in again.
 */
export function resume(saved: SavedFlow | null, ctx: { signedIn: boolean; hasData: boolean }): FlowState {
  if (saved === null) return ctx.signedIn ? { ...start('first'), step: 'finished' } : start('first');
  if (saved.step === 'finished') return { ...start(saved.mode), step: ctx.signedIn ? 'finished' : 'signin', mode: ctx.signedIn ? saved.mode : 'relogin' };
  const signedInStep = STEPS.indexOf(saved.step) >= STEPS.indexOf('preparing');
  if (!ctx.signedIn) return { ...start(saved.mode === 'switch' ? 'relogin' : saved.mode), step: 'signin', mode: saved.mode === 'switch' ? 'relogin' : saved.mode };
  if (!signedInStep || !ctx.hasData) return { ...start(saved.mode), step: 'preparing' };
  return { ...start(saved.mode), step: saved.step };
}

/** Steps 6-8 as "1 of 3" for the segmented bar (switch mode: 1 of 1). */
export function setupProgress(state: FlowState): { index: number; total: number } | null {
  const steps = setupSteps(state.mode);
  const i = steps.indexOf(state.step);
  return i < 0 ? null : { index: i, total: steps.length };
}

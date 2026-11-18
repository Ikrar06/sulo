import { describe, expect, it } from 'vitest';
import { back, canAdvance, canSkip, reduce, resume, setupProgress, start, type FlowEvent, type FlowState } from '@sulo/core/onboarding/mobile-flow';

const run = (state: FlowState, ...events: FlowEvent[]) => events.reduce(reduce, state);
const ok = (courseCount = 5, selected = 4): FlowEvent => ({ type: 'SYNC_DONE', result: 'ok', courseCount, selected });

describe('mobile onboarding flow', () => {
  it('full path: splash, three intro screens, sign-in, preparing, three setup steps, done, finished', () => {
    const steps: string[] = [];
    let s = start('first');
    for (const e of [{ type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'SIGNIN_OK' }, ok(), { type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' }] as FlowEvent[]) {
      steps.push(s.step);
      s = reduce(s, e);
    }
    steps.push(s.step);
    expect(steps).toEqual(['splash', 'intro1', 'intro2', 'intro3', 'signin', 'preparing', 'courses', 'nickname', 'reminders', 'done', 'finished']);
  });
  it('skipping the intro goes straight to sign-in', () => {
    expect(run(start('first'), { type: 'NEXT' }, { type: 'SKIP' }).step).toBe('signin');
    expect(canSkip('intro2')).toBe(true);
    expect(canSkip('courses')).toBe(false);
  });
  it('closing the sign-in page stays on sign-in with one calm note; offline too', () => {
    const s = run(start('relogin'), { type: 'SIGNIN_CANCELLED' });
    expect(s).toMatchObject({ step: 'signin', signinNote: 'cancelled' });
    expect(run(s, { type: 'SIGNIN_OFFLINE' }).signinNote).toBe('offline');
    expect(run(s, { type: 'SIGNIN_OK' })).toMatchObject({ step: 'preparing', signinNote: null });
  });
  it('a partial sync goes on; a total failure waits for Coba lagi or Lanjut tanpa data', () => {
    const prep = run(start('relogin'), { type: 'SIGNIN_OK' });
    expect(run(prep, { type: 'SYNC_DONE', result: 'partial', courseCount: 3, selected: 3 }).step).toBe('courses');
    const failed = run(prep, { type: 'SYNC_DONE', result: 'failed', courseCount: 0, selected: 0 });
    expect(failed).toMatchObject({ step: 'preparing', prep: 'failed' });
    expect(canAdvance(failed)).toBe(false);
    expect(run(failed, { type: 'RETRY' }).prep).toBe('pending');
    expect(run(failed, { type: 'CONTINUE_WITHOUT_DATA' }).step).toBe('nickname');
  });
  it('no course at all skips the courses step', () => {
    const s = run(start('relogin'), { type: 'SIGNIN_OK' }, ok(0, 0));
    expect(s.step).toBe('nickname');
    expect(back(s)).toBe('exit');
  });
  it('courses need one ticked to go on', () => {
    const s = run(start('relogin'), { type: 'SIGNIN_OK' }, ok(4, 0));
    expect(canAdvance(s)).toBe(false);
    expect(run(s, { type: 'NEXT' }).step).toBe('courses');
    expect(run(s, { type: 'SELECT', selected: 2 }, { type: 'NEXT' }).step).toBe('nickname');
  });
  it('declining reminders still finishes (Nanti saja is a skip)', () => {
    const s = run(start('relogin'), { type: 'SIGNIN_OK' }, ok(), { type: 'NEXT' }, { type: 'SKIP' });
    expect(s.step).toBe('reminders');
    expect(run(s, { type: 'SKIP' }).step).toBe('done');
  });
  it('signing in again after Keluar starts at sign-in, no splash or intro', () => {
    expect(start('relogin').step).toBe('signin');
    expect(back(start('relogin'))).toBe('exit');
  });
  it('a switched account syncs, picks courses, and is finished (nickname and reminders kept)', () => {
    const s = start('switch');
    expect(s.step).toBe('preparing');
    const courses = run(s, ok());
    expect(courses.step).toBe('courses');
    expect(setupProgress(courses)).toEqual({ index: 0, total: 1 });
    expect(run(courses, { type: 'NEXT' }).step).toBe('finished');
  });
  it('back moves one step; Android leaves the app at the splash and the first intro screen', () => {
    expect(back(start('first'))).toBe('exit');
    expect(back({ ...start('first'), step: 'intro1' })).toBe('exit');
    expect(back({ ...start('first'), step: 'intro3' })).toMatchObject({ step: 'intro2' });
    expect(back({ ...start('first'), step: 'signin' })).toMatchObject({ step: 'intro3' });
    expect(back({ ...start('first'), step: 'reminders', courseCount: 2 })).toMatchObject({ step: 'nickname' });
  });
  it('the intro goes back: one screen at a time, never to the splash', () => {
    const at = (step: 'intro1' | 'intro2' | 'intro3') => ({ ...start('first'), step });
    expect(run(at('intro3'), { type: 'BACK' }).step).toBe('intro2');
    expect(run(at('intro2'), { type: 'BACK' }).step).toBe('intro1');
    // Android's back button on the first intro screen leaves the app; BACK itself stays put.
    expect(back(at('intro1'))).toBe('exit');
    expect(run(at('intro1'), { type: 'BACK' }).step).toBe('intro1');
  });
  it('back from sign-in: the last intro screen for a new user, out of the app for one who signed out', () => {
    expect(back({ ...start('first'), step: 'signin' })).toMatchObject({ step: 'intro3', mode: 'first' });
    expect(back(start('relogin'))).toBe('exit');
  });
  it('a tapped page dot jumps to that intro screen, and only on the intro', () => {
    const intro1 = { ...start('first'), step: 'intro1' as const };
    expect(run(intro1, { type: 'GOTO_INTRO', index: 2 }).step).toBe('intro3');
    expect(run(intro1, { type: 'GOTO_INTRO', index: 2 }, { type: 'GOTO_INTRO', index: 0 }).step).toBe('intro1');
    expect(run(intro1, { type: 'GOTO_INTRO', index: 5 }).step).toBe('intro1');
    expect(run(start('relogin'), { type: 'GOTO_INTRO', index: 1 }).step).toBe('signin');
  });
  it('preparing and done cannot go back', () => {
    expect(back({ ...start('first'), step: 'preparing' })).toBe('exit');
    const done = { ...start('first'), step: 'done' as const };
    expect(back(done)).toBe(done);
  });
  it('resumes a closed app at the right step', () => {
    expect(resume(null, { signedIn: false, hasData: false }).step).toBe('splash');
    expect(resume(null, { signedIn: true, hasData: true }).step).toBe('finished');
    expect(resume({ step: 'intro2', mode: 'first' }, { signedIn: false, hasData: false }).step).toBe('signin');
    // Closed while the sign-in page was open: back at sign-in.
    expect(resume({ step: 'signin', mode: 'first' }, { signedIn: false, hasData: false }).step).toBe('signin');
    expect(resume({ step: 'nickname', mode: 'first' }, { signedIn: true, hasData: true }).step).toBe('nickname');
    expect(resume({ step: 'courses', mode: 'first' }, { signedIn: true, hasData: false }).step).toBe('preparing');
    expect(resume({ step: 'reminders', mode: 'first' }, { signedIn: false, hasData: true }).step).toBe('signin');
  });
  it('the setup bar counts three steps', () => {
    expect(setupProgress({ ...start('first'), step: 'nickname' })).toEqual({ index: 1, total: 3 });
    expect(setupProgress({ ...start('first'), step: 'signin' })).toBeNull();
  });
});

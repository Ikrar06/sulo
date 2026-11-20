// FLAG_SECURE (M8e E2, narrowed 21 Nov 2026): on only while grades are
// really on screen. The Nilai screen always holds it; the Studi card only
// while its GPA is rendered and in the viewport. A double release never
// switches it off early.
import { describe, expect, it } from 'vitest';
import { secureHolder, studiSecure, studiShowsGpa, watchInView, type StudiGpaState } from '../src/neosia/secure-screen';

describe('secureHolder', () => {
  it('on at the first hold, off after the last release', () => {
    const calls: boolean[] = [];
    const h = secureHolder({ secure: async ({ on }) => void calls.push(on) });
    const nilai = h.hold();
    const studi = h.hold();
    expect(calls).toEqual([true]);
    nilai();
    nilai(); // twice: counted once
    expect(calls).toEqual([true]);
    expect(h.holds).toBe(1);
    studi();
    expect(calls).toEqual([true, false]);
    expect(h.holds).toBe(0);
  });

  it('a failing native switch is not an error for the screen', async () => {
    const h = secureHolder({ secure: async () => Promise.reject(new Error('no activity')) });
    expect(() => h.hold()()).not.toThrow();
  });
});

const SHOWN: StudiGpaState = { enabled: true, gradesShown: true, privacyMode: false, gpa: 3.5 };

describe('Studi card: flag only while the GPA is on screen', () => {
  it.each([
    ['GPA shown and in view', { ...SHOWN, inView: true }, true],
    ['GPA shown but scrolled out of view', { ...SHOWN, inView: false }, false],
    ['grades hidden (the default)', { ...SHOWN, gradesShown: false, inView: true }, false],
    ['privacy mode', { ...SHOWN, privacyMode: true, inView: true }, false],
    ['GPA not read yet', { ...SHOWN, gpa: null, inView: true }, false],
    ['NEOSIA module off', { ...SHOWN, enabled: false, inView: true }, false],
  ])('%s', (_name, state, want) => {
    expect(studiSecure(state)).toBe(want);
  });

  it('the number and the flag follow the same rule', () => {
    expect(studiShowsGpa(SHOWN)).toBe(true);
    expect(studiShowsGpa({ ...SHOWN, privacyMode: true })).toBe(false);
    expect(studiShowsGpa({ ...SHOWN, gradesShown: false })).toBe(false);
  });
});

/** A stand-in IntersectionObserver driven by the test. */
function fakeObserver() {
  let cb: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
  let connected = false;
  return {
    factory: (callback: (entries: { isIntersecting: boolean }[]) => void) => {
      cb = callback;
      return { observe: () => void (connected = true), disconnect: () => void (connected = false) };
    },
    show: (on: boolean) => cb?.([{ isIntersecting: on }]),
    get connected() {
      return connected;
    },
  };
}

describe('watchInView', () => {
  it('follows the observer and stops on cleanup', () => {
    const seen: boolean[] = [];
    const io = fakeObserver();
    const stop = watchInView({} as Element, (v) => seen.push(v), io.factory);
    expect(io.connected).toBe(true);
    io.show(true);
    io.show(false);
    stop();
    expect(io.connected).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it('without an observer it reports visible (keeps the flag on: the safe side)', () => {
    const seen: boolean[] = [];
    watchInView({} as Element, (v) => seen.push(v), null);
    expect(seen).toEqual([true]);
  });
});

/** The states the owner asked about, through the same holder the screens use. */
describe('flag across screen states', () => {
  it('Studi visible, hidden, scrolled away, tab switch, Nilai, back to Ringkasan', () => {
    const calls: boolean[] = [];
    const h = secureHolder({ secure: async ({ on }) => void calls.push(on) });
    const flag = () => h.holds > 0;
    const io = fakeObserver();
    let studi: (() => void) | null = null;
    let state: StudiGpaState = SHOWN;
    let inView = false;
    // What useSecureScreen does when its `active` changes or the screen unmounts.
    const sync = () => {
      const want = studiSecure({ ...state, inView });
      if (want && !studi) studi = h.hold();
      if (!want && studi) {
        studi();
        studi = null;
      }
    };
    const stop = watchInView({} as Element, (v) => {
      inView = v;
      sync();
    }, io.factory);
    const log: [string, boolean][] = [];

    io.show(true);
    log.push(['Ringkasan, GPA in view', flag()]);
    state = { ...SHOWN, privacyMode: true };
    sync();
    log.push(['privacy mode on', flag()]);
    state = SHOWN;
    sync();
    log.push(['privacy mode off again', flag()]);
    io.show(false);
    log.push(['Studi card scrolled away', flag()]);
    io.show(true);
    state = { ...SHOWN, gradesShown: false };
    sync();
    log.push(['grades hidden in settings', flag()]);
    state = SHOWN;
    sync();
    // Tab switch: Ringkasan unmounts, so its hold goes.
    stop();
    studi?.();
    studi = null;
    log.push(['switch to the Tugas tab', flag()]);
    const nilai = h.hold();
    log.push(['open Nilai', flag()]);
    nilai();
    log.push(['close Nilai', flag()]);

    expect(log).toEqual([
      ['Ringkasan, GPA in view', true],
      ['privacy mode on', false],
      ['privacy mode off again', true],
      ['Studi card scrolled away', false],
      ['grades hidden in settings', false],
      ['switch to the Tugas tab', false],
      ['open Nilai', true],
      ['close Nilai', false],
    ]);
    expect(calls.at(-1)).toBe(false);
  });
});

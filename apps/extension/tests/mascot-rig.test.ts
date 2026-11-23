// The mascot's rig against stand-in elements: when it draws, when it stops,
// and what it leaves behind. The owner's conditions for the idle timer
// (23 Nov 2026): it stops completely while the mascot is off screen, in a
// hidden tab or in a backgrounded app (the component calls setActive(false)
// for all three); it never runs in lite or reduced motion; nothing is left
// waiting once the component is gone.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHECK_QUIET } from '@sulo/ui/mascot/machine';
import { MOODS } from '@sulo/ui/mascot/moods';
import { MascotRig, type MotionMode, type RigParts, type SizeTier } from '@sulo/ui/mascot/rig';
import { tierFor } from '@sulo/ui/mascot/SuloMascot';
import { IDLE_HZ } from '@sulo/ui/mascot/tempo';

/** A stand-in for a Web Animation: it runs for its duration (on the fake timers), holds if asked to, and can be cancelled. */
class FakeAnimation {
  playState: 'running' | 'paused' | 'finished' | 'idle' = 'running';
  playbackRate = 1;
  currentTime = 0;
  onfinish: (() => void) | null = null;
  oncancel: (() => void) | null = null;
  private listeners = new Map<string, (() => void)[]>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  readonly endless: boolean;
  readonly effect: { getComputedTiming: () => { fill: string; endTime: number } };

  constructor(options: KeyframeAnimationOptions) {
    const duration = Number(options.duration ?? 0) + Number(options.delay ?? 0);
    this.endless = options.iterations === Infinity;
    this.effect = { getComputedTiming: () => ({ fill: String(options.fill ?? 'none'), endTime: this.endless ? Infinity : duration }) };
    if (!this.endless) this.timer = setTimeout(() => this.finish(), duration);
  }
  addEventListener(type: string, fn: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  private emit(type: 'finish' | 'cancel') {
    for (const fn of this.listeners.get(type) ?? []) fn();
    (type === 'finish' ? this.onfinish : this.oncancel)?.();
  }
  private drop() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  finish() {
    if (this.playState === 'finished' || this.playState === 'idle') return;
    this.drop();
    this.playState = 'finished';
    this.emit('finish');
  }
  cancel() {
    if (this.playState === 'idle') return;
    this.drop();
    this.playState = 'idle';
    this.emit('cancel');
  }
  pause() {
    this.playState = 'paused';
  }
  play() {
    this.playState = 'running';
  }
}

class FakeElement {
  readonly attrs = new Map<string, string>();
  readonly style: Record<string, string> = {};
  readonly animations: FakeAnimation[] = [];
  /** How many times each attribute was written. */
  readonly writes = new Map<string, number>();
  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
    this.writes.set(name, (this.writes.get(name) ?? 0) + 1);
  }
  removeAttribute(name: string) {
    this.attrs.delete(name);
  }
  hasAttribute(name: string) {
    return this.attrs.has(name);
  }
  animate(_keyframes: unknown, options: KeyframeAnimationOptions) {
    const a = new FakeAnimation(options);
    this.animations.push(a);
    return a;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 104, height: 104 };
  }
  get alive() {
    return this.animations.filter((a) => a.playState === 'running' || a.playState === 'paused' || a.playState === 'finished').filter((a) => a.playState !== 'finished' || a.effect.getComputedTiming().fill !== 'none');
  }
}

const NAMES = ['svg', 'root', 'back', 'front', 'face', 'eyes', 'look', 'blink', 'eyeL', 'eyeR', 'drawn', 'stars', 'spirals', 'shadow'] as const;

function stage() {
  const one = Object.fromEntries(NAMES.map((n) => [n, new FakeElement()])) as Record<(typeof NAMES)[number], FakeElement>;
  const pool = (n: number) => Array.from({ length: n }, () => new FakeElement());
  const many = { starEyes: pool(2), spiralEyes: pool(2), sparks: pool(16), zs: pool(3), orbit: pool(3) };
  const all = [...Object.values(one), ...Object.values(many).flat()];
  return { ...one, ...many, all, parts: { ...one, ...many } as unknown as RigParts };
}

function make(options: { motion?: MotionMode; tier?: SizeTier; mood?: 'neutral' | 'sleepy' | 'dizzy' | 'happy' } = {}) {
  const s = stage();
  const rig = new MascotRig(s.parts, { mood: options.mood ?? 'neutral', motion: options.motion ?? 'full', tier: options.tier ?? 'full', effects: true });
  return { rig, s };
}

/** Listeners on the window, by event: the rig's pointer listener must come off again. */
let listeners: Map<string, Set<unknown>>;
const flameWrites = (s: ReturnType<typeof stage>) => s.back.writes.get('d') ?? 0;
const running = (s: ReturnType<typeof stage>) => s.all.flatMap((el) => el.animations).filter((a) => a.playState === 'running');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
  listeners = new Map();
  vi.stubGlobal('requestAnimationFrame', (fn: (t: number) => void) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '', transform: 'none' }));
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('window', {
    addEventListener: (type: string, fn: unknown) => listeners.set(type, new Set([...(listeners.get(type) ?? []), fn])),
    removeEventListener: (type: string, fn: unknown) => listeners.get(type)?.delete(fn),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the idle timer', () => {
  it('writes the flame thirty times a second while a full-size mascot idles, and no animation keeps running', () => {
    const { rig, s } = make();
    rig.setActive(true);
    vi.advanceTimersByTime(2000);
    const before = flameWrites(s);
    vi.advanceTimersByTime(1000);
    const written = flameWrites(s) - before;
    expect(written).toBeGreaterThanOrEqual(IDLE_HZ - 2);
    expect(written).toBeLessThanOrEqual(IDLE_HZ + 2);
    expect(s.front.writes.get('d')).toBe(s.back.writes.get('d'));
    // Nothing endless: the only animations there can be are a blink in flight and the eyes held at their shape.
    expect(s.all.flatMap((el) => el.animations).filter((a) => a.endless && a.playState === 'running')).toEqual([]);
    rig.destroy();
  });

  it('no expression keeps an animation running without end: what turns (spiral eyes, star eyes, the dizzy ring) is the timer\'s', () => {
    for (const mood of MOODS) {
      const s = stage();
      const rig = new MascotRig(s.parts, { mood, motion: 'full', tier: 'full', effects: true });
      rig.setActive(true);
      vi.advanceTimersByTime(4000);
      expect(s.all.flatMap((el) => el.animations).filter((a) => a.endless)).toEqual([]);
      rig.destroy();
    }
    // The spiral eyes and the ring do turn: written by the timer.
    const s = stage();
    const rig = new MascotRig(s.parts, { mood: 'dizzy', motion: 'full', tier: 'full', effects: true });
    rig.setActive(true);
    vi.advanceTimersByTime(500);
    const first = s.spiralEyes[0]!.style.transform;
    vi.advanceTimersByTime(200);
    expect(first).toMatch(/^rotate\(/);
    expect(s.spiralEyes[0]!.style.transform).not.toBe(first);
    expect(s.orbit.every((el) => (el.writes.get('transform') ?? 0) > 10)).toBe(true);
    // Lite: they show, and stand still.
    rig.setMotion('lite');
    vi.advanceTimersByTime(1000);
    expect(s.spiralEyes[0]!.style.transform).toBe('');
    expect(s.spirals.style.opacity).toBe('1');
    rig.destroy();
  });

  it('a small mascot is written half as often', () => {
    const { rig, s } = make({ tier: 'small' });
    rig.setActive(true);
    vi.advanceTimersByTime(1000);
    const before = flameWrites(s);
    vi.advanceTimersByTime(2000);
    const perSecond = (flameWrites(s) - before) / 2;
    expect(perSecond).toBeGreaterThanOrEqual(IDLE_HZ / 2 - 1.5);
    expect(perSecond).toBeLessThanOrEqual(IDLE_HZ / 2 + 1.5);
    rig.destroy();
  });

  it('stops completely when the mascot goes off screen, the tab is hidden or the app is in the background', () => {
    for (const mood of ['neutral', 'sleepy', 'dizzy', 'happy'] as const) {
      const { rig, s } = make({ mood });
      rig.setFollow(true);
      rig.setActive(true);
      vi.advanceTimersByTime(3000);
      rig.react('celebrate');
      vi.advanceTimersByTime(400);
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      // What the component does for all three: setActive(false).
      rig.setActive(false);
      expect(vi.getTimerCount()).toBe(0);
      expect(rig.load).toEqual({ animations: 0, timers: 0 });
      expect(running(s)).toEqual([]);
      expect(listeners.get('pointermove')?.size ?? 0).toBe(0);
      const written = flameWrites(s);
      vi.advanceTimersByTime(5000);
      expect(flameWrites(s)).toBe(written);
      expect(vi.getTimerCount()).toBe(0);

      // And it comes back when it is seen again.
      rig.setActive(true);
      vi.advanceTimersByTime(1000);
      expect(flameWrites(s)).toBeGreaterThan(written + IDLE_HZ / 2);
      rig.destroy();
    }
  });

  it('never runs in lite (the lite tier and reduced motion): the body is not written or animated at all', () => {
    const { rig, s } = make({ motion: 'lite' });
    rig.setFollow(true);
    rig.setActive(true);
    vi.advanceTimersByTime(20_000);
    expect(flameWrites(s)).toBe(0);
    expect(s.front.writes.get('d') ?? 0).toBe(0);
    for (const el of [s.back, s.front, s.face, s.root, s.eyes, s.shadow]) expect(el.animations).toEqual([]);
    // No following the pointer and no glances either: only blinks.
    expect(listeners.get('pointermove')?.size ?? 0).toBe(0);
    expect(s.blink.animations.length).toBeGreaterThan(1);
    // A reaction in lite is its face and nothing else: no hop, no stars.
    rig.react('checked');
    vi.advanceTimersByTime(600);
    expect(rig.state.face).toBe('happy');
    expect(s.root.animations).toEqual([]);
    expect(s.sparks.flatMap((el) => el.animations)).toEqual([]);
    vi.advanceTimersByTime(2000);
    expect(rig.state.face).toBe('neutral');
    rig.destroy();
  });

  it('a mascot that is off or tiny has no rig work at all', () => {
    for (const options of [{ motion: 'off' as const }, { tier: 'tiny' as const }]) {
      const { rig, s } = make(options);
      rig.setActive(true);
      rig.react('celebrate');
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(5000);
      expect(s.all.flatMap((el) => el.animations)).toEqual([]);
      expect(flameWrites(s)).toBe(0);
      rig.destroy();
    }
  });

  it('leaves nothing behind when the component is removed, whatever it was doing', () => {
    for (const motion of ['full', 'lite'] as const) {
      const { rig, s } = make({ motion, mood: 'sleepy' });
      rig.setFollow(true);
      rig.setActive(true);
      vi.advanceTimersByTime(2500);
      rig.setMood('dizzy');
      rig.react('celebrate');
      vi.advanceTimersByTime(300);
      rig.setMood('happy');
      vi.advanceTimersByTime(50);

      rig.destroy();
      expect(vi.getTimerCount()).toBe(0);
      expect(rig.load).toEqual({ animations: 0, timers: 0 });
      expect(s.all.flatMap((el) => el.alive)).toEqual([]);
      expect(listeners.get('pointermove')?.size ?? 0).toBe(0);
      const written = flameWrites(s);
      vi.advanceTimersByTime(10_000);
      expect(flameWrites(s)).toBe(written);
      // A removed rig cannot be started again.
      rig.setActive(true);
      rig.react('tap');
      expect(vi.getTimerCount()).toBe(0);
    }
  });
});

describe('a ticked task', () => {
  const stars = (s: ReturnType<typeof stage>) => s.sparks.flatMap((el) => el.animations).length;

  it('has stars the first time and only the hop for the ticks that follow soon', () => {
    const { rig, s } = make();
    rig.setActive(true);
    vi.advanceTimersByTime(1000);
    rig.react('checked');
    vi.advanceTimersByTime(500);
    expect(stars(s)).toBe(6);
    const hops = s.root.animations.length;
    expect(hops).toBeGreaterThan(0);

    // Two more ticks, two seconds apart: each hops, neither has stars.
    for (let i = 0; i < 2; i += 1) {
      vi.advanceTimersByTime(1500);
      rig.react('checked');
      vi.advanceTimersByTime(500);
    }
    expect(stars(s)).toBe(6);
    expect(s.root.animations.length).toBeGreaterThan(hops);

    // After a pause longer than the quiet time, the stars are back.
    vi.advanceTimersByTime(CHECK_QUIET * 1000 + 200);
    rig.react('checked');
    vi.advanceTimersByTime(500);
    expect(stars(s)).toBe(12);
    rig.destroy();
  });
});

describe('simpler when small', () => {
  it('under 32 px it is a still drawing, under 72 px it has no effects tier, from 72 px it is full', () => {
    expect([24, 31].map(tierFor)).toEqual(['tiny', 'tiny']);
    expect([32, 40, 48, 56, 71].map(tierFor)).toEqual(['small', 'small', 'small', 'small', 'small']);
    expect([72, 75, 104, 240].map(tierFor)).toEqual(['full', 'full', 'full', 'full']);
  });

  it('a small mascot throws no stars and gives off no z', () => {
    const { rig, s } = make({ tier: 'small', mood: 'sleepy' });
    rig.setActive(true);
    vi.advanceTimersByTime(6000);
    rig.react('celebrate');
    vi.advanceTimersByTime(1500);
    expect(s.sparks.flatMap((el) => el.animations)).toEqual([]);
    expect(s.zs.every((el) => (el.writes.get('transform') ?? 0) === 0)).toBe(true);
    rig.destroy();
  });
});

// The mascot on screen: turns the pure descriptions (motion.ts, machine.ts,
// eyes.ts) into Web Animations on the SVG the component rendered.
//
// - A move (a reaction, a change of expression): frameAt() is sampled ahead
//   into keyframes of the body's paths (`d`), the eyes' ride and the whole
//   body's transform, and the browser plays them at full rate until it has
//   settled.
// - Idle life (sway, breath, flicker; a smiling eye's bob; a drifting z):
//   no animation runs. One timer writes the flame's shape thirty times a
//   second (and turns what turns without end: spiral eyes, star eyes, the
//   stars round a dizzy head), and nothing else changes (the face and the eyes follow the pose
//   without the sway, which is constant then). An animation that never
//   stops makes the page produce every frame, whatever it animates; on a
//   low-end phone that is the whole cost of a mascot, and this halves it.
// - The eyes: one held animation per eye carries its current shape; a change
//   blends shape to shape, or goes through a blink. The star and spiral eyes
//   are drawings of their own that spin.
// - One clock (clock.ts) times everything: blinks, glances, a reaction's
//   cues. It costs nothing between events, and it can be slowed, paused and
//   stepped (the lab) together with the animations.
// - requestAnimationFrame is used for one thing only: easing the eyes toward
//   where they look, and only while they are moving.
//
// The rig owns everything it animates from start() to stop(): while it
// draws, the markup under it may change (React re-renders the expression at
// rest) without showing. Nothing runs while the mascot is hidden, off
// screen, or told to be still.

import { Clock } from './clock';
import { eyePaths } from './eyes';
import { initialState, reduce, REACTIONS, type Effect, type MachineState } from './machine';
import { MOOD, type Mood } from './moods';
import { addExtra, busyFor, changeMood, frameAt, IDLE_EXTRA, REACTION_BODY, smallChange, startMotion, type Motion, type PlayedReaction, type ReactionName } from './motion';
import { EYES_CENTER, GLANCE } from './shape';
import { BLINK_MS, EASE, EYE_CHANGE_MS, IDLE_HZ, MOVE_KEYS, SMALL_GAIN } from './tempo';
import { backPath, eyesTransform, facePath, frontPath, rootTransform } from './warp';

export type MotionMode = 'full' | 'lite' | 'off';
/** tiny: under 32 px, a still drawing. small: under 72 px, idle life at half the keys and no effects. */
export type SizeTier = 'tiny' | 'small' | 'full';

export interface RigParts {
  readonly svg: SVGSVGElement;
  readonly root: SVGGElement;
  readonly back: SVGPathElement;
  readonly front: SVGPathElement;
  readonly face: SVGPathElement;
  /** Rides the face (keyframed with the body). */
  readonly eyes: SVGGElement;
  /** Where the eyes look (eased by the rig). */
  readonly look: SVGGElement;
  readonly blink: SVGGElement;
  readonly eyeL: SVGPathElement;
  readonly eyeR: SVGPathElement;
  /** The drawn pair, the brand's star eyes, the spiral eyes: one of the three shows. */
  readonly drawn: SVGGElement;
  readonly stars: SVGGElement;
  readonly spirals: SVGGElement;
  /** Each star and each spiral, to spin on its own center. */
  readonly starEyes: readonly SVGElement[];
  readonly spiralEyes: readonly SVGElement[];
  readonly shadow: SVGElement | null;
  readonly sparks: readonly SVGElement[];
  /** Small "z" strokes (asleep) and the stars that circle a dizzy head. */
  readonly zs: readonly SVGElement[];
  readonly orbit: readonly SVGElement[];
}

export interface RigOptions {
  mood: Mood;
  motion: MotionMode;
  tier: SizeTier;
  effects: boolean;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const path = (d: string) => `path("${d}")`;
const holds = (a: Animation) => {
  const fill = a.effect?.getComputedTiming().fill;
  return fill === 'forwards' || fill === 'both';
};

export class MascotRig {
  private machine: MachineState;
  private motion: Motion;
  private mode: MotionMode;
  private tier: SizeTier;
  private effects: boolean;
  private active = false;
  private destroyed = false;
  private readonly clock = new Clock();
  /** Every animation the rig has made and not cancelled, held ones included: speed, pause, step and stop reach all of them. */
  private live = new Set<Animation>();
  private body: Animation[] = [];
  private eyeAnims: (Animation | null)[] = [null, null];
  private faceChange = 0;
  /** The eyes that are drawings of their own, when one shows; it turns by the idle timer, from this moment. */
  private special: 'none' | 'spiral' | 'star' = 'none';
  /** Stars circling a dizzy head (the idle timer moves them). */
  private orbiting = false;
  /** One-shot animations of the special eyes (the stars popping out). */
  private spins: Animation[] = [];
  private sparkAnims = new Map<SVGElement, Animation>();
  private nextSpark = 0;
  /** The idle timer, and what it moves besides the flame: what drifts off it (a z), a pure function of its age. */
  private ticking = 0;
  private floating: { el: SVGElement; born: number; life: number; at: (u: number) => { transform: string; opacity: number } }[] = [];
  private nextFloat = 0;
  private idleTimers = new Set<number>();
  private reactionTimers = new Set<number>();
  // Gaze: where the eyes are, where they are going, and who is asking.
  private gaze = { x: 0, y: 0 };
  private gazeGoal = { x: 0, y: 0 };
  private raf = 0;
  private given: { x: number; y: number } | null = null;
  private cursor: { x: number; y: number } | null = null;
  private reactionLook: { x: number; y: number } | null = null;
  private wander = { x: 0, y: 0 };
  private follow = false;
  private cursorRest = 0;
  private pendingMove = 0;
  private onMove: ((e: PointerEvent) => void) | null = null;
  /** The last window of keyframes took this long to bake (ms): for the lab's cost readout. */
  lastBakeMs = 0;

  constructor(private readonly parts: RigParts, options: RigOptions) {
    this.machine = initialState(options.mood);
    this.motion = startMotion(options.mood, 0);
    this.mode = options.motion;
    this.tier = options.tier;
    this.effects = options.effects;
  }

  // ---------- The clock ----------

  /** Seconds on the rig's clock. */
  now(): number {
    return this.clock.now();
  }

  private track<T extends Animation>(a: T): T {
    a.playbackRate = this.clock.rate;
    if (this.clock.paused) a.pause();
    this.live.add(a);
    // One that holds its last frame stays the rig's until it is cancelled; the rest are done when they finish.
    a.addEventListener('finish', () => {
      if (!holds(a)) this.live.delete(a);
    });
    a.addEventListener('cancel', () => this.live.delete(a));
    return a;
  }

  /** Calls `fn` after `seconds` of the rig's clock, while it is still drawing. */
  private after(seconds: number, fn: () => void, group?: Set<number>): number {
    const id = this.clock.after(seconds, () => {
      group?.delete(id);
      if (!this.destroyed && this.active) fn();
    });
    group?.add(id);
    return id;
  }

  private clear(group: Set<number>) {
    for (const id of group) this.clock.cancel(id);
    group.clear();
  }

  setRate(rate: number) {
    this.clock.setRate(rate);
    for (const a of this.live) a.playbackRate = rate;
  }

  setPaused(paused: boolean) {
    this.clock.setPaused(paused);
    for (const a of this.live) {
      if (paused) a.pause();
      else if (a.playState === 'paused') a.play();
    }
    if (!paused) this.easeGaze();
  }

  /** Lab: moves the clock and every animation on by `ms` while paused. */
  step(ms: number) {
    for (const a of [...this.live]) {
      if (a.playState === 'finished') continue;
      const t = ((a.currentTime as number | null) ?? 0) + ms;
      const end = Number(a.effect?.getComputedTiming().endTime ?? Infinity);
      // A paused animation never finishes by itself: one stepped past its end is finished by hand, so what follows it still starts.
      if (t >= end) a.finish();
      else a.currentTime = t;
    }
    this.clock.step(ms / 1000);
    if (this.moving) this.draw();
    this.gaze = { x: this.gaze.x + (this.gazeGoal.x - this.gaze.x) * 0.3, y: this.gaze.y + (this.gazeGoal.y - this.gaze.y) * 0.3 };
    this.drawGaze();
  }

  // ---------- Starting and stopping ----------

  /** The body moves: full motion, and big enough to see it. */
  private get moving(): boolean {
    return this.active && this.mode === 'full' && this.tier !== 'tiny';
  }

  /**
   * The rig draws at all. Lite keeps a blink and a change of the eyes behind
   * it and nothing else: no body, no glances, no following. Off and tiny
   * mascots are the component's own markup and the rig touches nothing.
   */
  private get drawing(): boolean {
    return this.active && this.mode !== 'off' && this.tier !== 'tiny';
  }

  /** A small mascot's idle life is drawn larger for its size. */
  private get gain(): number {
    return this.tier === 'small' ? SMALL_GAIN : 1;
  }

  /** On screen and in front, or not. Everything stops when it is not. */
  setActive(active: boolean) {
    if (this.destroyed || active === this.active) return;
    this.active = active;
    if (active) this.start();
    else this.stop();
  }

  setMotion(mode: MotionMode) {
    if (mode === this.mode) return;
    this.restart(() => (this.mode = mode));
  }

  setTier(tier: SizeTier, effects: boolean) {
    if (tier === this.tier && effects === this.effects) return;
    this.restart(() => {
      this.tier = tier;
      this.effects = effects;
    });
  }

  private restart(change: () => void) {
    const was = this.active;
    if (was) this.stop();
    change();
    if (was) this.start();
  }

  private start() {
    if (!this.drawing) return;
    this.clock.start();
    // The expression may have changed while it was away: begin at rest in it, its idle life growing in.
    this.motion = startMotion(this.machine.mood, this.now());
    // From here the eyes are the rig's: whatever the markup says later, they show this face until the rig changes it.
    this.pinFace(this.machine.face);
    this.run();
    this.scheduleBlink();
    this.scheduleIdle();
    this.aim(true);
    if (this.follow && this.moving) this.listen();
  }

  private stop() {
    this.clock.stop();
    this.idleTimers.clear();
    this.reactionTimers.clear();
    this.cursorRest = 0;
    for (const a of [...this.live]) {
      a.onfinish = null;
      a.oncancel = null;
      a.cancel();
    }
    this.live.clear();
    this.body = [];
    this.eyeAnims = [null, null];
    this.spins = [];
    this.special = 'none';
    this.orbiting = false;
    this.sparkAnims.clear();
    this.ticking = 0;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.unlisten();
    // The clock starts from zero next time: nothing timed on it is kept.
    this.machine = initialState(this.machine.mood);
    this.reactionLook = null;
    this.wander = { x: 0, y: 0 };
    this.gaze = { x: 0, y: 0 };
    // At rest the drawing is the expression's own: the component's markup shows through.
    const { parts } = this;
    parts.svg.removeAttribute('data-tint');
    for (const el of [parts.drawn, parts.stars, parts.spirals]) el.style.opacity = '';
    parts.look.removeAttribute('transform');
    parts.drawn.removeAttribute('transform');
    for (const f of this.floating) f.el.setAttribute('opacity', '0');
    this.floating = [];
    for (const el of parts.orbit) el.setAttribute('opacity', '0');
    for (const el of [...parts.spiralEyes, ...parts.starEyes, parts.stars]) el.style.transform = '';
    // What the idle timer wrote goes back to the expression's stance (what the component's markup says).
    const rest = MOOD[this.machine.mood].pose;
    parts.back.setAttribute('d', backPath(rest));
    parts.front.setAttribute('d', frontPath(rest));
  }

  destroy() {
    this.setActive(false);
    this.destroyed = true;
  }

  // ---------- The body ----------

  /** Decides how the body is driven from now: a baked move while anything is in flight, the idle timer otherwise. */
  private run() {
    for (const a of this.body) {
      a.onfinish = null;
      a.cancel();
    }
    this.body = [];
    if (!this.moving) return;
    const busy = busyFor(this.motion, this.now());
    if (busy > 0) this.bake(busy);
    // What the timer last wrote may be seconds old (a move was playing over it): write "now" before anything shows.
    else this.draw();
    if (!this.ticking) this.tick();
  }

  /** A move, sampled ahead and played by the browser at full rate. While it plays it covers what the idle timer writes. */
  private bake(busy: number) {
    const began = performance.now();
    const now = this.now();
    const span = Math.min(busy + 0.05, 3.2);
    const count = Math.max(2, Math.ceil(span * MOVE_KEYS) + 1);
    const back: string[] = [];
    const front: string[] = [];
    const face: string[] = [];
    const eyes: string[] = [];
    const root: string[] = [];
    const shadow: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const t = now + (i * span) / (count - 1);
      const f = frameAt(this.motion, t, this.gain);
      back.push(path(backPath(f.pose)));
      front.push(path(frontPath(f.pose)));
      // The face and the eyes follow the pose without the sway and the breath.
      face.push(path(facePath(f.core)));
      eyes.push(eyesTransform(f.core));
      root.push(rootTransform(f));
      shadow.push(`scale(${(1 - 0.42 * Math.min(1, f.lift / 90) - f.core.stretch * 0.5).toFixed(3)}, 1)`);
    }
    const timing: KeyframeAnimationOptions = { duration: span * 1000, easing: 'linear', fill: 'forwards' };
    const { parts } = this;
    // A track whose every key is the same needs no animation: the markup already shows that value.
    const play = (el: Element | null, property: 'd' | 'transform', values: string[]) => {
      if (!el || values.every((v) => v === values[0])) return;
      this.body.push(this.track(el.animate({ [property]: values }, timing)));
    };
    play(parts.back, 'd', back);
    play(parts.front, 'd', front);
    play(parts.face, 'd', face);
    play(parts.eyes, 'transform', eyes);
    play(parts.root, 'transform', root);
    play(parts.shadow, 'transform', shadow);
    // When it ends, whatever is next takes over from the clock: another move, or the idle timer alone.
    const next = () => {
      if (!this.destroyed) this.run();
    };
    if (this.body[0]) this.body[0].onfinish = next;
    else this.after(span, next, this.idleTimers);
    this.lastBakeMs = performance.now() - began;
  }

  /** One write of the idle life, and the next one booked. Real time between writes stays the same at any clock speed. */
  private tick() {
    this.ticking = 0;
    if (!this.moving) return;
    this.draw();
    const hz = this.tier === 'small' ? IDLE_HZ / 2 : IDLE_HZ;
    this.ticking = this.clock.after(this.clock.rate / hz, () => this.tick());
  }

  /** Writes everything the idle timer owns for "now": the flame (unless a move is playing over it), the smiling eyes' bob, and what drifts off it. */
  private draw() {
    const now = this.now();
    const { parts } = this;
    if (this.body.length === 0) {
      const pose = frameAt(this.motion, now, this.gain).pose;
      parts.back.setAttribute('d', backPath(pose));
      parts.front.setAttribute('d', frontPath(pose));
    }
    // Smiling eyes do not blink; they bob.
    if (MOOD[this.machine.face].idle.bob) parts.drawn.setAttribute('transform', `translate(0 ${(-3.5 + 3.5 * Math.cos((2 * Math.PI * now) / 1.5)).toFixed(2)})`);
    else if (parts.drawn.hasAttribute('transform')) parts.drawn.removeAttribute('transform');
    this.turn(now);
    if (this.floating.length === 0) return;
    this.floating = this.floating.filter((f) => {
      const u = (now - f.born) / f.life;
      if (u >= 1 || u < 0) {
        f.el.setAttribute('opacity', '0');
        return false;
      }
      const v = f.at(u);
      f.el.setAttribute('transform', v.transform);
      f.el.setAttribute('opacity', v.opacity.toFixed(2));
      return true;
    });
  }

  // ---------- Expressions and reactions ----------

  setMood(mood: Mood) {
    if (!this.drawing) {
      // Not drawing: only remember it. The component's markup already shows the new expression.
      this.machine = initialState(mood);
      return;
    }
    this.apply(reduce(this.machine, { type: 'mood', mood }));
    this.clear(this.idleTimers);
    this.wander = { x: 0, y: 0 };
    this.scheduleBlink();
    this.scheduleIdle();
    this.aim();
  }

  /**
   * A one-shot reaction. A mascot that moves plays all of it. Lite (and
   * reduced motion) keeps only what is not movement: the face it borrows,
   * changed behind a blink, and the tint.
   */
  react(name: ReactionName) {
    if (!this.drawing) return;
    this.apply(reduce(this.machine, { type: 'react', name, now: this.now() }));
  }

  private apply({ state, effects }: { state: MachineState; effects: Effect[] }) {
    const before = this.machine.mood;
    this.machine = state;
    for (const e of effects) {
      if (e.type === 'stance') {
        const now = this.now();
        this.motion = changeMood(this.motion, e.to, now);
        // A stance that hardly differs would change without the body seeming to notice: it gets one small nod.
        if (this.moving && !state.reaction && smallChange(MOOD[before].pose, MOOD[e.to].pose)) this.motion = addExtra(this.motion, IDLE_EXTRA.nod, now, 'idle');
        this.run();
      } else if (e.type === 'face') {
        // Lite keeps no motion but a blink: the eyes change behind closed lids.
        this.showFace(e.from, e.to, this.mode === 'full' ? e.via : 'blink');
        this.aim();
      } else if (e.type === 'cancel') {
        this.clear(this.reactionTimers);
        this.reactionLook = null;
        this.parts.svg.removeAttribute('data-tint');
      } else {
        this.startReaction(e.name, e.id);
      }
    }
  }

  private startReaction(name: PlayedReaction, id: number) {
    const spec = REACTIONS[name];
    if (this.moving) {
      this.motion = addExtra(this.motion, REACTION_BODY[name], this.now());
      this.run();
    }
    const group = this.reactionTimers;
    const cue = (face: Mood | null) => this.apply(reduce(this.machine, { type: 'cue', id, face }));
    for (const c of spec.cues) {
      if (c.at <= 0) cue(c.face);
      else this.after(c.at, () => cue(c.face), group);
    }
    for (const at of spec.blinks ?? []) this.after(at, () => this.blinkOnce(), group);
    if (this.moving && this.effects && this.tier === 'full') for (const b of spec.bursts ?? []) this.after(b.at, () => this.burst(b.count, b.power), group);
    if (spec.look && this.moving) {
      const { x, y, from, to } = spec.look;
      this.after(from, () => {
        this.reactionLook = { x, y };
        this.aim();
      }, group);
      this.after(to, () => {
        this.reactionLook = null;
        this.aim();
      }, group);
    }
    if (spec.tint) this.parts.svg.setAttribute('data-tint', spec.tint);
    this.after(spec.duration, () => {
      this.parts.svg.removeAttribute('data-tint');
      this.apply(reduce(this.machine, { type: 'end', id }));
    }, group);
  }

  // ---------- The eyes' shape ----------

  /** Which of the three eye drawings shows. The special ones turn by the idle timer (turn()), so nothing endless is ever running. */
  private setSpecial(kind: 'none' | 'spiral' | 'star') {
    const { parts } = this;
    parts.drawn.style.opacity = kind === 'none' ? '1' : '0';
    parts.stars.style.opacity = kind === 'star' ? '1' : '0';
    parts.spirals.style.opacity = kind === 'spiral' ? '1' : '0';
    for (const a of this.spins) a.cancel();
    this.spins = [];
    if (kind !== this.special) for (const el of [...parts.spiralEyes, ...parts.starEyes, parts.stars]) el.style.transform = '';
    this.special = kind;
    if (this.moving) this.turn(this.now());
  }

  /**
   * What turns without end, written by the idle timer: the spiral eyes
   * (each at its own pace, as dizziness goes), the star eyes (toward each
   * other, a touch out of step, swelling as they turn), and the stars that
   * circle a dizzy head. Each is a function of the clock, so it is the same
   * at any speed and steps with it.
   */
  private turn(now: number) {
    const { parts } = this;
    const degrees = (period: number, direction = 1) => `rotate(${(((now / period) % 1) * 360 * direction).toFixed(1)}deg)`;
    if (this.special === 'spiral') {
      parts.spiralEyes.forEach((el, i) => (el.style.transform = degrees(i === 0 ? 1.05 : 1.3)));
    } else if (this.special === 'star') {
      parts.starEyes.forEach((el, i) => (el.style.transform = degrees(i === 0 ? 1.1 : 1.24, i === 0 ? 1 : -1)));
      parts.stars.style.transform = `scale(${(1.065 - 0.065 * Math.cos((2 * Math.PI * now) / 0.64)).toFixed(3)})`;
    }
    if (!this.orbiting) return;
    // A flat ring over the head: nearer stars larger and plainer.
    const count = parts.orbit.length;
    parts.orbit.forEach((el, i) => {
      const around = now / 2.6 + i / count;
      const angle = around * Math.PI * 2;
      const near = (Math.sin(angle) + 1) / 2;
      el.setAttribute('transform', `translate(${(250 + Math.cos(angle) * 215).toFixed(1)} ${(150 + Math.sin(angle) * 58).toFixed(1)}) scale(${(11 + 6 * near).toFixed(1)}) rotate(${((around % 1) * 180).toFixed(0)})`);
      el.setAttribute('opacity', (0.55 + 0.45 * near).toFixed(2));
    });
  }

  /** Holds both eyes at a face (no animation of the change): what start() and a closed lid do. */
  private pinFace(mood: Mood) {
    const targets = eyePaths(MOOD[mood].eyes);
    [this.parts.eyeL, this.parts.eyeR].forEach((el, i) => {
      this.eyeAnims[i]?.cancel();
      this.eyeAnims[i] = this.track(el.animate({ d: [path(targets[i]!), path(targets[i]!)] }, { duration: 1, fill: 'forwards' }));
    });
    this.setSpecial(MOOD[mood].special);
  }

  private showFace(fromMood: Mood, mood: Mood, via: 'blend' | 'blink') {
    this.faceChange += 1;
    const change = this.faceChange;
    const spec = MOOD[mood];
    if (via === 'blend') {
      const targets = eyePaths(spec.eyes);
      [this.parts.eyeL, this.parts.eyeR].forEach((el, i) => {
        // Leave from wherever the shape is now, mid-change included.
        const from = getComputedStyle(el).getPropertyValue('d');
        this.eyeAnims[i]?.cancel();
        this.eyeAnims[i] = this.track(el.animate({ d: [from && from !== 'none' ? from : path(eyePaths(MOOD[fromMood].eyes)[i]!), path(targets[i]!)] }, { duration: EYE_CHANGE_MS, easing: EASE.pop, fill: 'forwards' }));
      });
      return;
    }
    // Through a blink: the lids close, the eyes change behind them, the lids open.
    const { blink, stars } = this.parts;
    const close = this.track(blink.animate({ transform: ['scaleY(1)', 'scaleY(0.06)'] }, { duration: BLINK_MS * 0.45, easing: EASE.lidDown, fill: 'forwards' }));
    close.onfinish = () => {
      // A later change has taken over: this one must not put its face on.
      if (change !== this.faceChange) return close.cancel();
      this.pinFace(mood);
      if (spec.special === 'star' && this.moving) {
        // Stars do not open like lids: they pop out, already turning.
        close.cancel();
        this.spins.push(this.track(stars.animate({ transform: ['scale(0.3)', 'scale(1)'] }, { duration: 300, easing: EASE.pop })));
        return;
      }
      const open = this.track(blink.animate({ transform: ['scaleY(0.06)', 'scaleY(1)'] }, { duration: BLINK_MS, easing: EASE.pop }));
      open.onfinish = () => close.cancel();
      open.oncancel = () => close.cancel();
    };
  }

  private blinkOnce() {
    this.track(this.parts.blink.animate({ transform: ['scaleY(1)', 'scaleY(0.06)', 'scaleY(1)'], offset: [0, 0.42, 1], easing: [EASE.lidDown, EASE.out] }, { duration: BLINK_MS }));
  }

  private scheduleBlink() {
    // Timed by the app's expression; whether it blinks is asked again when the time comes (a borrowed face may not).
    const range = MOOD[this.machine.mood].idle.blink ?? [3, 6];
    this.after(rand(range[0], range[1]), () => {
      if (MOOD[this.machine.face].idle.blink) {
        this.blinkOnce();
        // Sometimes twice in a row.
        if (Math.random() < 0.22) this.after(0.26, () => this.blinkOnce(), this.idleTimers);
      }
      this.scheduleBlink();
    }, this.idleTimers);
  }

  /** The small things an idle expression does by itself: a look around, a sweep of the eyes, a bob, a bounce, a shiver, what drifts off it. Only a mascot that moves does any of them. */
  private scheduleIdle() {
    if (this.orbiting) for (const el of this.parts.orbit) el.setAttribute('opacity', '0');
    this.orbiting = false;
    if (!this.moving) return;
    const spec = MOOD[this.machine.mood];
    const idle = spec.idle;
    const group = this.idleTimers;
    if (idle.glances) {
      const glance = () =>
        this.after(rand(3.6, 7.5), () => {
          this.wander = { x: rand(-0.75, 0.75), y: rand(-0.6, 0.6) };
          this.aim();
          this.after(rand(0.7, 1.5), () => {
            this.wander = { x: 0, y: 0 };
            this.aim();
            glance();
          }, group);
        }, group);
      glance();
    }
    if (idle.scan) {
      let side = 1;
      const sweep = () =>
        this.after(rand(0.7, 1.1), () => {
          side = -side;
          this.wander = { x: 0.7 * side, y: 0 };
          this.aim();
          sweep();
        }, group);
      sweep();
    }
    const extra = (every: number, name: 'bounce' | 'shiver') => {
      const again = () =>
        this.after(rand(every * 0.75, every * 1.35), () => {
          if (!this.machine.reaction) {
            this.motion = addExtra(this.motion, IDLE_EXTRA[name], this.now(), 'idle');
            this.run();
          }
          again();
        }, group);
      again();
    };
    if (idle.bounceEvery > 0) extra(idle.bounceEvery, 'bounce');
    if (idle.shiverEvery > 0) extra(idle.shiverEvery, 'shiver');
    if (!this.effects || this.tier !== 'full') return;
    if (spec.drift === 'z') {
      // One "z" after another, each growing as it drifts away; the next leaves as the last one fades.
      const snore = (first: boolean) =>
        this.after(first ? 0.6 : 2.1, () => {
          this.floatZ();
          snore(false);
        }, group);
      snore(true);
    } else if (spec.drift === 'orbit') {
      this.orbiting = true;
    }
  }

  // ---------- Where the eyes look ----------

  /** A gaze given from outside (-1..1), or null to give it back. */
  setLook(look: { x: number; y: number } | null) {
    this.given = look ? { x: clamp(look.x, -1, 1), y: clamp(look.y, -1, 1) } : null;
    this.aim();
  }

  setFollow(on: boolean) {
    if (on === this.follow) return;
    this.follow = on;
    if (!this.moving) return;
    if (on) this.listen();
    else this.unlisten();
  }

  private listen() {
    if (this.onMove || typeof matchMedia !== 'function' || matchMedia('(pointer: coarse)').matches) return;
    // Where the mascot is on the page, read at most four times a second (reading it makes the browser lay out).
    let box: DOMRect | null = null;
    let boxAt = 0;
    this.onMove = (e) => {
      if (this.pendingMove) return;
      this.pendingMove = requestAnimationFrame((t) => {
        this.pendingMove = 0;
        if (!box || t - boxAt > 250) {
          box = this.parts.svg.getBoundingClientRect();
          boxAt = t;
        }
        const dx = e.clientX - (box.left + box.width / 2);
        const dy = e.clientY - (box.top + box.height * 0.74);
        const reach = Math.max(260, box.width * 2.2);
        this.cursor = Math.hypot(dx, dy) < reach * 1.6 ? { x: clamp(dx / reach, -1, 1), y: clamp(dy / reach, -1, 1) } : null;
        this.aim();
        // Back to the middle once the pointer has been still for a while.
        if (this.cursorRest) this.clock.cancel(this.cursorRest);
        this.cursorRest = this.after(2.6, () => {
          this.cursor = null;
          this.aim();
        });
      });
    };
    window.addEventListener('pointermove', this.onMove, { passive: true });
  }

  private unlisten() {
    if (this.onMove) window.removeEventListener('pointermove', this.onMove);
    cancelAnimationFrame(this.pendingMove);
    this.pendingMove = 0;
    this.onMove = null;
    this.cursor = null;
  }

  /** Picks who the eyes obey: a given gaze, the pointer, a reaction, or the expression's own look and wander. */
  private aim(atOnce = false) {
    if (!this.drawing) return;
    const rest = MOOD[this.machine.face].look;
    const want = this.given ?? this.cursor ?? this.reactionLook ?? { x: clamp(rest.x + this.wander.x, -1, 1), y: clamp(rest.y + this.wander.y, -1, 1) };
    this.gazeGoal = { x: want.x * GLANCE.x, y: want.y * GLANCE.y };
    // A mascot that has just appeared, or one that does not move, looks there at once.
    if (atOnce || !this.moving) {
      this.gaze = this.gazeGoal;
      this.drawGaze();
      return;
    }
    this.easeGaze();
  }

  private drawGaze() {
    this.parts.look.setAttribute('transform', `translate(${this.gaze.x.toFixed(2)} ${this.gaze.y.toFixed(2)})`);
  }

  private easeGaze() {
    if (this.raf || this.clock.paused || !this.moving) return;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(64, t - last) * this.clock.rate;
      last = t;
      // Closes the same share of the gap however long the frame took.
      const k = 1 - Math.exp(-dt / 70);
      this.gaze = { x: this.gaze.x + (this.gazeGoal.x - this.gaze.x) * k, y: this.gaze.y + (this.gazeGoal.y - this.gaze.y) * k };
      this.drawGaze();
      const left = Math.abs(this.gazeGoal.x - this.gaze.x) + Math.abs(this.gazeGoal.y - this.gaze.y);
      this.raf = left > 0.15 && !this.clock.paused && this.active ? requestAnimationFrame(tick) : 0;
    };
    this.raf = requestAnimationFrame(tick);
  }

  // ---------- Stars and z's: flat shapes, transform and opacity only ----------

  /**
   * A burst of stars out of the body, all round. The old mascot's burst
   * (stars thrown from the middle, swelling, then falling a little and
   * fading), grown: two rings (large stars near, small ones flung further),
   * each star swelling a touch past its size as it leaves.
   */
  private burst(count: number, power: number) {
    const pool = this.parts.sparks;
    if (pool.length === 0) return;
    const origin = { x: EYES_CENTER.x + 5, y: 270 };
    const spread = 0.72 + 0.28 * power;
    for (let i = 0; i < count; i += 1) {
      const el = pool[this.nextSpark % pool.length]!;
      this.nextSpark += 1;
      this.sparkAnims.get(el)?.cancel();
      const far = i % 2 === 1;
      const angle = (i / count) * Math.PI * 2 + rand(-0.22, 0.22);
      const distance = (far ? rand(250, 310) : rand(185, 240)) * spread;
      const size = (far ? rand(20, 27) : rand(34, 46)) * (0.82 + 0.18 * power);
      const x = origin.x + Math.cos(angle) * distance;
      const y = origin.y + Math.sin(angle) * distance * 0.85;
      const at = (k: number) => `translate(${(origin.x + (x - origin.x) * k).toFixed(1)}px, ${(origin.y + (y - origin.y) * k).toFixed(1)}px)`;
      const turn = far ? -1 : 1;
      const a = this.track(
        el.animate(
          [
            { transform: `${at(0)} scale(0) rotate(0deg)`, opacity: 0 },
            { transform: `${at(0.42)} scale(${(size * 1.16).toFixed(2)}) rotate(${45 * turn}deg)`, opacity: 1, offset: 0.2 },
            { transform: `${at(1)} scale(${size.toFixed(2)}) rotate(${100 * turn}deg)`, opacity: 1, offset: 0.6 },
            { transform: `translate(${x.toFixed(1)}px, ${(y + 40).toFixed(1)}px) scale(${(size * 0.55).toFixed(2)}) rotate(${175 * turn}deg)`, opacity: 0 },
          ],
          // Out fast, then hanging a moment before it falls away (the old burst's curve, a little slower to fade).
          { duration: rand(1100, 1450), delay: i * 38, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)', fill: 'both' },
        ),
      );
      this.sparkAnims.set(el, a);
    }
  }

  /** Sets something drifting, moved by the idle timer (no animation of its own): the next free element of a pool. */
  private float(pool: readonly SVGElement[], life: number, at: (u: number) => { transform: string; opacity: number }) {
    if (pool.length === 0) return;
    const el = pool[this.nextFloat % pool.length]!;
    this.nextFloat += 1;
    this.floating = [...this.floating.filter((f) => f.el !== el), { el, born: this.now(), life, at }];
  }

  /** One "z" of a snore: it leaves the tip small, grows as it drifts up and away, swaying, and fades. */
  private floatZ() {
    this.float(this.parts.zs, 2.7, (u) => {
      // It starts just clear of the folded tip, so it is never drawn over the flame.
      const size = 1.3 + 1.5 * u;
      const x = 428 + 74 * u + 9 * Math.sin(u * Math.PI * 2.2);
      const y = 112 - 138 * u;
      const turn = -10 + 16 * Math.sin(u * Math.PI * 2);
      return { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${size.toFixed(2)}) rotate(${turn.toFixed(1)})`, opacity: u < 0.15 ? u / 0.15 : u > 0.7 ? (1 - u) / 0.3 : 1 };
    });
  }

  // ---------- For tests and the lab ----------

  get state(): MachineState {
    return this.machine;
  }

  /** Animations in flight and timers waiting: both are zero for a mascot that is not drawing. */
  get load(): { animations: number; timers: number } {
    return { animations: [...this.live].filter((a) => a.playState === 'running').length, timers: this.clock.pending };
  }
}

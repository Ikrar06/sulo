// The new mascot engine's pure parts: the body's bend, the eyes' shapes, the
// motion as a function of time, and the expression state machine. No DOM.
import { describe, expect, it } from 'vitest';
import { Clock } from '@sulo/ui/mascot-next/clock';
import { EYE, eyeOutline, eyePaths, type EyeForm } from '@sulo/ui/mascot-next/eyes';
import { initialState, reduce, REACTIONS, type MachineState } from '@sulo/ui/mascot-next/machine';
import { eyeChange, MOOD, MOODS } from '@sulo/ui/mascot-next/moods';
import { addExtra, busyFor, changeMood, frameAt, IDLE_EXTRA, REACTION_BODY, stanceAt, startMotion, type ReactionName } from '@sulo/ui/mascot-next/motion';
import { BASE, BODY, BRAND_BODY, faceCorners, nearestOn, outlineToPath, parseOutline, type Outline, type Pt } from '@sulo/ui/mascot-next/shape';
import { bodyPaths, REST, warpPoint, type Pose } from '@sulo/ui/mascot-next/warp';

const pose = (p: Partial<Pose>): Pose => ({ ...REST, ...p });
const TIP = { x: 334.217, y: 0 };

describe('the body bends as one', () => {
  it('at rest it is the brand shape, point for point', () => {
    const rest = bodyPaths(REST);
    expect(parseOutline(rest.back).segs).toHaveLength(BODY.back.segs.length);
    expect(rest.back).toBe(outlineToPath(BODY.back));
    expect(rest.face).toBe(outlineToPath(BODY.face));
  });

  it('the base never moves, whatever the pose', () => {
    for (const p of [pose({ stretch: 0.2 }), pose({ lean: 0.1, tip: 0.05 }), pose({ droop: 0.1, puff: 0.1, wave: 0.02, phase: 0.3 })]) {
      const at = warpPoint(BASE, p);
      expect(at.x).toBeCloseTo(BASE.x, 6);
      expect(at.y).toBeCloseTo(BASE.y, 6);
    }
  });

  it('taller is narrower and shorter is wider (the volume holds)', () => {
    const side = { x: BASE.x + 100, y: 400 };
    expect(warpPoint(side, pose({ stretch: 0.15 })).x).toBeLessThan(side.x);
    expect(warpPoint(side, pose({ stretch: -0.15 })).x).toBeGreaterThan(side.x);
    expect(warpPoint(TIP, pose({ stretch: 0.15 })).y).toBeLessThan(TIP.y);
  });

  it('a lean moves the tip far more than the face, so the tip can trail', () => {
    const p = pose({ lean: 0.05 });
    const face = { x: BASE.x, y: 406 };
    expect(warpPoint(TIP, p).x - TIP.x).toBeGreaterThan((warpPoint(face, p).x - face.x) * 4);
  });

  // The face's lower edge is drawn by the face alone: what the face hides of the flame's own lower edge is tucked in behind it (shape.ts).
  describe('the flame under the face', () => {
    const sample = (o: Outline, index: number, steps = 40): Pt[] => {
      const from = index === 0 ? o.start : o.segs[index - 1]![2];
      const [c1, c2, to] = o.segs[index]!;
      return Array.from({ length: steps + 1 }, (_, i) => {
        const t = i / steps;
        const u = 1 - t;
        return { x: u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x, y: u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y };
      });
    };
    const all = (o: Outline, steps = 40) => o.segs.flatMap((_, i) => sample(o, i, steps));
    const [right, left] = faceCorners(BODY.face);
    const iRight = BODY.face.segs.findIndex((seg) => seg[2] === right);
    const iLeft = BODY.face.segs.findIndex((seg) => seg[2] === left);
    const lowerEdge = BODY.face.segs.flatMap((_, i) => (i > iRight && i <= iLeft ? sample(BODY.face, i) : []));
    /** The face's lower edge as an outline of its own, to measure distances to it. */
    const lowerOutline: Outline = { start: right, segs: BODY.face.segs.slice(iRight + 1, iLeft + 1) };
    const farFrom = (p: Pt, q: Pt, d: number) => Math.hypot(p.x - q.x, p.y - q.y) > d;
    const facePolygon = all(BODY.face, 60);
    const within = (polygon: readonly Pt[], p: Pt) => {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
        const a = polygon[i]!;
        const b = polygon[j]!;
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
      }
      return inside;
    };
    const inFace = (p: Pt) => within(facePolygon, p);

    it('the face is the brand shape, and has two lower corners', () => {
      expect(outlineToPath(BODY.face)).toBe(outlineToPath(BRAND_BODY.face));
      expect(right.x).toBeGreaterThan(left.x);
      expect(lowerEdge.length).toBeGreaterThan(40);
    });

    it('no flame edge runs along the lower edge of the face any more (it did in the brand shapes)', () => {
      const inner = lowerEdge.filter((p) => farFrom(p, right, 8) && farFrom(p, left, 8));
      for (const p of inner) {
        expect(nearestOn(BODY.back, p).distance).toBeGreaterThan(3);
        expect(nearestOn(BODY.front, p).distance).toBeGreaterThan(3);
      }
      expect(Math.max(...inner.map((p) => nearestOn(BRAND_BODY.back, p).distance))).toBeLessThan(0.05);
    });

    it('everything of the flame that shows is exactly the brand shape', () => {
      // Every brand point that the face does not cover is still on the outline.
      for (const [brand, body] of [[BRAND_BODY.back, BODY.back], [BRAND_BODY.front, BODY.front]] as const) {
        const visible = all(brand, 24).filter((p) => !inFace(p) && nearestOn(lowerOutline, p).distance > 0.5);
        expect(visible.length).toBeGreaterThan(60);
        for (const p of visible) expect(nearestOn(body, p).distance).toBeLessThan(0.05);
      }
    });

    it('what was tucked in is behind the face, at rest and in every expression\'s stance', () => {
      const moved = (brand: Outline, body: Outline) => all(body, 24).filter((p) => nearestOn(brand, p).distance > 0.5);
      const tucked = [...moved(BRAND_BODY.back, BODY.back), ...moved(BRAND_BODY.front, BODY.front)];
      expect(moved(BRAND_BODY.back, BODY.back).length).toBeGreaterThan(20);
      expect(moved(BRAND_BODY.front, BODY.front).length).toBeGreaterThan(5);
      for (const p of tucked) expect(inFace(p)).toBe(true);
      const squashed = pose({ stretch: -0.22, lean: 0.06, puff: 0.08 });
      for (const bent of [...MOODS.map((mood) => MOOD[mood].pose), squashed]) {
        const face = facePolygon.map((p) => warpPoint(p, bent));
        for (const p of tucked) expect(within(face, warpPoint(p, bent))).toBe(true);
      }
    });
  });

  it('the two flame layers share their points: the tip of both lands in one place in any pose', () => {
    // The tip is the start of the front layer and the end of a segment of the back one.
    const p = pose({ stretch: 0.07, lean: -0.03, tip: 0.04, droop: 0.05, puff: 0.03, wave: 0.01, phase: 0.6 });
    const paths = bodyPaths(p);
    const front = parseOutline(paths.front).start;
    const back = parseOutline(paths.back).segs.map((s) => s[2]).find((e) => Math.abs(e.x - front.x) < 0.2 && Math.abs(e.y - front.y) < 0.2);
    expect(back).toBeDefined();
  });
});

describe('eyes that can turn into one another', () => {
  const forms = Object.entries(EYE) as [string, EyeForm][];

  it('every form is eight segments starting at its top center, for both eyes', () => {
    for (const [name, form] of forms)
      for (const side of [-1, 1] as const) {
        const o = eyeOutline(form, side);
        expect(o.segs, name).toHaveLength(8);
        const last = o.segs[7]![2];
        expect(Math.abs(last.x - o.start.x) + Math.abs(last.y - o.start.y), `${name} closes`).toBeLessThan(0.01);
        const ys = o.segs.map((s) => s[2].y);
        // Anchor five (the fourth segment's end) is the bottom center: below the start.
        expect(o.segs[3]![2].y, `${name} bottom under top`).toBeGreaterThan(o.start.y);
        expect(Math.min(...ys), name).toBeGreaterThanOrEqual(o.start.y - 0.01 - (form.kind === 'pill' ? Math.abs(form.slope ?? 0) : form.kind === 'cup' ? 60 : 0));
      }
  });

  it('the open and wide eyes are the brand rectangles', () => {
    const [left] = eyePaths([EYE.open, EYE.open]);
    const o = parseOutline(left);
    const xs = [o.start.x, ...o.segs.map((s) => s[2].x)];
    const ys = [o.start.y, ...o.segs.map((s) => s[2].y)];
    expect(Math.min(...xs)).toBeCloseTo(161.42, 0);
    expect(Math.max(...xs)).toBeCloseTo(211.86, 0);
    expect(Math.min(...ys)).toBeCloseTo(360.67, 0);
    expect(Math.max(...ys)).toBeCloseTo(451.47, 0);
  });

  it('a small mascot draws larger eyes around the same centers', () => {
    const o = (scale: number) => parseOutline(eyePaths([EYE.open, EYE.open], scale)[0]);
    const width = (v: ReturnType<typeof o>) => Math.max(...v.segs.map((s) => s[2].x)) - Math.min(...v.segs.map((s) => s[2].x));
    expect(width(o(1.22)) / width(o(1))).toBeCloseTo(1.22, 2);
  });
});

describe('expressions', () => {
  it('no two expressions share both stance and eyes', () => {
    const key = (m: (typeof MOODS)[number]) => JSON.stringify([MOOD[m].pose, MOOD[m].eyes, MOOD[m].special]);
    expect(new Set(MOODS.map(key)).size).toBe(MOODS.length);
  });

  it('spiral eyes and star-to-closed change through a blink; the rest blend', () => {
    expect(eyeChange('neutral', 'happy')).toBe('blend');
    expect(eyeChange('neutral', 'dizzy')).toBe('blink');
    expect(eyeChange('dizzy', 'sad')).toBe('blink');
    expect(eyeChange('happy', 'celebrate')).toBe('blink');
    expect(eyeChange('sleepy', 'worried')).toBe('blend');
  });
});

describe('motion as a function of time', () => {
  it('a change of stance leaves from where it was and arrives', () => {
    const from = MOOD.neutral.pose;
    const to = MOOD.proud.pose;
    expect(stanceAt(from, to, 0)).toEqual(from);
    expect(stanceAt(from, to, 4).stretch).toBeCloseTo(to.stretch, 4);
  });

  it('a big rise first dips (anticipation), and the tip is left behind on the way', () => {
    const from = MOOD.neutral.pose;
    const to = MOOD.proud.pose;
    expect(stanceAt(from, to, 0.08).stretch).toBeLessThan(from.stretch);
    // While the body is nearly all the way up, the tip still hangs back: it has not reached where it will rest.
    const mid = stanceAt(from, to, 0.3);
    expect(mid.stretch).toBeGreaterThan(to.stretch * 0.9);
    expect(mid.droop).toBeGreaterThan(to.droop + 0.015);
    // Later it swings past its rest (follow-through) before settling.
    expect(Math.min(...[0.45, 0.5, 0.55, 0.6, 0.65].map((t) => stanceAt(from, to, t).droop))).toBeLessThan(to.droop - 0.004);
  });

  it('nothing jumps when the expression changes mid-flight', () => {
    let m = startMotion('neutral', 0);
    m = changeMood(m, 'sad', 2);
    const before = frameAt(m, 2.3);
    const changed = changeMood(m, 'happy', 2.3);
    const after = frameAt(changed, 2.3);
    for (const k of ['stretch', 'lean', 'tip', 'droop', 'puff'] as const) expect(after.pose[k]).toBeCloseTo(before.pose[k], 5);
  });

  it('every reaction and idle extra starts and ends at nothing', () => {
    const all = { ...REACTION_BODY, ...IDLE_EXTRA };
    for (const [name, extra] of Object.entries(all)) {
      for (const t of [0, extra.duration - 1e-6]) {
        const d = extra.at(t);
        for (const [k, v] of Object.entries(d)) expect(Math.abs(v ?? 0), `${name}.${k} at ${t === 0 ? 'start' : 'end'}`).toBeLessThan(0.012 * (k === 'lift' || k === 'shift' ? 200 : 1));
      }
    }
  });

  it("a reaction adds to the idle body and is over after its length; the face's cues fit inside it", () => {
    let m = startMotion('neutral', 0);
    expect(busyFor(m, 1)).toBe(0);
    m = addExtra(m, REACTION_BODY.jump, 1);
    expect(busyFor(m, 1)).toBeCloseTo(REACTION_BODY.jump.duration, 5);
    expect(frameAt(m, 1.45).lift).toBeGreaterThan(20);
    expect(busyFor(m, 1 + REACTION_BODY.jump.duration + 0.01)).toBe(0);
    for (const name of Object.keys(REACTIONS) as ReactionName[]) {
      expect(REACTION_BODY[name].duration, name).toBeLessThanOrEqual(REACTIONS[name].duration + 1e-9);
      for (const cue of REACTIONS[name].cues) expect(cue.at, name).toBeLessThanOrEqual(REACTIONS[name].duration);
    }
  });

  it('idle life does not come round again within a minute', () => {
    const m = startMotion('neutral', 0);
    const sample = (t: number) => {
      const f = frameAt(m, t).pose;
      return [f.lean, f.tip, f.droop, Math.sin(f.phase * 6.283)];
    };
    const first = sample(3);
    for (let t = 3.5; t < 63; t += 0.5) {
      const now = sample(t);
      const gap = now.reduce((sum, v, i) => sum + Math.abs(v - first[i]!), 0);
      expect(gap, `t=${t}`).toBeGreaterThan(1e-4);
    }
  });
});

describe('the expression state machine', () => {
  const run = (state: MachineState, ...events: Parameters<typeof reduce>[1][]) => events.reduce((acc, e) => ({ ...reduce(acc.state, e), log: [...acc.log, ...reduce(acc.state, e).effects] }), { state, effects: [] as ReturnType<typeof reduce>['effects'], log: [] as ReturnType<typeof reduce>['effects'] });

  it('a new expression moves the body and changes the face', () => {
    const r = reduce(initialState('neutral'), { type: 'mood', mood: 'sad' });
    expect(r.state).toMatchObject({ mood: 'sad', face: 'sad' });
    expect(r.effects).toEqual([{ type: 'stance', to: 'sad' }, { type: 'face', from: 'neutral', to: 'sad', via: 'blend' }]);
    expect(reduce(r.state, { type: 'mood', mood: 'sad' }).effects).toEqual([]);
  });

  it('a reaction borrows the face and gives it back to whatever the app shows by then', () => {
    const started = reduce(initialState('neutral'), { type: 'react', name: 'celebrate' });
    const id = started.state.reaction!.id;
    const r = run(started.state, { type: 'cue', id, face: 'celebrate' }, { type: 'mood', mood: 'worried' }, { type: 'cue', id, face: 'happy' }, { type: 'end', id });
    expect(r.state).toMatchObject({ mood: 'worried', face: 'worried', reaction: null });
    // The body went to the new stance at once; the face stayed borrowed until the end.
    expect(r.log.filter((e) => e.type === 'stance')).toEqual([{ type: 'stance', to: 'worried' }]);
    expect(r.log.filter((e) => e.type === 'face').map((e) => (e.type === 'face' ? e.to : ''))).toEqual(['celebrate', 'happy', 'worried']);
  });

  it('a lower reaction waits out a higher one; an equal or higher one takes over', () => {
    const celebrating = reduce(initialState('happy'), { type: 'react', name: 'celebrate' }).state;
    expect(reduce(celebrating, { type: 'react', name: 'tap' }).effects).toEqual([]);
    const tapped = reduce(initialState('happy'), { type: 'react', name: 'tap' }).state;
    const again = reduce(tapped, { type: 'react', name: 'tap' });
    expect(again.effects.map((e) => e.type)).toEqual(['cancel', 'start']);
    expect(again.state.reaction!.id).not.toBe(tapped.reaction!.id);
  });

  it("cues of a reaction that was cut short do nothing", () => {
    const first = reduce(initialState('neutral'), { type: 'react', name: 'done' }).state;
    const second = reduce(first, { type: 'react', name: 'fail' }).state;
    expect(reduce(second, { type: 'cue', id: first.reaction!.id, face: 'happy' }).effects).toEqual([]);
    expect(reduce(second, { type: 'end', id: first.reaction!.id }).state).toBe(second);
  });
});

describe('what the face and the eyes follow', () => {
  it('while it only idles, the pose without the sway is the stance itself: the face and the eyes need no animation', () => {
    const m = startMotion('neutral', 0);
    for (const t of [5, 9.3, 21.7]) {
      const f = frameAt(m, t);
      expect(f.core).toEqual(MOOD.neutral.pose);
      expect(Math.abs(f.pose.lean) + Math.abs(f.pose.tip)).toBeGreaterThan(0);
    }
  });

  it('a reaction moves both the flame and the face', () => {
    const m = addExtra(startMotion('neutral', 0), REACTION_BODY.tap, 5);
    expect(frameAt(m, 5.08).core.stretch).toBeLessThan(-0.05);
  });

  it('a new reaction lets go of the one in flight instead of adding to it', () => {
    let m = addExtra(startMotion('neutral', 0), REACTION_BODY.celebrate, 1);
    const alone = frameAt(m, 1.45).lift;
    m = addExtra(m, REACTION_BODY.celebrate, 1.45);
    // A quarter of a second on, the first celebration's lift is gone: only the second one's is left.
    const second = frameAt(addExtra(startMotion('neutral', 0), REACTION_BODY.celebrate, 1.45), 1.7).lift;
    expect(frameAt(m, 1.7).lift).toBeCloseTo(second, 3);
    expect(alone).toBeGreaterThan(30);
  });

  it('a mascot that has just appeared starts from rest: its idle life grows in', () => {
    const f = frameAt(startMotion('neutral', 3), 3);
    expect(f.pose.lean).toBe(0);
    expect(f.pose.tip).toBe(0);
  });
});

describe("the rig's clock", () => {
  it('runs at its rate, stands still while paused, and steps by hand', () => {
    let wall = 0;
    const clock = new Clock(() => wall);
    clock.start();
    wall = 1000;
    expect(clock.now()).toBeCloseTo(1, 6);
    clock.setRate(0.5);
    wall = 3000;
    expect(clock.now()).toBeCloseTo(2, 6);
    clock.setPaused(true);
    wall = 9000;
    expect(clock.now()).toBeCloseTo(2, 6);
    clock.step(0.25);
    expect(clock.now()).toBeCloseTo(2.25, 6);
    clock.stop();
  });

  it('a stepped clock runs what came due, in order, timers set by timers included; a cancelled one never runs', () => {
    let wall = 0;
    const clock = new Clock(() => wall);
    clock.start();
    clock.setPaused(true);
    const ran: string[] = [];
    clock.after(0.3, () => ran.push('b'));
    clock.after(0.1, () => {
      ran.push('a');
      clock.after(0.1, () => ran.push('a2'));
    });
    const gone = clock.after(0.2, () => ran.push('gone'));
    clock.cancel(gone);
    clock.step(0.25);
    expect(ran).toEqual(['a', 'a2']);
    clock.step(0.1);
    expect(ran).toEqual(['a', 'a2', 'b']);
    expect(clock.pending).toBe(0);
    clock.stop();
  });

  it('stopping forgets every timer', () => {
    const clock = new Clock(() => 0);
    clock.start();
    clock.after(5, () => undefined);
    clock.stop();
    expect(clock.pending).toBe(0);
  });
});

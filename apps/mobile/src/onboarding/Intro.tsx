// Screens 1-3 as one pager (M8c.2). The pages follow the finger, forward
// and back, not a threshold: the drag writes one number, --p (0 to 2), and
// everything is placed from it in CSS: the pages, their layers at
// different speeds (parallax), the texts, the page dots. The mascot stands
// still at its place and only changes its expression with the nearest page.
// A release settles on the nearest page, carried by the release speed.
// Going back never replays a scene: it stands in its final arrangement and
// only the slide runs. Reduced motion: no following and no parallax; a swipe
// or a tap changes the page with a short fade.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import type { MascotExpression } from '@sulo/core/dashboard/mascot-mood';
import type { OnboardingWords } from '@sulo/core/i18n/mobile-onboarding';
import { MascotSpot, useMascot } from './FlyingMascot';
import { BackButton, Frame, useTitleFocus } from './Frame';
import { EASE_OUT, reducedMotion } from './motion';
import { At, Scene } from './Scene';
import { INTRO_COMPACT_H, INTRO_H, MASCOT_SIZE, mascotAt, ScenePrivate, SceneRemind, SceneTasks } from './scenes-intro';

const PAGES = 3;
/** The mascot's resting expression on each page. */
const REST: MascotExpression[] = ['neutral', 'happy', 'proud'];
const SETTLE_MS = 340;
/** A step change: the new content waits 110 ms and takes 240 ms (styles.css). */
const STEP_IN_MS = 300;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface IntroProps {
  w: OnboardingWords;
  /** The page the flow is on (0-2). */
  index: number;
  /** Pages whose scene has played (kept by the flow, so coming back from sign-in does not replay). */
  played: Set<number>;
  onIndex: (index: number) => void;
  onStart: () => void;
  onSkip: () => void;
}

export function Intro({ w, index, played, onIndex, onStart, onSkip }: IntroProps) {
  const mascot = useMascot();
  const root = useRef<HTMLDivElement | null>(null);
  const p = useRef(index);
  const raf = useRef(0);
  const [near, setNear] = useState(index);
  const nearRef = useRef(index);
  /** The page whose scene is playing now (null: all stand in their final arrangement). */
  const [playing, setPlaying] = useState<number | null>(() => (played.has(index) ? null : index));
  // Decided while rendering, so the page's first painted frame is already the start of its scene (never a flash of the final arrangement).
  /** How long the page now playing takes to arrive: the step's slide for the first one shown, the pager's glide after that. */
  const arrive = useRef(STEP_IN_MS);
  const first = useRef(index);
  const [seen, setSeen] = useState(index);
  if (seen !== index) {
    setSeen(index);
    setPlaying(played.has(index) ? null : index);
  }
  // Any page after the first one shown arrives by the pager's glide.
  if (seen !== index || index !== first.current) arrive.current = SETTLE_MS;
  const drag = useRef<{ x: number; y: number; p0: number; on: boolean; samples: { t: number; p: number }[] } | null>(null);
  const titleRef = useTitleFocus(`intro${index}`);
  const pages = [w.intro1, w.intro2, w.intro3];

  /** Everything the pager moves: pages, their layers, the texts, the dots. Collected once per layout. */
  const parts = useRef<{ el: HTMLElement; kind: string; i: number; depth: number }[]>([]);
  const collect = useCallback(() => {
    parts.current = [...(root.current?.querySelectorAll<HTMLElement>('[data-pg]') ?? [])].map((el) => ({ el, kind: el.dataset.pg!, i: Number(el.closest<HTMLElement>('[data-pg-i]')?.dataset.pgI ?? 0), depth: Number(el.dataset.depth ?? 0) }));
  }, []);

  /**
   * Places everything for page position `v`. Styles are written straight to
   * these few elements (no inherited variable, so nothing else is restyled),
   * transform and opacity only.
   */
  const place = useCallback((v: number) => {
    p.current = v;
    const reduced = reducedMotion();
    for (const { el, kind, i, depth } of parts.current) {
      const d = i - v;
      const a = Math.max(0, 1 - Math.abs(d));
      if (kind === 'page') {
        if (reduced) el.style.opacity = String(Math.max(0, 1 - Math.abs(d) * 2));
        else el.style.transform = `translateX(${(d * 420).toFixed(1)}px)`;
        el.style.visibility = Math.abs(d) >= 1 ? 'hidden' : 'visible';
      } else if (kind === 'layer') {
        if (!reduced && depth !== 0) el.style.transform = `translateX(${(d * depth).toFixed(1)}px)`;
      } else if (kind === 'text') {
        el.style.opacity = String(Math.max(0, 1 - Math.abs(d) * 1.6));
        if (!reduced) el.style.transform = `translateX(${(d * 56).toFixed(1)}px)`;
        el.style.visibility = Math.abs(d) >= 0.625 ? 'hidden' : 'visible';
      } else if (kind === 'dot') {
        el.style.transform = `scaleX(${(0.375 + 0.625 * a).toFixed(3)})`;
        el.style.opacity = String(0.25 + 0.75 * a);
      }
    }
    const n = Math.round(clamp(v, 0, PAGES - 1));
    if (n !== nearRef.current) {
      nearRef.current = n;
      setNear(n);
    }
  }, []);

  const glide = useCallback((on: boolean) => {
    for (const { el } of parts.current) el.style.transition = on ? `transform ${SETTLE_MS}ms ${EASE_OUT}, opacity ${SETTLE_MS}ms ${EASE_OUT}` : 'none';
  }, []);

  /** Where the pages are right now, even in the middle of a glide (read from the first page). */
  const livePosition = useCallback(() => {
    const first = parts.current.find((x) => x.kind === 'page' && x.i === 0)?.el;
    if (!first || reducedMotion()) return p.current;
    const m = new DOMMatrixReadOnly(getComputedStyle(first).transform);
    return -m.m41 / 420;
  }, []);

  /** Settles on a page: one compositor transition per part, no script per frame. */
  const settle = useCallback(
    (to: number) => {
      window.clearTimeout(raf.current);
      if (reducedMotion() || Math.abs(to - p.current) < 0.001) {
        glide(false);
        return place(to);
      }
      glide(true);
      // Next frame, so the transition starts from where the finger left it.
      requestAnimationFrame(() => place(to));
      raf.current = window.setTimeout(() => glide(false), SETTLE_MS + 40);
    },
    [place, glide],
  );
  useLayoutEffect(() => {
    collect();
    glide(false);
    place(p.current);
    return () => window.clearTimeout(raf.current);
    // Once: the parts are stable while the pager is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The flow's page changed (a button, a dot, Back, or a swipe that settled).
  useEffect(() => {
    if (!drag.current?.on) settle(index);
    // Remembered after it was decided: this page's scene will not play again.
    played.add(index);
  }, [index, settle, played]);

  // The scene may have switched canvas (compact): the parts are collected again.
  useEffect(() => {
    collect();
    if (!drag.current?.on) place(p.current);
  });

  // The mascot stays; its face follows the nearest page.
  useEffect(() => {
    mascot.express(playing === near ? 'neutral' : REST[near]!);
  }, [mascot, near, playing]);

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, p0: p.current, on: false, samples: [] };
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.on) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - d.y)) return;
      d.on = true;
      d.x = e.clientX;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      // Catch the pages where they are, even mid-glide.
      window.clearTimeout(raf.current);
      const live = livePosition();
      glide(false);
      collect();
      place(live);
      d.p0 = live;
      return;
    }
    if (reducedMotion()) return;
    const width = root.current?.clientWidth || 360;
    const raw = d.p0 - dx / width;
    // Past the first and last page the pull resists.
    const v = raw < 0 ? raw * 0.3 : raw > PAGES - 1 ? PAGES - 1 + (raw - (PAGES - 1)) * 0.3 : raw;
    d.samples = [...d.samples.slice(-4), { t: e.timeStamp, p: v }];
    place(v);
  };
  const onUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.on) return;
    const base = clamp(Math.round(d.p0), 0, PAGES - 1);
    let target: number;
    if (reducedMotion()) {
      const dx = e.clientX - d.x;
      target = Math.abs(dx) < 48 ? base : base + (dx < 0 ? 1 : -1);
    } else {
      const a = d.samples[0];
      const b = d.samples.at(-1);
      const speed = a && b && b.t > a.t ? (b.p - a.p) / (b.t - a.t) : 0;
      // The release carries on for a moment at its own speed.
      target = Math.round(p.current + speed * 160);
    }
    target = clamp(target, Math.max(0, base - 1), Math.min(PAGES - 1, base + 1));
    settle(target);
    if (target !== index) onIndex(target);
  };

  const last = index === PAGES - 1;
  return (
    <div ref={root} className="onb-pager">
      <Frame
        topLeft={index > 0 ? <BackButton label={w.back} onPress={() => onIndex(index - 1)} /> : null}
        topRight={
          <button type="button" onClick={onSkip} className="m-hit rounded-full px-2 text-m13 text-muted-foreground outline-none focus-ring:ring-2 focus-ring:ring-focus">
            {w.skip}
          </button>
        }
        hint={
          <div role="tablist" aria-label={w.pageOf(index + 1, PAGES)} className="box-content flex h-[6px] items-center gap-1 py-[20px]">
            {pages.map((page, i) => (
              <button key={page.title} type="button" role="tab" aria-selected={i === index} aria-label={w.pageOf(i + 1, PAGES)} onClick={() => onIndex(i)} className="m-hit flex h-1.5 w-5 items-center justify-center outline-none focus-ring:ring-2 focus-ring:ring-focus">
                <span data-pg="dot" data-pg-i={i} className="block h-1.5 w-4 rounded-full bg-foreground" />
              </button>
            ))}
          </div>
        }
        primary={{ label: last ? w.intro3.start : w.next, onPress: last ? onStart : () => onIndex(index + 1) }}
        secondary={last ? <p className="text-m12 text-muted-foreground">{w.unofficial}</p> : null}
      >
        <div className="onb-swipe -mx-4 flex min-h-0 flex-1 flex-col overflow-x-clip px-4" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <Scene label={pages[index]!.stage} h={INTRO_H} compactH={INTRO_COMPACT_H}>
            {(compact, width) => (
              <>
                {[SceneTasks, SceneRemind, ScenePrivate].map((S, i) => (
                  <div key={i} data-pg="page" data-pg-i={i} className="absolute inset-0 will-change-transform">
                    <S w={w} compact={compact} width={width} play={playing === i} lead={arrive.current} />
                  </div>
                ))}
                {/* The mascot's place: the same on all three pages, so it never moves here. */}
                <At x={mascotAt(compact, width).x} y={mascotAt(compact, width).y} z={5}>
                  <MascotSpot size={MASCOT_SIZE} />
                </At>
              </>
            )}
          </Scene>
          {/* The three texts share one cell, as tall as the tallest: the stage is the same on every page. */}
          <div className="grid shrink-0 pt-3 text-center">
            {pages.map((page, i) => (
              <div key={page.title} aria-hidden={i === index ? undefined : true} data-pg="text" data-pg-i={i} className="col-start-1 row-start-1 flex flex-col items-center justify-center">
                <h1 ref={i === index ? titleRef : undefined} tabIndex={-1} className="onb-title outline-none">
                  {page.title}
                </h1>
                <p className="mt-1.5 text-m15r text-muted-foreground">{page.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Frame>
    </div>
  );
}

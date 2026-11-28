// The Sulo mascot, new engine: one component for the extension, the Android
// app and, later, the landing page.
//
// The markup is the expression at rest: the three body shapes in the
// expression's stance and its eyes. That is all a still mascot is (motion
// "off", a tiny one, a server render, a test): no engine is made for it.
// When it may move, rig.ts takes the same elements and animates them;
// nothing is drawn twice.
//
//   mood        which expression (moods.ts)
//   lookX/Y     where the eyes look, -1..1 (x right, y down); leave out for the expression's own gaze
//   followCursor  the eyes follow a fine pointer nearby and return when it rests
//   motion      full | lite | off; by default lite under reduced motion or the lite tier, else full
//   reaction    { name, key }: plays `name` once for each new `key` (one given at mount plays too); or call react() on the ref
//   size        px or any CSS length; under 32 px it is a still drawing with larger eyes,
//               under 72 px it idles at half the keys and has no stars or z's

import { forwardRef, useContext, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { spiralPath, STAR_CENTERS, Z_PATH } from './geometry';
import { MASCOT_SHAPES } from './shapes.generated';
import { MascotScopeContext } from './context';
import { eyePaths } from './eyes';
import { MOOD, type Mood } from './moods';
import type { ReactionName } from './motion';
import { MascotRig, type MotionMode, type SizeTier } from './rig';
import { EYE_CENTERS, GLANCE, GRADIENTS, VIEW_BOX } from './shape';
import { bodyPaths, eyesTransform } from './warp';
import './mascot.css';

export interface SuloMascotProps {
  mood: Mood;
  /** Pixel size or any CSS length. */
  size?: number | string;
  lookX?: number;
  lookY?: number;
  followCursor?: boolean;
  motion?: MotionMode;
  reaction?: { name: ReactionName; key: number } | null;
  /** Bursts of stars and what an idle expression gives off (a z asleep, stars round a dizzy head); by default from 96 px up. */
  effects?: boolean;
  /** A contact shadow under it. */
  grounded?: boolean;
  /** Accessible label; decorative when left out. */
  label?: string;
  className?: string;
  /**
   * Room above the drawing for its jumps, as a share of its size (0.25 for a celebration's tallest hop).
   * Safari (WebKit) clips an SVG's moving parts at the SVG's own box whatever its overflow says, which cut
   * the mascot's head off mid-jump on an iPhone (owner, 27 Nov 2026). The box grows upward by this much and
   * a negative margin takes it back, so the mascot's size and place do not change; the added room takes no
   * taps.
   */
  headroom?: number;
}

export interface SuloMascotHandle {
  react: (name: ReactionName) => void;
  /** The engine, for the lab (speed, pause, step). Null while the mascot is still. */
  rig: MascotRig | null;
}

const media = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => media('(prefers-reduced-motion: reduce)'));
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mql = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** On screen and in a page that is shown. A still mascot watches neither. */
function useVisible(ref: RefObject<Element | null>, watch: boolean): boolean {
  const [page, setPage] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const [inView, setInView] = useState(true);
  useEffect(() => {
    if (!watch) return;
    const onChange = () => setPage(document.visibilityState !== 'hidden');
    onChange();
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [watch]);
  useEffect(() => {
    const el = ref.current;
    if (!watch || !el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => setInView(entries.some((e) => e.isIntersecting)));
    io.observe(el);
    return () => io.disconnect();
  }, [ref, watch]);
  return page && inView;
}

export const tierFor = (size: number | string): SizeTier => (typeof size !== 'number' ? 'full' : size < 32 ? 'tiny' : size < 72 ? 'small' : 'full');

/** The brand's star eyes (eyes-star.svg), each with the center it spins on. */
const STAR_EYES = (MASCOT_SHAPES.eyes.star.match(/d="([^"]+)"/g) ?? []).map((d, i) => ({ d: d.slice(3, -1), center: STAR_CENTERS[i] ?? STAR_CENTERS[0] }));

/** A four-point star around (0, 0), one unit to each point: fuller than a hairline cross, so it reads when small. */
const STAR_PATH = 'M0 -1 C0.2 -0.44 0.44 -0.2 1 0 C0.44 0.2 0.2 0.44 0 1 C-0.2 0.44 -0.44 0.2 -1 0 C-0.44 -0.2 -0.2 -0.44 0 -1 Z';

const SPARKS = 16;
const ZS = 3;
const ORBIT = 3;

export const SuloMascot = forwardRef<SuloMascotHandle, SuloMascotProps>(function SuloMascot(
  { mood, size = 48, lookX, lookY, followCursor = false, motion, reaction = null, effects, grounded = false, label, className, headroom = 0 },
  ref,
) {
  const scope = useContext(MascotScopeContext);
  const reduced = useReducedMotion();
  const mode: MotionMode = motion ?? (reduced || scope.lite ? 'lite' : 'full');
  const tier = tierFor(size);
  // A still mascot is its markup: no engine, no observers, no timers.
  const still = mode === 'off' || tier === 'tiny';
  const fx = (effects ?? (typeof size === 'number' ? size >= 96 : true)) && tier === 'full' && mode === 'full';
  const id = useId().replace(/:/g, '');

  const svg = useRef<SVGSVGElement>(null);
  const root = useRef<SVGGElement>(null);
  const back = useRef<SVGPathElement>(null);
  const front = useRef<SVGPathElement>(null);
  const face = useRef<SVGPathElement>(null);
  const eyes = useRef<SVGGElement>(null);
  const look = useRef<SVGGElement>(null);
  const blink = useRef<SVGGElement>(null);
  const eyeL = useRef<SVGPathElement>(null);
  const eyeR = useRef<SVGPathElement>(null);
  const drawn = useRef<SVGGElement>(null);
  const stars = useRef<SVGGElement>(null);
  const spirals = useRef<SVGGElement>(null);
  const shadow = useRef<SVGEllipseElement>(null);
  const fxGroup = useRef<SVGGElement>(null);
  const rig = useRef<MascotRig | null>(null);
  // What the rig is told when it is (re)made: the newest of each.
  const told = useRef({ mood, mode, tier, fx, followCursor, lookX, lookY });
  told.current = { mood, mode, tier, fx, followCursor, lookX, lookY };

  const visible = useVisible(svg, !still) && !scope.paused;

  // One rig while the mascot may move. It is told what changed; it never re-renders the component.
  useEffect(() => {
    const el = svg.current;
    if (still || !el || !root.current || !back.current || !front.current || !face.current || !eyes.current || !look.current || !blink.current || !eyeL.current || !eyeR.current || !drawn.current || !stars.current || !spirals.current) return;
    const all = (selector: string) => [...(fxGroup.current?.querySelectorAll<SVGElement>(selector) ?? [])];
    const now = told.current;
    const made = new MascotRig(
      {
        svg: el,
        root: root.current,
        back: back.current,
        front: front.current,
        face: face.current,
        eyes: eyes.current,
        look: look.current,
        blink: blink.current,
        eyeL: eyeL.current,
        eyeR: eyeR.current,
        drawn: drawn.current,
        stars: stars.current,
        spirals: spirals.current,
        starEyes: [...stars.current.querySelectorAll<SVGElement>('.sm-star-eye')],
        spiralEyes: [...spirals.current.querySelectorAll<SVGElement>('.sm-spiral')],
        shadow: shadow.current,
        sparks: all('.sm-spark'),
        zs: all('.sm-z'),
        orbit: all('.sm-orbit'),
      },
      { mood: now.mood, motion: now.mode, tier: now.tier, effects: now.fx },
    );
    made.setFollow(now.followCursor);
    made.setLook(now.lookX === undefined && now.lookY === undefined ? null : { x: now.lookX ?? 0, y: now.lookY ?? 0 });
    rig.current = made;
    return () => {
      made.destroy();
      rig.current = null;
    };
    // The rig is rebuilt only when its elements are (the spark pool and the shadow come and go) or it stops being still.
  }, [still, fx, grounded]);

  useEffect(() => rig.current?.setMotion(mode), [mode]);
  useEffect(() => rig.current?.setTier(tier, fx), [tier, fx]);
  useEffect(() => rig.current?.setMood(mood), [mood]);
  useEffect(() => rig.current?.setFollow(followCursor), [followCursor]);
  useEffect(() => rig.current?.setLook(lookX === undefined && lookY === undefined ? null : { x: lookX ?? 0, y: lookY ?? 0 }), [lookX, lookY]);
  // Last, so the rig starts with everything above already told.
  useEffect(() => rig.current?.setActive(visible), [visible, still, fx, grounded]);

  // A reaction it is given plays once: also one it is mounted with (the empty list that has just been cleared).
  const played = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!reaction || reaction.key === played.current) return;
    played.current = reaction.key;
    rig.current?.react(reaction.name);
  }, [reaction]);

  useImperativeHandle(
    ref,
    () => ({
      react: (name) => rig.current?.react(name),
      get rig() {
        return rig.current;
      },
    }),
    [],
  );

  const spec = MOOD[mood];
  const body = useMemo(() => bodyPaths(spec.pose), [spec]);
  const pair = useMemo(() => eyePaths(spec.eyes, tier === 'tiny' ? 1.22 : 1), [spec, tier]);
  // A still mascot's gaze is drawn here; a moving one's is the rig's, on the group inside.
  const gaze = still ? { x: (lookX ?? spec.look.x) * GLANCE.x, y: (lookY ?? spec.look.y) * GLANCE.y } : null;
  const [g0, g1] = GRADIENTS;
  const cssSize = typeof size === 'number' ? `${size}px` : size;
  // The jump room: viewBox units added above, the box as much taller, the same back as a negative margin.
  const room = Math.max(0, headroom) * VIEW_BOX.height;
  const boxStyle: CSSProperties = room > 0
    ? { width: cssSize, height: `calc(${cssSize} * ${1 + headroom})`, marginTop: `calc(${cssSize} * ${-headroom})`, pointerEvents: 'none' }
    : { width: cssSize, height: cssSize };
  const classes = ['sm', `is-${mood}`, `sm-${still ? 'off' : mode}`, className].filter(Boolean).join(' ');

  return (
    <svg
      ref={svg}
      viewBox={`${VIEW_BOX.x} ${VIEW_BOX.y - room} ${VIEW_BOX.width} ${VIEW_BOX.height + room}`}
      style={boxStyle}
      className={classes}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}-g0`} x1={g0.x1} y1={g0.y1} x2={g0.x2} y2={g0.y2} gradientUnits="userSpaceOnUse">
          <stop offset={0} className="sm-st-a" />
          <stop offset={1} className="sm-st-b" />
        </linearGradient>
        <linearGradient id={`${id}-g1`} x1={g1.x1} y1={g1.y1} x2={g1.x2} y2={g1.y2} gradientUnits="userSpaceOnUse">
          <stop offset={0} className="sm-st-a" />
          <stop offset={0.5} className="sm-st-b" />
          <stop offset={1} className="sm-st-c" />
        </linearGradient>
      </defs>
      {grounded && <ellipse ref={shadow} className="sm-shadow" cx={245} cy={520} rx={112} ry={11} />}
      <g ref={root} className="sm-root" style={room > 0 ? { pointerEvents: 'visiblePainted' } : undefined}>
        {/* Back flame, front flame, face: one body. Every move bends all three by the same rule (warp.ts). */}
        <path ref={back} className="sm-back" d={body.back} fill={`url(#${id}-g0)`} />
        <path ref={front} className="sm-front" d={body.front} fill={`url(#${id}-g1)`} />
        <path ref={face} className="sm-face" d={body.face} />
        <g ref={eyes} className="sm-eyes" style={{ transform: eyesTransform(spec.pose) }}>
          <g transform={gaze ? `translate(${gaze.x.toFixed(2)} ${gaze.y.toFixed(2)})` : undefined}>
            <g ref={look} className="sm-look">
              <g ref={blink} className="sm-blink">
                <g ref={drawn} className="sm-drawn">
                  <path ref={eyeL} className="sm-eye" d={pair[0]} />
                  <path ref={eyeR} className="sm-eye" d={pair[1]} />
                </g>
                {/* The brand's star eyes and the spiral eyes: drawings of their own, shown in place of the pair. */}
                <g ref={stars} className="sm-stars">
                  {STAR_EYES.map((star, i) => (
                    <g key={i} className="sm-star-eye" style={{ transformOrigin: `${star.center.x}px ${star.center.y}px` }}>
                      <path className="sm-star" d={star.d} />
                    </g>
                  ))}
                </g>
                <g ref={spirals} className="sm-spirals">
                  {EYE_CENTERS.map((c, i) => (
                    <path key={i} className="sm-spiral" style={{ transformOrigin: `${c.x}px ${c.y}px` }} d={spiralPath(c.x, c.y)} />
                  ))}
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>
      {fx && (
        <g ref={fxGroup} className="sm-fx" aria-hidden="true">
          {Array.from({ length: SPARKS }, (_, i) => (
            <path key={`s${i}`} className="sm-spark" d={STAR_PATH} opacity={0} />
          ))}
          {Array.from({ length: ZS }, (_, i) => (
            <path key={`z${i}`} className="sm-z" d={Z_PATH} opacity={0} />
          ))}
          {Array.from({ length: ORBIT }, (_, i) => (
            <path key={`o${i}`} className="sm-orbit" d={STAR_PATH} opacity={0} />
          ))}
        </g>
      )}
    </svg>
  );
});

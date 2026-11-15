// Mascot jump, as one Web Animations timeline on the outermost layer (m-root),
// with a matching timeline for the contact shadow. Pure keyframe builders plus
// a small runner, so the motion can be unit tested.
//
// One jump: anticipation (squash) -> take-off (stretch) -> rise (ease-out) ->
// fall (ease-in) -> landing (squash). After the last jump: a small rebound and
// a settle, so it never stops abruptly. Units are SVG user units.

export interface JumpTimeline {
  keyframes: Keyframe[];
  shadow: Keyframe[];
  duration: number;
}

const EASE_OUT = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
const EASE_IN = 'cubic-bezier(0.55, 0.06, 0.68, 0.19)';
const EASE_IN_OUT = 'cubic-bezier(0.45, 0, 0.55, 1)';

interface Pose {
  /** Vertical offset (negative is up). */
  y: number;
  sx: number;
  sy: number;
  /** Shadow scale and opacity at this pose. */
  shadow: number;
  ms: number;
  /** Easing from this pose to the next one. */
  easing: string;
}

const transformOf = (p: Pick<Pose, 'y' | 'sx' | 'sy'>) => `translateY(${p.y.toFixed(1)}px) scale(${p.sx}, ${p.sy})`;

/** Shadow follows height: smaller and fainter the higher the mascot is. */
const shadowFor = (y: number, maxHeight: number) => 1 - 0.45 * Math.min(1, Math.abs(y) / maxHeight);

function posesFor(heights: readonly number[]): Pose[] {
  const max = Math.max(...heights);
  const poses: Pose[] = [{ y: 0, sx: 1, sy: 1, shadow: 1, ms: 0, easing: EASE_OUT }];
  heights.forEach((h, i) => {
    const rise = 190 + h * 1.4;
    // Anticipation only before the first jump; the landing squash of the
    // previous jump serves as the anticipation of the next one.
    if (i === 0) poses.push({ y: 0, sx: 1.08, sy: 0.9, shadow: 1.04, ms: 140, easing: EASE_OUT });
    poses.push({ y: -h * 0.22, sx: 0.93, sy: 1.09, shadow: shadowFor(h * 0.22, max), ms: 80, easing: EASE_OUT });
    poses.push({ y: -h, sx: 1, sy: 1, shadow: shadowFor(h, max), ms: rise, easing: EASE_IN });
    poses.push({ y: 0, sx: 0.96, sy: 1.05, shadow: 1, ms: rise * 0.85, easing: EASE_OUT });
    poses.push({ y: 0, sx: 1.1, sy: 0.88, shadow: 1.06, ms: 80, easing: EASE_OUT });
  });
  const last = heights[heights.length - 1]!;
  poses.push({ y: -last * 0.07, sx: 0.97, sy: 1.035, shadow: shadowFor(last * 0.07, max), ms: 150, easing: EASE_IN_OUT });
  poses.push({ y: 0, sx: 1.012, sy: 0.99, shadow: 1, ms: 140, easing: EASE_IN_OUT });
  poses.push({ y: 0, sx: 1, sy: 1, shadow: 1, ms: 130, easing: 'linear' });
  return poses;
}

/** Builds the jump keyframes. `heights` are the peak heights, e.g. [80, 44] for two jumps. */
export function jumpTimeline(heights: readonly number[]): JumpTimeline {
  if (heights.length === 0) throw new Error('jumpTimeline: at least one height');
  const poses = posesFor(heights);
  const duration = poses.reduce((sum, p) => sum + p.ms, 0);
  let at = 0;
  const keyframes: Keyframe[] = [];
  const shadow: Keyframe[] = [];
  for (const p of poses) {
    at += p.ms;
    const offset = Math.min(1, at / duration);
    keyframes.push({ offset, transform: transformOf(p), easing: p.easing });
    shadow.push({ offset, transform: `scale(${p.shadow.toFixed(3)})`, opacity: Math.min(1, p.shadow).toFixed(3), easing: p.easing });
  }
  return { keyframes, shadow, duration };
}

/**
 * Plays a jump. Starts from the element's current transform, so a jump that
 * interrupts another motion never snaps back to the rest pose first.
 */
export function playJump(root: SVGGElement, shadow: SVGElement | null, heights: readonly number[]): Animation[] {
  const { keyframes, shadow: shadowFrames, duration } = jumpTimeline(heights);
  const from = getComputedStyle(root).transform;
  root.getAnimations().forEach((a) => a.cancel());
  const [rest, ...moves] = keyframes;
  const played = [root.animate([{ ...rest, transform: from === 'none' ? rest!.transform : from }, ...moves], { duration })];
  if (shadow) {
    shadow.getAnimations().forEach((a) => a.cancel());
    played.push(shadow.animate(shadowFrames, { duration }));
  }
  return played;
}

/** A short squash and stretch for state changes, from the current transform. */
export function playSquash(root: SVGGElement): Animation {
  const from = getComputedStyle(root).transform;
  root.getAnimations().forEach((a) => a.cancel());
  return root.animate(
    [
      { transform: from === 'none' ? 'scale(1, 1)' : from },
      { transform: 'scale(1.06, 0.93)', offset: 0.35, easing: EASE_OUT },
      { transform: 'scale(0.98, 1.03)', offset: 0.7, easing: EASE_IN_OUT },
      { transform: 'scale(1, 1)' },
    ],
    { duration: 320, easing: 'linear' },
  );
}

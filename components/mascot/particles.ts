// Particle effects with the Web Animations API. A fixed pool of SVG elements
// is reused, and only transform and opacity animate, so the browser can keep
// the work on the compositor. Nothing runs unless a state asks for it.

import { FLAME_TIPS, MASCOT_CENTER } from './geometry';

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function play(el: SVGElement, keyframes: Keyframe[], duration: number, delay = 0): Animation {
  return el.animate(keyframes, { duration, delay, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' });
}

/** Star burst for celebrate: every star flies out once from the flame. */
export function burstStars(stars: readonly SVGElement[]): Animation[] {
  return stars.map((star, i) => {
    const angle = (i / stars.length) * Math.PI * 2 + rand(-0.25, 0.25);
    const distance = rand(170, 250);
    const x = MASCOT_CENTER.x + Math.cos(angle) * distance;
    const y = MASCOT_CENTER.y - 40 + Math.sin(angle) * distance * 0.85;
    const size = rand(12, 22);
    return play(
      star,
      [
        { transform: `translate(${MASCOT_CENTER.x}px, ${MASCOT_CENTER.y - 40}px) scale(0) rotate(0deg)`, opacity: 0 },
        { transform: `translate(${x}px, ${y}px) scale(${size}) rotate(90deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${x}px, ${y + 30}px) scale(${size * 0.6}) rotate(160deg)`, opacity: 0 },
      ],
      rand(950, 1300),
      i * 45,
    );
  });
}

/** One ember rising from a flame tip (urgent). */
export function riseEmber(ember: SVGElement): Animation {
  const tip = FLAME_TIPS[Math.floor(Math.random() * FLAME_TIPS.length)]!;
  const x = tip.x + rand(-30, 30);
  const drift = rand(-35, 35);
  return play(
    ember,
    [
      { transform: `translate(${x}px, ${tip.y + 40}px) scale(${rand(5, 8)})`, opacity: 0 },
      { opacity: 0.95, offset: 0.2 },
      { transform: `translate(${x + drift}px, ${tip.y - rand(90, 140)}px) scale(2)`, opacity: 0 },
    ],
    rand(1000, 1400),
  );
}

/** One "z" floating up and right from the flame (sleepy). */
export function floatZ(z: SVGElement): Animation {
  const start = { x: 420, y: 170 };
  return play(
    z,
    [
      { transform: `translate(${start.x}px, ${start.y}px) scale(0.6) rotate(-8deg)`, opacity: 0 },
      { opacity: 0.85, offset: 0.25 },
      { transform: `translate(${start.x + 70}px, ${start.y - 130}px) scale(1.3) rotate(6deg)`, opacity: 0 },
    ],
    2200,
  );
}

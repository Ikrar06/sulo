// Ringkasan's mascot, large (104): the existing SVG mascot (one flame group,
// the face inside its clip), its expression from core mascotMood, and a few
// short reactions on top. Transform and opacity only; everything is still
// under prefers-reduced-motion, and the mascot's own timers stop while the
// app is in the background. Not a button for anything else: a tap is only
// a small hop and a blink, at most once every 2 seconds. No sound, no
// vibration.
//   - enters with one small hop (320 ms, styles.css .m-mascot-enter)
//   - dips with a pull to refresh, up to 10 px (.m-mascot-pull)
//   - a change of expression fades through 200 ms
//   - `cheer` (a refresh with new data, a task done) shows happy for a while
//   - `celebrate` (the last pending task done) plays the star eyes once

import { useEffect, useRef, useState } from 'react';
import type { Mood } from '@sulo/core/dashboard/mascot-mood';
import type { MascotState } from '@sulo/core/view/popup-view';
import { Mascot } from '@sulo/ui/mascot/Mascot';

/** One tap reaction per this long. */
const POKE_EVERY_MS = 2000;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function HeroMascot({ mood, cheer, celebrate, label }: { mood: Mood; cheer: number; celebrate: number; label: string }) {
  const [happyUntil, setHappyUntil] = useState(0);
  const [poke, setPoke] = useState(0);
  const lastPoke = useRef(0);
  const face = useRef<HTMLDivElement | null>(null);

  // A cheer: happy for 1.5 s, then back to the state's expression.
  useEffect(() => {
    if (cheer === 0) return;
    setHappyUntil(Date.now() + 1500);
    const t = window.setTimeout(() => setHappyUntil(0), 1500);
    return () => window.clearTimeout(t);
  }, [cheer]);

  // Web build and measuring APK only: the moment Ringkasan is on screen, for scripts/perf-measure.mjs (and logcat).
  useEffect(() => {
    if (!__SULO_WEB_FAKE__) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        performance.mark('sulo:ringkasan');
        console.info(`sulo-perf ringkasan ${Math.round(performance.now())}`);
      }),
    );
  }, []);

  const state: MascotState = happyUntil > 0 ? 'all-done' : mood.state;

  // A change of expression fades through 200 ms instead of jumping.
  const shown = useRef(state);
  useEffect(() => {
    if (shown.current === state) return;
    shown.current = state;
    if (reduced() || !face.current) return;
    face.current.animate([{ opacity: 0.55, transform: 'scale(0.98)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' });
  }, [state]);

  return (
    <div
      className="m-mascot-enter shrink-0"
      // The onboarding mascot lands here (onboarding/OnboardingFlow.tsx) with this expression.
      data-mascot-spot="hero"
      data-mascot-state={state}
      role="img"
      aria-label={label}
      onClick={() => {
        if (Date.now() - lastPoke.current < POKE_EVERY_MS) return;
        lastPoke.current = Date.now();
        setPoke((n) => n + 1);
      }}
    >
      <div className="m-mascot-pull">
        <div ref={face}>
          <Mascot state={state} boldHappy size={104} alert={mood.alert && happyUntil === 0} poke={poke} celebrate={celebrate} effects={false} />
        </div>
      </div>
    </div>
  );
}

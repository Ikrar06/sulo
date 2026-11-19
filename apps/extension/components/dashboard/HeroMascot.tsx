// Ringkasan's mascot (Tahap 2): the phone's expression for the state of
// things (core mascotMood) and its living motion, at the dashboard's size.
// Transform and opacity only, all still under prefers-reduced-motion; the
// shared Mascot stops its loops while the tab is hidden or it is off screen.
//   - enters with one small hop (320 ms)
//   - a change of expression fades through 200 ms
//   - `cheer` (a task marked done) shows happy for 1.5 s
// Not a button: no click reaction on the desktop, where it would be a
// target keyboards cannot reach.

import { useEffect, useRef, useState } from 'react';
import type { Mood } from '@sulo/core/dashboard/mascot-mood';
import type { MascotState } from '@sulo/core/view/popup-view';
import { Mascot } from '@sulo/ui/mascot/Mascot';

const CHEER_MS = 1500;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function HeroMascot({ mood, cheer, size = 56 }: { mood: Mood; cheer: number; size?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [happy, setHappy] = useState(false);

  useEffect(() => {
    if (reduced() || !box.current?.animate) return;
    box.current.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)', offset: 0.45 }, { transform: 'translateY(0)' }], { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  }, []);

  useEffect(() => {
    if (cheer === 0) return;
    setHappy(true);
    const t = window.setTimeout(() => setHappy(false), CHEER_MS);
    return () => window.clearTimeout(t);
  }, [cheer]);

  const state: MascotState = happy ? 'all-done' : mood.state;
  const shown = useRef(state);
  useEffect(() => {
    if (shown.current === state) return;
    shown.current = state;
    if (reduced() || !box.current?.animate) return;
    box.current.animate([{ opacity: 0.55, transform: 'scale(0.98)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' });
  }, [state]);

  return (
    <div ref={box} className="shrink-0">
      <Mascot state={state} alert={mood.alert} size={size} />
    </div>
  );
}

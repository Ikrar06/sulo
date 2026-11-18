// One journey (M8c.2): when the step changes, the old screen's content
// steps aside and is gone in 110 ms, and only then the new one comes in from
// the other side in 260 ms (the two are never on screen together, so no
// text of the old screen lingers under the new one); Back runs the other way. Only the content moves:
// the top bar and the action block of the new screen are in place at once,
// so the primary button never travels.
//
// The leaving screen stays the very same mounted instance (the same key
// under the same parent): it keeps its state and runs no effect again; only
// its wrapper's class changes. It is inert and marked, so the mascot never
// takes its spot for the live one.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { reducedMotion } from './motion';

const EXIT_MS = 130;

interface Leaving {
  key: string;
  dir: 'fwd' | 'back';
}

export function StepSwap({ stepKey, order, children }: { stepKey: string; /** Larger is later in the flow: decides the direction. */ order: number; children: ReactNode }) {
  // Which screen is current and which is leaving are plain state, derived
  // while rendering (safe when React renders twice or drops a render).
  const [shown, setShown] = useState({ key: stepKey, order });
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const [dir, setDir] = useState<'fwd' | 'back' | 'none'>('none');
  if (shown.key !== stepKey) {
    const d = order >= shown.order ? 'fwd' : 'back';
    setShown({ key: stepKey, order });
    setDir(d);
    setLeaving({ key: shown.key, dir: d });
  }
  // What each screen last showed: the leaving one is drawn from here, frozen.
  const last = useRef(new Map<string, ReactNode>());
  last.current.set(stepKey, children);
  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(
      () => {
        last.current.delete(leaving.key);
        setLeaving(null);
      },
      reducedMotion() ? 0 : EXIT_MS,
    );
    return () => window.clearTimeout(id);
  }, [leaving]);
  // Coming straight back to the screen that is still leaving: it is the live one again.
  const out = leaving && leaving.key !== stepKey && last.current.has(leaving.key) ? leaving : null;
  const screens: { key: string; node: ReactNode; cls: string; leaving: boolean }[] = [
    // Both wrappers have the same geometry (fixed to the viewport) at all times: a screen that starts leaving does not move by a pixel.
    { key: stepKey, node: children, cls: `fixed inset-0 ${dir === 'none' ? 'onb-in' : `onb-in onb-in-${dir}`}`, leaving: false },
    ...(out ? [{ key: out.key, node: last.current.get(out.key), cls: `fixed inset-0 z-10 pointer-events-none onb-out onb-out-${out.dir}`, leaving: true }] : []),
  ];
  return (
    <>
      {/* Keyed by step under one parent: a screen that starts leaving is the same instance, not a new mount. */}
      {screens.map((s) => (
        <div key={s.key} data-onb-leaving={s.leaving ? '' : undefined} inert={s.leaving ? true : undefined} aria-hidden={s.leaving ? true : undefined} className={s.cls}>
          {s.node}
        </div>
      ))}
    </>
  );
}

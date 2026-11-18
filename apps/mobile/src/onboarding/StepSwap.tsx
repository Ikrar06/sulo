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

import { useRef, useState, type ReactNode } from 'react';
import { reducedMotion } from './motion';

const EXIT_MS = 130;

interface Leaving {
  key: string;
  node: ReactNode;
  dir: 'fwd' | 'back';
}

export function StepSwap({ stepKey, order, children }: { stepKey: string; /** Larger is later in the flow: decides the direction. */ order: number; children: ReactNode }) {
  const current = useRef({ key: stepKey, order, node: children });
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const [dir, setDir] = useState<'fwd' | 'back' | 'none'>('none');
  const timer = useRef(0);
  if (current.current.key !== stepKey) {
    const d = order >= current.current.order ? 'fwd' : 'back';
    const old = current.current;
    current.current = { key: stepKey, order, node: children };
    setDir(d);
    // What the old screen last showed, frozen while it leaves.
    setLeaving({ key: old.key, node: old.node, dir: d });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLeaving(null), reducedMotion() ? 0 : EXIT_MS);
  } else {
    current.current.node = children;
  }
  // Coming straight back to the screen that is still leaving: it is the live one again.
  const out = leaving && leaving.key !== stepKey ? leaving : null;
  const screens: { key: string; node: ReactNode; cls: string; leaving: boolean }[] = [
    // Both wrappers have the same geometry (fixed to the viewport) at all times: a screen that starts leaving does not move by a pixel.
    { key: stepKey, node: children, cls: `fixed inset-0 ${dir === 'none' ? 'onb-in' : `onb-in onb-in-${dir}`}`, leaving: false },
    ...(out ? [{ key: out.key, node: out.node, cls: `fixed inset-0 z-10 pointer-events-none onb-out onb-out-${out.dir}`, leaving: true }] : []),
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

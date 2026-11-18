// One journey (M8c.2): when the step changes, the old screen's content
// slides 24 px away and fades in 160 ms while the new one comes in from the
// other side in 240 ms; Back runs the other way. Only the content moves:
// the top bar and the action block of the new screen are in place at once,
// so the primary button never travels. The leaving screen is inert and is
// marked so the mascot never mistakes its spot for the live one.

import { useRef, useState, type ReactNode } from 'react';
import { reducedMotion } from './motion';

const EXIT_MS = 180;

export function StepSwap({ stepKey, order, children }: { stepKey: string; /** Larger is later in the flow: decides the direction. */ order: number; children: ReactNode }) {
  const current = useRef({ key: stepKey, order, node: children });
  const [leaving, setLeaving] = useState<{ key: string; node: ReactNode; dir: 'fwd' | 'back' } | null>(null);
  const [dir, setDir] = useState<'fwd' | 'back' | 'none'>('none');
  const timer = useRef(0);
  if (current.current.key !== stepKey) {
    const d = order >= current.current.order ? 'fwd' : 'back';
    const old = current.current;
    current.current = { key: stepKey, order, node: children };
    setDir(d);
    setLeaving({ key: old.key, node: old.node, dir: d });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLeaving(null), reducedMotion() ? 0 : EXIT_MS);
  } else {
    current.current.node = children;
  }
  return (
    <>
      <div key={stepKey} className={dir === 'none' ? 'onb-in' : `onb-in onb-in-${dir}`}>
        {children}
      </div>
      {leaving && (
        <div key={`out-${leaving.key}`} data-onb-leaving="" inert aria-hidden="true" className={`onb-out onb-out-${leaving.dir} pointer-events-none fixed inset-0 z-10`}>
          {leaving.node}
        </div>
      )}
    </>
  );
}

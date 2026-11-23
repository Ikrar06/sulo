// Ringkasan's mascot: the expression for the state of things (core
// mascotMood) at the dashboard's size, its eyes following the pointer, and
// short reactions read from what the page already knows. Under reduced
// motion the body stays still; it stops while the tab is hidden or it is
// off screen.
//   - enters with one small hop (320 ms)
//   - a task marked done (`ticked` grows): a glad hop, with stars only for
//     the first of a run; the last pending one: the full celebration
//   - a sync that ends: a nod (done), perking up (a task came in), a shiver
//     (a deadline is now within a day), or a shake of the head (it failed)
// Not a button: no click reaction on the desktop, where it would be a
// target keyboards cannot reach.

import { useCallback, useEffect, useRef, useState } from 'react';
import { moodFor, type Mood } from '@sulo/core/dashboard/mascot-mood';
import type { ReactionName } from '@sulo/ui/mascot/motion';
import { SuloMascot } from '@sulo/ui/mascot/SuloMascot';

/** The data a sync brought may land a moment after it ends: the reaction is picked once it has. */
const SETTLE_MS = 450;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function HeroMascot({ mood, ticked, pending, syncing, failed, size = 56 }: { mood: Mood; /** Tasks marked done and still in their undo window. */ ticked: number; /** Tasks still pending. */ pending: number; syncing: boolean; /** The last sync did not get through (no connection, a page SIKOLA changed). */ failed: boolean; size?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [reaction, setReaction] = useState<{ name: ReactionName; key: number } | null>(null);
  const play = useCallback((name: ReactionName) => setReaction((r) => ({ name, key: (r?.key ?? 0) + 1 })), []);

  useEffect(() => {
    if (reduced() || !box.current?.animate) return;
    box.current.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)', offset: 0.45 }, { transform: 'translateY(0)' }], { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  }, []);

  const latest = useRef({ pending, alert: mood.alert, failed });
  latest.current = { pending, alert: mood.alert, failed };

  const seen = useRef(ticked);
  useEffect(() => {
    const more = ticked > seen.current;
    seen.current = ticked;
    if (more) play(latest.current.pending === 0 ? 'allClear' : 'checked');
  }, [ticked, play]);

  const atStart = useRef({ pending, alert: mood.alert });
  const was = useRef(syncing);
  useEffect(() => {
    const before = was.current;
    was.current = syncing;
    if (syncing) {
      atStart.current = { pending: latest.current.pending, alert: latest.current.alert };
      return;
    }
    if (!before) return;
    const t = window.setTimeout(() => {
      const start = atStart.current;
      const now = latest.current;
      play(now.failed ? 'fail' : now.alert && !start.alert ? 'near' : now.pending > start.pending ? 'incoming' : 'done');
    }, SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [syncing, play]);

  return (
    <div ref={box} className="shrink-0">
      <SuloMascot mood={moodFor(mood.state, mood.alert)} size={size} followCursor effects reaction={reaction} />
    </div>
  );
}

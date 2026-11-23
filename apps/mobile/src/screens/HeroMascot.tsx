// Ringkasan's mascot, large (104): its expression from core mascotMood, and
// short reactions on top, each read from what the screen already knows.
// Under reduced motion and on the lite tier the body stays still (a blink,
// and a change of the eyes behind a blink); everything stops while the app
// is in the background. Not a button for anything else: a tap is only a
// small hop and a blink, at most once every 2 seconds. No sound, no vibration.
//   - enters with one small hop (320 ms, styles.css .m-mascot-enter)
//   - dips with a pull to refresh, up to 10 px (.m-mascot-pull)
//   - a task ticked (`cheer`): a glad hop, with stars only for the first of a run
//   - the last pending task ticked (`celebrate`): the full celebration, once
//   - a sync that ends: a nod (done), perking up (a task came in), a shiver
//     (a deadline is now within a day), or a shake of the head (it failed)

import { useCallback, useEffect, useRef, useState } from 'react';
import { moodFor, type Mood } from '@sulo/core/dashboard/mascot-mood';
import type { ReactionName } from '@sulo/ui/mascot/motion';
import { SuloMascot } from '@sulo/ui/mascot/SuloMascot';
import type { SyncPhase } from '../shell/sync-status';

/** One tap reaction per this long. */
const POKE_EVERY_MS = 2000;
/** The data a sync brought may land a moment after its status says done: the reaction is picked once it has. */
const SETTLE_MS = 450;

export function HeroMascot({ mood, cheer, celebrate, label, sync, pending }: { mood: Mood; cheer: number; celebrate: number; label: string; /** The sync's phase (shell/sync-status.ts). */ sync: SyncPhase; /** Pending tasks now. */ pending: number }) {
  const [reaction, setReaction] = useState<{ name: ReactionName; key: number } | null>(null);
  const play = useCallback((name: ReactionName) => setReaction((r) => ({ name, key: (r?.key ?? 0) + 1 })), []);
  const lastPoke = useRef(0);

  const cheered = useRef(cheer);
  useEffect(() => {
    if (cheer === cheered.current) return;
    cheered.current = cheer;
    play('checked');
  }, [cheer, play]);

  const partied = useRef(celebrate);
  useEffect(() => {
    if (celebrate === partied.current) return;
    partied.current = celebrate;
    play('allClear');
  }, [celebrate, play]);

  // A sync: what was there when it started against what is there once it has ended.
  const latest = useRef({ pending, alert: mood.alert });
  latest.current = { pending, alert: mood.alert };
  const atStart = useRef({ pending, alert: mood.alert });
  const phase = useRef(sync);
  useEffect(() => {
    const was = phase.current;
    phase.current = sync;
    if (sync === 'running') {
      atStart.current = latest.current;
      return;
    }
    if (was !== 'running') return;
    if (sync === 'failed') {
      play('fail');
      return;
    }
    if (sync !== 'done') return;
    const t = window.setTimeout(() => {
      const before = atStart.current;
      const after = latest.current;
      play(after.alert && !before.alert ? 'near' : after.pending > before.pending ? 'incoming' : 'done');
    }, SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [sync, play]);

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

  return (
    <div
      className="m-mascot-enter shrink-0"
      // The onboarding mascot lands here (onboarding/OnboardingFlow.tsx).
      data-mascot-spot="hero"
      data-mascot-state={mood.state}
      role="img"
      aria-label={label}
      onClick={() => {
        if (Date.now() - lastPoke.current < POKE_EVERY_MS) return;
        lastPoke.current = Date.now();
        play('tap');
      }}
    >
      <div className="m-mascot-pull">
        <SuloMascot mood={moodFor(mood.state, mood.alert)} size={104} reaction={reaction} />
      </div>
    </div>
  );
}

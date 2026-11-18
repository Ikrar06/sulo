// Debug build only (DevScreen): the pace of the onboarding's story motion
// and a replay of the onboarding. scripts/check-no-dev-code.mjs fails a
// release build that still carries this file. The tempo is kept on the
// phone (debug builds read it at start); a release always uses the default.

import { useEffect, useState } from 'react';
import type { Platform } from '@sulo/core/platform';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { REPLAY_ONBOARDING_EVENT } from '../events';
import { SCENE_TEMPO_DEFAULT, SCENE_TEMPO_KEY, sceneTempo, setSceneTempo } from '../onboarding/motion';

export function OnboardingDev({ platform }: { platform: Platform }) {
  const [tempo, setTempo] = useState(sceneTempo());
  useEffect(() => {
    void platform.store.get<number>(SCENE_TEMPO_KEY).then((v) => typeof v === 'number' && setTempo(v));
  }, [platform]);
  const change = (v: number) => {
    const next = Math.round(v * 10) / 10;
    setTempo(next);
    setSceneTempo(next);
    void platform.store.set(SCENE_TEMPO_KEY, next);
  };
  return (
    <Card className="space-y-3">
      <h2 className="text-m15 font-semibold">Onboarding</h2>
      <label className="block">
        <span className="flex items-center justify-between">
          <span>Tempo adegan</span>
          <span className="tabular-nums">
            {tempo.toFixed(1)} (bawaan {SCENE_TEMPO_DEFAULT.toFixed(1)})
          </span>
        </span>
        <input type="range" min={0.8} max={2} step={0.1} value={tempo} onChange={(e) => change(Number(e.target.value))} className="mt-2 w-full accent-[var(--text)]" />
      </label>
      <p className="text-m12 text-muted-foreground">Hanya gerak cerita adegan (layar 0, 1, 2, 3, 5, 9). Tombol, geser, dan pindah langkah tidak ikut berubah.</p>
      <PillButton small kind="primary" onPress={() => window.dispatchEvent(new Event(REPLAY_ONBOARDING_EVENT))}>
        Putar ulang onboarding
      </PillButton>
    </Card>
  );
}

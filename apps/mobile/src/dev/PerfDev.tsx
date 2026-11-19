// Debug build only (DevScreen): the performance tier detected at start, why,
// what the phone reported, and buttons to force full or lite for testing.
// scripts/check-no-dev-code.mjs fails a release build that carries this.

import { useState } from 'react';
import type { Platform } from '@sulo/core/platform';
import type { TierReason } from '@sulo/core/perf/tier';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { perfState, setPerfOverride, usePerfTier } from '../perf';

const REASONS: Record<TierReason, string> = {
  low_ram_device: 'Android menandai perangkat RAM rendah',
  ram: 'RAM 3 GB atau kurang',
  cores: 'inti CPU 4 atau kurang',
};

export function PerfDev({ platform }: { platform: Platform }) {
  const tier = usePerfTier();
  const [, redraw] = useState(0);
  const s = perfState();
  const force = async (t: 'full' | 'lite' | null) => {
    await setPerfOverride(platform.store, t);
    redraw((n) => n + 1);
  };
  const row = (k: string, v: string) => (
    <p className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right tabular-nums">{v}</span>
    </p>
  );
  return (
    <Card className="space-y-3">
      <h2 className="text-m15 font-semibold">Performa</h2>
      <div className="space-y-1 text-m13">
        {row('Tier berlaku', tier)}
        {row('Terdeteksi', `${s.detected}${s.reasons.length ? ` (${s.reasons.map((r) => REASONS[r]).join(', ')})` : ''}`)}
        {row('Pilihan Animasi', s.pref)}
        {row('Paksa tier', s.override ?? 'tidak')}
        {row('isLowRamDevice', String(s.device.lowRamDevice ?? '?'))}
        {row('RAM total', s.device.totalRamMb === null ? '?' : `${s.device.totalRamMb} MB`)}
        {row('Inti CPU', String(s.device.cpuCores ?? '?'))}
        {row('WebView', s.device.webView ?? '?')}
      </div>
      <div className="flex flex-wrap gap-2">
        <PillButton small kind={s.override === 'full' ? 'primary' : 'secondary'} onPress={() => void force('full')}>
          Paksa full
        </PillButton>
        <PillButton small kind={s.override === 'lite' ? 'primary' : 'secondary'} onPress={() => void force('lite')}>
          Paksa lite
        </PillButton>
        <PillButton small kind="secondary" onPress={() => void force(null)}>
          Ikuti pilihan
        </PillButton>
      </div>
      <p className="text-m12 text-muted-foreground">Data perangkat hanya di memori selama aplikasi terbuka; tidak disimpan dan tidak dikirim.</p>
    </Card>
  );
}

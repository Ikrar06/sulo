// Debug build only: load a test config from Sulo's data repository, or write a made-up release for the
// update screens (dev/test-config.ts).
import { useEffect, useState } from 'react';
import type { Platform } from '@sulo/core/platform';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { Input } from '@sulo/ui/ui/input';
import { refreshPublicData } from '../public-data';
import { applyWatchPlan } from '../watch-native';
import { applyFakeRelease, applyTestConfig, clearTestConfig, FAKE_RELEASE_URL, readTestConfig, TEST_CONFIG_PREFIX } from './test-config';

const REASONS = {
  prefix: `URL ditolak: harus diawali ${TEST_CONFIG_PREFIX}`,
  fetch: 'Gagal mengambil berkas; config resmi tetap dipakai.',
  json: 'Berkas bukan JSON; config resmi tetap dipakai.',
  schema: 'Isi tidak lolos validasi config (Zod); config resmi tetap dipakai.',
} as const;

export function TestConfig({ platform }: { platform: Platform }) {
  const [url, setUrl] = useState(`${TEST_CONFIG_PREFIX}mobile-keepalive/config.json`);
  const [active, setActive] = useState<string | null>(null);
  const [line, setLine] = useState('');
  useEffect(() => void readTestConfig(platform).then((t) => setActive(t?.url ?? null)), [platform]);

  const apply = async () => {
    const r = await applyTestConfig(platform, url.trim());
    if (!r.ok) return setLine(REASONS[r.reason]);
    setActive(url.trim());
    await applyWatchPlan(platform);
    setLine('Config uji dipakai; paket rencana pemantauan ditulis ulang.');
  };
  const fake = async (kind: 'available' | 'required') => {
    await applyFakeRelease(platform, kind);
    setActive(FAKE_RELEASE_URL(kind));
    setLine('Rilis palsu 9.1.0 ditulis. Tutup Sulo lalu buka lagi untuk melihat layarnya.');
  };
  const reset = async () => {
    await clearTestConfig(platform);
    setActive(null);
    await refreshPublicData(platform, true);
    await applyWatchPlan(platform);
    setLine('Kembali ke config resmi.');
  };

  return (
    <Card className="space-y-3">
      <h2 className="text-m15 font-semibold">Config uji</h2>
      {active && <p className="rounded-full bg-m-inset px-3 py-1 text-m12 font-semibold">Config uji aktif: {active}</p>}
      <Input aria-label="URL config uji" value={url} onChange={(e) => setUrl(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <PillButton small kind="primary" onPress={() => void apply()}>
          Muat config uji
        </PillButton>
        <PillButton small onPress={() => void fake('available')}>
          Rilis palsu: tersedia
        </PillButton>
        <PillButton small onPress={() => void fake('required')}>
          Rilis palsu: wajib
        </PillButton>
        {active && (
          <PillButton small onPress={() => void reset()}>
            Kembali ke config resmi
          </PillButton>
        )}
      </div>
      {line && (
        <p role="status" className="text-m13">
          {line}
        </p>
      )}
    </Card>
  );
}

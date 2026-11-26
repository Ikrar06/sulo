// iPhone only, Fase 1 (docs/ios/PENILAIAN-IOS.md): the checks the owner runs
// after installing the .ipa with Sideloadly. "Tulis uji" puts one synthetic
// value in the Keychain and one in the app's own store, and schedules three
// test notifications (in 2 minutes, 09.00 on day 8 and day 9). Installing the
// same .ipa again must keep both values; the day 8 and 9 notifications tell
// whether reminders still show once the 7-day profile has expired. No network.
import { useEffect, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';

interface ProbeStatus {
  keychainWrittenAt: number | null;
  storeWrittenAt: number | null;
  firstLaunchAt: number | null;
  launches: number;
  keychainLeftAtFirstLaunch: boolean;
  profileExpiresAt: number | null;
  backgroundRefresh: string;
  backgroundRuns: { kind: string; at: number }[];
  backgroundTotal: number;
  backgroundSubmitError: number | null;
  pending: { id: string; at: number | null }[];
  /** The app's refresh notice (refresh|), when one is scheduled. */
  refreshNoticeAt: number | null;
}

interface SuloProbePlugin {
  status(): Promise<ProbeStatus>;
  write(): Promise<{ notifications: boolean }>;
  clear(): Promise<void>;
}

const SuloProbe = registerPlugin<SuloProbePlugin>('SuloProbe');

const time = (at: number | null) => (at === null ? '-' : new Date(at * 1000).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }));
const yes = (at: number | null) => (at === null ? 'tidak ada' : `ada, ditulis ${time(at)}`);

export function IosProbeDev() {
  const [s, setS] = useState<ProbeStatus | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = () => void SuloProbe.status().then(setS).catch(() => setNote('Uji iPhone tidak terbaca.'));
  useEffect(load, []);
  const row = 'py-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line';
  return (
    <Card>
      <h2 className="text-m15 font-semibold">Uji iPhone (Fase 1)</h2>
      {s && (
        <ul className="mt-2">
          <li className={row}>Keychain: {yes(s.keychainWrittenAt)}</li>
          <li className={row}>Penyimpanan Sulo: {yes(s.storeWrittenAt)}</li>
          <li className={row}>
            Pertama dibuka: {time(s.firstLaunchAt)}, dibuka {s.launches} kali
            {s.keychainLeftAtFirstLaunch ? '. Keychain tersisa dari pemasangan sebelumnya.' : ''}
          </li>
          <li className={row}>Profil berlaku sampai: {s.profileExpiresAt === null ? 'tidak terbaca (simulator?)' : time(s.profileExpiresAt)}</li>
          <li className={row}>Pengingat segarkan: {s.refreshNoticeAt === null || s.refreshNoticeAt === undefined ? 'tidak dijadwalkan' : time(s.refreshNoticeAt)}</li>
          <li className={row}>
            Notifikasi uji menunggu: {s.pending.length === 0 ? 'tidak ada' : s.pending.map((p) => `${p.id} ${time(p.at)}`).join(', ')}
          </li>
          <li className={row}>
            Tugas latar: {s.backgroundRefresh}, jalan {s.backgroundTotal} kali
            {s.backgroundRuns[0] ? `, terakhir ${s.backgroundRuns[0].kind} ${time(s.backgroundRuns[0].at)}` : ''}
            {s.backgroundSubmitError !== null ? `, galat jadwal ${s.backgroundSubmitError}` : ''}
          </li>
        </ul>
      )}
      {note && (
        <p role="status" className="mt-2">
          {note}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <PillButton
          small
          kind="primary"
          onPress={async () => {
            const r = await SuloProbe.write().catch(() => null);
            setNote(r === null ? 'Gagal menulis uji.' : r.notifications ? 'Uji ditulis, tiga notifikasi dijadwalkan.' : 'Uji ditulis. Notifikasi tidak diizinkan.');
            load();
          }}
        >
          Tulis uji
        </PillButton>
        <PillButton small onPress={load}>
          Muat ulang
        </PillButton>
        <PillButton
          small
          onPress={async () => {
            await SuloProbe.clear().catch(() => undefined);
            setNote('Uji dihapus.');
            load();
          }}
        >
          Hapus uji
        </PillButton>
      </div>
    </Card>
  );
}

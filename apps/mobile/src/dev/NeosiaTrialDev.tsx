// Debug build only (M8d B0): the NEOSIA trial. Each button opens one NEOSIA
// page in its own screen from this tap; the counters show what arrived
// (endpoint ids and sizes only), what was refused, and, for comparing with
// Chrome, NEOSIA's requests as they passed (host and path only).
import { useEffect, useState } from 'react';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { SuloNeosia, type NeosiaPage, type NeosiaTrialStats } from '../neosia-native';

const PAGES: [NeosiaPage, string][] = [
  ['login', 'Masuk NEOSIA (tanpa skrip)'],
  ['home', 'Beranda'],
  ['khs', 'Kartu Hasil Studi'],
  ['krs', 'KRS'],
];

const list = (r: Record<string, number>) => Object.entries(r).map(([k, n]) => `${k}: ${n}`);

export function NeosiaTrialDev() {
  const [stats, setStats] = useState<NeosiaTrialStats | null>(null);
  const [error, setError] = useState('');
  const load = () =>
    SuloNeosia.trialStats()
      .then((s) => {
        setStats(s);
        setError('');
      })
      .catch(() => setError('Tidak tersedia di build ini.'));
  useEffect(() => {
    void load();
    // Fresh numbers when the NEOSIA screen closes and the app is back.
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  const total = (r: Record<string, number> | undefined) => Object.values(r ?? {}).reduce((a, b) => a + b, 0);
  const apiRequests = Object.entries(stats?.requests ?? {}).filter(([k]) => k.includes('api.neosia'));
  return (
    <Card className="space-y-3">
      <h2 className="text-m15 font-semibold">Uji NEOSIA (B0)</h2>
      <p className="text-muted-foreground">
        WebView: {stats?.webView ?? '-'} · skrip awal dokumen: {stats ? (stats.docStartSupported ? 'ada' : 'TIDAK ada') : '-'} · WebMessageListener: {stats ? (stats.listenerSupported ? 'ada' : 'TIDAK ada') : '-'}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PAGES.map(([page, label]) => (
          <PillButton key={page} onPress={() => void SuloNeosia.open({ page, close: 'Tutup' })}>
            {label}
          </PillButton>
        ))}
      </div>
      {error && <p>{error}</p>}
      {stats && (
        <div className="space-y-2">
          <p>
            Tangkapan diterima: {total(stats.captures)} · ditolak: {total(stats.rejected)} · terbesar: {stats.largestBytes} byte
          </p>
          <p>
            Skrip di halaman login: {stats.scriptOnLogin} (harus 0) · pindah ke login tanpa muat ulang: {stats.spaToLogin} · keluar dari login tanpa muat ulang: {stats.spaFromLogin}
          </p>
          <ul>{list(stats.captures).map((l) => <li key={l}>{l}</li>)}</ul>
          {total(stats.rejected) > 0 && <ul>{list(stats.rejected).map((l) => <li key={l}>ditolak {l}</li>)}</ul>}
          <p>Request ke api.neosia: {apiRequests.reduce((a, [, n]) => a + n, 0)} (bandingkan dengan Chrome)</p>
          <ul>{apiRequests.map(([k, n]) => <li key={k}>{k}: {n}</li>)}</ul>
          <p className="text-muted-foreground">Halaman: {stats.pages.join(' → ') || '-'}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <PillButton onPress={() => void load()}>Muat ulang angka</PillButton>
        <PillButton onPress={() => void SuloNeosia.resetTrial().then(load)}>Atur ulang</PillButton>
      </div>
    </Card>
  );
}

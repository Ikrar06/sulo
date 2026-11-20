// Debug build only (M8d B0): the NEOSIA trial. Each button opens one NEOSIA
// page in its own screen from this tap; the counters show what arrived
// (endpoint ids and sizes only), what was refused, and, for comparing with
// Chrome, NEOSIA's requests as they passed (host and path only).
import { useEffect, useState } from 'react';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { nextStep, sourcesDone, type ChecklistStep } from '@sulo/core/neosia/checklist';
import { SuloNeosia, type NeosiaPage, type NeosiaTrialStats } from '../neosia-native';
import { requestDiff, type RequestDiff } from './request-diff';

const PAGES: [NeosiaPage, string, ChecklistStep][] = [
  ['login', 'Masuk NEOSIA (tanpa skrip)', 'login'],
  ['home', 'Beranda', 'beranda'],
  ['khs', 'Kartu Hasil Studi', 'khs'],
  ['krs', 'KRS', 'krs'],
];

const list = (r: Record<string, number>) => Object.entries(r).map(([k, n]) => `${k}: ${n}`);

export function NeosiaTrialDev() {
  const [stats, setStats] = useState<NeosiaTrialStats | null>(null);
  const [error, setError] = useState('');
  // The checklist's next step (core neosia/checklist.ts): sign in, then Beranda, KHS, KRS as each is captured.
  const [lastResult, setLastResult] = useState<'signed_in' | 'needs_login' | 'closed' | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [last, setLast] = useState('');
  const [diff, setDiff] = useState<RequestDiff[] | null>(null);
  const [comparing, setComparing] = useState(false);
  const captured = Object.keys(stats?.captures ?? {}).map((label) => label.replace(/ \(.*\)$/, ''));
  const next: ChecklistStep = nextStep({ signedIn: signedIn || captured.length > 0, lastResult, done: sourcesDone(captured) });
  const open = (page: NeosiaPage) =>
    void SuloNeosia.open({ page, close: 'Tutup' }).then(({ result }) => {
      setLast(result === 'signed_in' ? 'Sudah masuk NEOSIA.' : result === 'needs_login' ? 'NEOSIA meminta masuk; layar menutup sendiri. Masuk dulu.' : 'Ditutup.');
      setLastResult(result);
      if (result === 'signed_in') setSignedIn(true);
      void load();
    });
  // Beranda once without the script and once with it, each closing itself; the counters reset in between.
  const compare = async () => {
    setComparing(true);
    setDiff(null);
    try {
      // A first load fills the WebView's cache; without it the first measured load fetches NEOSIA's bundles
      // and the second does not (seen on the emulator, 20 Nov 2026: a false difference of two .js files).
      await SuloNeosia.open({ page: 'home', close: 'Tutup', script: false, autoCloseMs: 8000 });
      await SuloNeosia.resetTrial();
      await SuloNeosia.open({ page: 'home', close: 'Tutup', script: false, autoCloseMs: 8000 });
      const without = (await SuloNeosia.trialStats()).requests;
      await SuloNeosia.resetTrial();
      await SuloNeosia.open({ page: 'home', close: 'Tutup', script: true, autoCloseMs: 8000 });
      const withScript = (await SuloNeosia.trialStats()).requests;
      setDiff(requestDiff(without, withScript));
      void load();
    } finally {
      setComparing(false);
    }
  };
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
        {PAGES.map(([page, label, step]) => (
          <PillButton key={page} kind={step === next ? "primary" : "secondary"} onPress={() => open(page)}>
            {step === next ? `Berikutnya: ${label}` : label}
          </PillButton>
        ))}
      </div>
      {last && <p role="status">{last}</p>}
      <p>{next === 'done' ? 'Semua langkah selesai.' : `Langkah berikutnya: ${PAGES.find(([, , step]) => step === next)?.[1] ?? next}.`}</p>
      <PillButton onPress={() => void compare()} disabled={comparing}>
        {comparing ? 'Membandingkan…' : 'Bandingkan request (Beranda tanpa dan dengan skrip)'}
      </PillButton>
      {diff && (
        <p role="status">
          {diff.length === 0 ? 'Selisih request: kosong (skrip tidak menambah request).' : `Selisih request (${diff.length}): ${diff.map((d) => `${d.key} tanpa ${d.without}, dengan ${d.with}`).join('; ')}`}
        </p>
      )}
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

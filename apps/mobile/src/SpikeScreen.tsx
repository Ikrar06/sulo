// M8b spike test screen: Masuk, status, Uji, Keluar. Shows codes only.
import { useEffect, useState } from 'react';
import { SuloSession, type ProbeAttempt, type ProbeResult, type SessionStatus } from './session';

const LABEL: Record<SessionStatus, string> = { none: 'Belum masuk', connected: 'Terhubung', expired: 'Sesi habis' };

function Attempt({ title, a }: { title: string; a: ProbeAttempt }) {
  const rows: [string, unknown][] = [
    ['GET /my/', a.myHttpStatus],
    ['Dialihkan ke login', a.myRedirectedToLogin],
    ['Sesskey ditemukan', a.sesskeyFound],
    ['POST service.php', a.postHttpStatus],
    ['Diterima', a.accepted],
    ['Kode galat', a.errorcode],
    ['Sisa sesi (detik)', a.timeRemaining],
    ['Kegagalan', a.failure],
  ];
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-[14px] font-semibold">{title}</h2>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[14px] tabular-nums">
        {rows
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{String(v)}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

export function SpikeScreen() {
  const [status, setStatus] = useState<SessionStatus>('none');
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => void SuloSession.status().then((r) => setStatus(r.status)), []);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setBusy(false);
    }
  };
  const button = 'h-11 rounded-lg px-4 text-[16px] font-medium disabled:opacity-50';

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <header>
        <h1 className="text-[20px] leading-7 font-semibold">Sulo, uji sesi SIKOLA</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">Build uji M8b. Tidak resmi dan tidak berafiliasi dengan Universitas Hasanuddin.</p>
      </header>
      <p className="text-[16px]">
        Status: <span className="font-semibold">{LABEL[status]}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className={`${button} bg-primary text-primary-foreground`} onClick={() => run(async () => { const r = await SuloSession.login(); setNote(r.status === 'cancelled' ? 'Dibatalkan.' : ''); setStatus((await SuloSession.status()).status); })}>
          Masuk
        </button>
        <button type="button" disabled={busy || status === 'none'} className={`${button} border border-border bg-surface`} onClick={() => run(async () => { const r = await SuloSession.probe(); setProbe(r); setStatus(r.status); })}>
          Uji sesi
        </button>
        <button type="button" disabled={busy} className={`${button} border border-border bg-surface`} onClick={() => run(async () => { await SuloSession.logout(); setProbe(null); setStatus('none'); setNote('Semua data uji dihapus.'); })}>
          Keluar
        </button>
      </div>
      {busy && <p className="text-[14px] text-muted-foreground">Sebentar...</p>}
      {note && <p className="text-[14px]">{note}</p>}
      {probe && (
        <>
          <p className="text-[14px] text-muted-foreground">
            User-Agent: {probe.userAgent ?? '-'} · Cookie: {probe.cookieNames || '-'} · Mendarat di: {probe.landedPath || '-'}
          </p>
          {probe.sulo && <Attempt title="Dengan User-Agent Sulo" a={probe.sulo} />}
          {probe.webview && <Attempt title="Dengan User-Agent WebView (pembanding)" a={probe.webview} />}
        </>
      )}
    </main>
  );
}

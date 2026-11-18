// Hidden page #dev-sesi (M7 part F): the SIKOLA session age log. Tester and
// development builds only: the dashboard loads it behind MODE !== 'production'
// and no link points here (open dashboard.html#dev-sesi directly).
// scripts/check-no-dev-code.mjs fails a production build that contains it.

import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { EMPTY_SESSION_AGE, SESSION_AGE_KEY, SESSION_AGE_MAX, sessionAgeStats, type SessionAgeState } from '@/lib/net/session-age';
import { Card } from './Shell';

const time = (at: number | null) => (at === null ? '-' : new Date(at * 1000).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }));

export default function DevSession() {
  const [state, setState] = useState<SessionAgeState>(EMPTY_SESSION_AGE);
  useEffect(() => {
    const read = () => void browser.storage.local.get(SESSION_AGE_KEY).then((r) => setState({ ...EMPTY_SESSION_AGE, ...((r[SESSION_AGE_KEY] as SessionAgeState | undefined) ?? {}) }));
    read();
    browser.storage.onChanged.addListener(read);
    return () => browser.storage.onChanged.removeListener(read);
  }, []);
  const stats = sessionAgeStats(state.entries);
  return (
    <div className="space-y-4">
      <Card title="Umur sesi SIKOLA (build tester)">
        <p className="max-w-[68ch] text-[12px] leading-normal text-muted-foreground">
          Hanya dari request yang memang dikirim Sulo; tanpa ping tambahan. Lokal, tidak masuk laporan bug, ikut terhapus oleh Hapus semua data. Maksimal {SESSION_AGE_MAX} entri.
        </p>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-[14px] tabular-nums sm:grid-cols-[220px_minmax(0,1fr)]">
          <dt className="text-muted-foreground">Sukses terakhir</dt>
          <dd>{time(state.lastSuccessAt)}</dd>
          <dt className="text-muted-foreground">Mulai sesi ini</dt>
          <dd>{state.sessionStartAt === null ? (state.newSession ? 'menunggu sukses pertama sesi baru' : '-') : time(state.sessionStartAt)}</dd>
          <dt className="text-muted-foreground">Entri sesi habis</dt>
          <dd>{stats.count}</dd>
          <dt className="text-muted-foreground">Median sejak sukses terakhir</dt>
          <dd>{stats.median === null ? '-' : `${stats.median} menit`}</dd>
          <dt className="text-muted-foreground">Minimum sejak sukses terakhir</dt>
          <dd>{stats.min === null ? '-' : `${stats.min} menit`}</dd>
        </dl>
      </Card>
      <Card title="Entri (terbaru di atas)">
        {state.entries.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Belum ada sesi habis yang tercatat.</p>
        ) : (
          <table className="w-full text-left text-[12px] tabular-nums">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 font-normal">Terdeteksi habis</th>
                <th className="py-1 font-normal">Sejak sukses terakhir</th>
                <th className="py-1 font-normal">Sejak mulai sesi</th>
              </tr>
            </thead>
            <tbody>
              {state.entries.map((e) => (
                <tr key={e.expiredDetectedAt} className="border-t border-border">
                  <td className="py-1">{time(e.expiredDetectedAt)}</td>
                  <td className="py-1">{e.sejakSuksesTerakhirMenit} menit</td>
                  <td className="py-1">{e.sejakMulaiSesiMenit === null ? '-' : `${e.sejakMulaiSesiMenit} menit`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

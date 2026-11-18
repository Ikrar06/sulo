// Hidden screen, debug builds only (seven taps on the version): the session
// age log and the remaining time SIKOLA reported. Numbers and times only.
import { useEffect, useState } from 'react';
import { readSessionAge, sessionAgeStats, medianSessionHours, type SessionAgeState } from '@sulo/core/net/session-age';
import type { MobileWords } from '@sulo/core/i18n/mobile';
import type { Platform } from '@sulo/core/platform';
import { TIME_REMAINING_KEY, type TimeRemainingEntry } from './dev-log';

const time = (at: number) => new Date(at * 1000).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });

export function DevScreen({ platform, w, onBack }: { platform: Platform; w: MobileWords; onBack: () => void }) {
  const [age, setAge] = useState<SessionAgeState | null>(null);
  const [left, setLeft] = useState<TimeRemainingEntry[]>([]);
  useEffect(() => {
    void readSessionAge(platform.store).then(setAge);
    void platform.store.get<TimeRemainingEntry[]>(TIME_REMAINING_KEY).then((v) => setLeft(v ?? []));
  }, [platform]);
  const stats = sessionAgeStats(age?.entries ?? []);
  const hours = medianSessionHours(age?.entries ?? []);
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 text-m13 tabular-nums">
      <h1 className="text-m18 font-semibold">{w.dev.title}</h1>
      <p>Sesi habis tercatat: {stats.count} · median sejak sukses terakhir: {stats.median ?? '-'} menit · median umur sesi: {hours ?? '-'} jam</p>
      <ul className="flex flex-col gap-1">
        {(age?.entries ?? []).map((e) => (
          <li key={e.expiredDetectedAt}>
            {time(e.expiredDetectedAt)} · {e.sejakSuksesTerakhirMenit} menit sejak sukses · {e.sejakMulaiSesiMenit ?? '-'} menit sejak mulai sesi
          </li>
        ))}
      </ul>
      <h2 className="text-m15 font-semibold">{w.dev.remaining}</h2>
      {left.length === 0 ? (
        <p className="text-muted-foreground">{w.dev.none}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {left.map((e) => (
            <li key={e.at}>
              {time(e.at)} · {w.dev.seconds(e.seconds)}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="h-11 rounded-lg border border-border bg-surface px-4" onClick={onBack}>
        {w.dev.back}
      </button>
    </main>
  );
}

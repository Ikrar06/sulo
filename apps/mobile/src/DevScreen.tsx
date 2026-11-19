// Hidden screen, debug builds only (seven taps on the version): the session
// age log and the remaining time SIKOLA reported. Numbers and times only.
import { useEffect, useState } from 'react';
import { readSessionAge, sessionAgeStats, medianSessionHours, type SessionAgeState } from '@sulo/core/net/session-age';
import type { MobileWords } from '@sulo/core/i18n/mobile';
import type { Platform } from '@sulo/core/platform';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { TIME_REMAINING_KEY, type TimeRemainingEntry } from './dev-log';
import { NotifyTests } from './dev/NotifyTests';
import { PerfDev } from './dev/PerfDev';
import { OnboardingDev } from './dev/OnboardingDev';
import { TestConfig } from './dev/TestConfig';
import { NeosiaTrialDev } from './dev/NeosiaTrialDev';
import { SessionDiagDev } from './dev/SessionDiagDev';

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
  const row = 'py-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line';
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-3 bg-m-screen px-4 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))] text-m13 tabular-nums">{/* lint-ui-allow: 24 over the gesture bar */}
      <h1 className="px-1 text-m26">{w.dev.title}</h1>
      <Card>
        <p>Sesi habis tercatat: {stats.count} · median sejak sukses terakhir: {stats.median ?? '-'} menit · median umur sesi: {hours ?? '-'} jam</p>
        <ul className="mt-2">
          {(age?.entries ?? []).map((e) => (
            <li key={e.expiredDetectedAt} className={row}>
              {time(e.expiredDetectedAt)} · {e.sejakSuksesTerakhirMenit} menit sejak sukses · {e.sejakMulaiSesiMenit ?? '-'} menit sejak mulai sesi
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="text-m15 font-semibold">{w.dev.remaining}</h2>
        {left.length === 0 ? (
          <p className="mt-1 text-muted-foreground">{w.dev.none}</p>
        ) : (
          <ul className="mt-2">
            {left.map((e) => (
              <li key={e.at} className={row}>
                {time(e.at)} · {w.dev.seconds(e.seconds)}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <PerfDev platform={platform} />
      <OnboardingDev platform={platform} />
      <NotifyTests platform={platform} />
      <TestConfig platform={platform} />
      <SessionDiagDev />
      <NeosiaTrialDev />
      <div className="mt-auto pt-3">
        <PillButton full onPress={onBack}>
          {w.dev.back}
        </PillButton>
      </div>
    </main>
  );
}

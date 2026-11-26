// The hidden Diagnostik screen, in every build (seven taps on the version in
// Tentang; debug builds show it at the top of the dev screen): how long the
// sessions of SIKOLA, Sipakamase and NEOSIA lasted on this phone, from
// everyday use (owner's decision of 26 Nov 2026, docs/ios/PENJAGA-SESI.md),
// and the SIKOLA limit test. Times and numbers only; nothing leaves the phone.
import { useEffect, useState } from 'react';
import { readSessionAge, type SessionAgeState } from '@sulo/core/net/session-age';
import { NEOSIA_SESSION_LOG_KEY, neosiaSessionHours, type NeosiaSessionEntry } from '@sulo/core/neosia/session-log';
import { keepPace, readSessionLog, type SipakamaseSessionLog } from '@sulo/core/sipakamase/session-log';
import { sourcesFrom } from '@sulo/core/remote/sources';
import { readRemoteConfig } from '@sulo/core/remote/remote-config';
import type { MobileWords } from '@sulo/core/i18n/mobile';
import type { Platform } from '@sulo/core/platform';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { createNeosiaStore } from '../platform/neosia-store';
import { SuloNeosia } from '../neosia-native';
import { sipakamaseStore } from '../sipakamase/service';
import { readWatchStatus } from '../watch-native';
import { finishLimitTest, LIMIT_TEST_KEY, LIMIT_TEST_WAIT_SEC, longestGapMin, pingCounted, startLimitTest, type LimitTestState } from '../diag/limit-test';

const time = (at: number) => new Date(at * 1000).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
const row = 'py-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line';

function SikolaCard({ platform, w }: { platform: Platform; w: MobileWords['diag'] }) {
  const [age, setAge] = useState<SessionAgeState | null>(null);
  const [gap, setGap] = useState<number | null>(null);
  const [test, setTest] = useState<LimitTestState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    void readSessionAge(platform.store).then(setAge);
    void readWatchStatus().then((s) => setGap(longestGapMin(s.timings, platform.clock.now())));
    void platform.store.get<LimitTestState>(LIMIT_TEST_KEY).then((v) => setTest(v ?? null));
  }, [platform]);
  const entries = [...(age?.entries ?? [])].slice(0, 5);
  const readyAt = test ? test.startedAt + LIMIT_TEST_WAIT_SEC : 0;
  const run = async (step: () => Promise<LimitTestState | null>) => {
    setBusy(true);
    setNote(null);
    try {
      const next = await step();
      if (next === null) setNote(w.limitFailed);
      else setTest(next);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <h2 className="text-m15 font-semibold">SIKOLA</h2>
      <p className="mt-1">{w.ended(age?.entries.length ?? 0)}</p>
      {entries.length > 0 && (
        <ul className="mt-1">
          {entries.map((e) => (
            <li key={e.expiredDetectedAt} className={row}>
              {w.endLine(time(e.expiredDetectedAt), e.sejakSuksesTerakhirMenit, e.sejakMulaiSesiMenit === null ? w.unknown : w.minutes(e.sejakMulaiSesiMenit))}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-muted-foreground">{gap === null ? w.noChecks : w.checkGap(gap)}</p>
      <h3 className="mt-3 font-semibold">{w.limitTitle}</h3>
      <p className="mt-1 text-muted-foreground">{w.limitHelp}</p>
      {test?.result && (
        <p className="mt-1">
          {w.limitReadings(test.first, test.result.beforePing, test.result.afterPing)} {pingCounted(test.result.beforePing, test.result.afterPing) ? w.limitCounted : w.limitNotCounted}
        </p>
      )}
      {test && !test.result && platform.clock.now() < readyAt && <p className="mt-1">{w.limitWait(time(readyAt))}</p>}
      {note && (
        <p role="status" className="mt-1">
          {note}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <PillButton small disabled={busy} onPress={() => run(() => startLimitTest(platform))}>
          {w.limitStart}
        </PillButton>
        {test && !test.result && (
          <PillButton small kind="primary" disabled={busy || platform.clock.now() < readyAt} onPress={() => run(() => finishLimitTest(platform, test))}>
            {w.limitFinish}
          </PillButton>
        )}
      </div>
    </Card>
  );
}

function SipakamaseCard({ platform, w }: { platform: Platform; w: MobileWords['diag'] }) {
  const [log, setLog] = useState<SipakamaseSessionLog | null>(null);
  const [floor, setFloor] = useState(180);
  useEffect(() => {
    void readSessionLog(sipakamaseStore(platform)).then(setLog);
    void readRemoteConfig(platform.store).then((c) => setFloor(sourcesFrom(c).sipakamase.keepIntervalMinutes));
  }, [platform]);
  if (!log) return null;
  const pace = keepPace(log, floor);
  return (
    <Card>
      <h2 className="text-m15 font-semibold">Sipakamase</h2>
      <p className="mt-1">
        {w.pace(pace.intervalMin)} {w.paceBasis[pace.basis]}
      </p>
      {pace.tooSlow && <p className="mt-1 font-semibold">{w.tooSlow}</p>}
      {log.longestOkGapMin > 0 && <p className="mt-1">{w.survived(log.longestOkGapMin)}</p>}
      {log.cookie && <p className="mt-1">{w.cookie(log.cookie.expires, log.cookie.maxAge)}</p>}
      <p className="mt-1">{w.ended(log.ends.length)}</p>
      {log.ends.length > 0 && (
        <ul className="mt-1">
          {[...log.ends]
            .reverse()
            .slice(0, 5)
            .map((e) => (
              <li key={e.endedAt} className={row}>
                {w.endLine(time(e.endedAt), e.sinceLastOkMin, e.sinceStartMin === null ? w.unknown : w.minutes(e.sinceStartMin))}
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}

function NeosiaCard({ platform, w }: { platform: Platform; w: MobileWords['diag'] }) {
  const [log, setLog] = useState<NeosiaSessionEntry[]>([]);
  useEffect(() => {
    // NEOSIA's log lives in its encrypted store (keys under "neosia:").
    void createNeosiaStore(platform.store, SuloNeosia)
      .get<NeosiaSessionEntry[]>(NEOSIA_SESSION_LOG_KEY)
      .then((v) => setLog(v ?? []));
  }, [platform]);
  const hours = neosiaSessionHours(log);
  return (
    <Card>
      <h2 className="text-m15 font-semibold">NEOSIA</h2>
      <p className="mt-1">{hours.length === 0 ? w.none : w.neosiaHours(hours.join(', '))}</p>
    </Card>
  );
}

/** The cards alone: the dev screen shows them too. */
export function DiagnostikCards({ platform, w }: { platform: Platform; w: MobileWords }) {
  return (
    <>
      <p className="px-1 text-muted-foreground">{w.diag.intro}</p>
      <SikolaCard platform={platform} w={w.diag} />
      <SipakamaseCard platform={platform} w={w.diag} />
      <NeosiaCard platform={platform} w={w.diag} />
    </>
  );
}

export function Diagnostik({ platform, w, onBack }: { platform: Platform; w: MobileWords; onBack: () => void }) {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-3 bg-m-screen px-4 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))] text-m13 tabular-nums">{/* lint-ui-allow: 24 over the gesture bar */}
      <h1 className="px-1 text-m26">{w.diag.title}</h1>
      <DiagnostikCards platform={platform} w={w} />
      <div className="mt-auto pt-3">
        <PillButton full onPress={onBack}>
          {w.diag.back}
        </PillButton>
      </div>
    </main>
  );
}

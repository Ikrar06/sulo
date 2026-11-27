// "Hubungkan dengan SIKOLA" (Tahap 2, second layout). The scene is a picture
// of a browser tab, not a form: no fields, no buttons, no sign-in words,
// hidden from screen readers and not clickable. The status line under the
// actions says what Sulo sees; "Tersambung" shows 600 ms before
// "Menyiapkan Sulo" (journey-preparing.tsx).

import { useEffect, useState } from 'react';
import { formatClock } from '@sulo/core/format/time';
import { STAGE_ROWS, stageResults, type OnboardingStages } from '@sulo/core/onboarding/stages';
import { extOnboardingWords } from '@sulo/core/i18n/ext-onboarding';
import { useI18n } from '@sulo/ui/i18n';
import { LockIcon } from '@sulo/ui/icons';
import { Button } from '@sulo/ui/ui/button';
import { In } from './journey-intro';
import { JActions, JAfter, JLine, JLink, JStatus, JTitle, useMascot } from './journey';

const words = (locale: 'id' | 'en') => extOnboardingWords(locale);
const faint = 'color-mix(in oklab, var(--foreground) 22%, transparent)';

export type ConnectPhase = 'checking' | 'waiting' | 'need_login' | 'connected' | 'failed';

/**
 * The request limits stopped the setup before SIKOLA answered (moodle/budget.ts): the loop guard's short pause
 * (it ends at `until`, unix seconds) or the day's limit (until midnight). Not a failure, and nothing to retry yet.
 */
export type SetupRest = { kind: 'short'; until: number } | { kind: 'day' };

/** True once a short pause is over (a timer flips it), so "Coba lagi" turns on by itself; never for the day's limit. */
function useRestOver(rest: SetupRest | null): boolean {
  const left = () => (rest?.kind === 'short' ? rest.until * 1000 - Date.now() : Infinity);
  const [over, setOver] = useState(() => left() <= 0);
  useEffect(() => {
    setOver(left() <= 0);
    if (rest?.kind !== 'short' || left() <= 0) return;
    const t = window.setTimeout(() => setOver(true), left() + 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rest]);
  return over;
}

/** A browser tab drawn as an outline: its address bar (lock and SIKOLA's address), an abstract page; then the three steps. */
export function SceneConnect() {
  const { locale } = useI18n();
  const { phone, ext } = words(locale);
  return (
    <div className="obj-scene pointer-events-none cursor-default select-none">
      <In i={0}>
        <div className="rounded-[20px] border-2" style={{ borderColor: faint }}>
          <div className="flex h-14 items-center px-4">
            <span className="inline-flex h-8 items-center gap-2 rounded-full px-3 text-[13px] whitespace-nowrap text-muted-foreground" style={{ background: 'var(--layer-inset)' }}>
              <LockIcon className="size-4" />
              {phone.signin.address}
            </span>
          </div>
          <div className="space-y-3 px-6 pt-2 pb-7">
            <span className="block h-3 w-[72%] rounded-full" style={{ background: 'var(--layer-inset)' }} />
            <span className="block h-3 w-[88%] rounded-full" style={{ background: 'var(--layer-inset)' }} />
            <span className="block h-3 w-[36%] rounded-full" style={{ background: 'var(--layer-inset)' }} />
          </div>
        </div>
      </In>
      <In i={1}>
        <ol className="m-card rounded-card grid gap-1 p-2">
          {ext.scene.steps.map((step, i) => (
            <li key={step} className="flex items-center gap-3 px-2 py-2 text-[14px]">
              <span className="flex size-7 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums" style={{ background: 'var(--layer-inset)' }}>
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </In>
    </div>
  );
}

export function ConnectText({ phase, preparing, stages, failedReason, rest = null, switching, onOpen, onRetry, onWhy }: { phase: ConnectPhase; preparing: boolean; stages: OnboardingStages['stages']; failedReason: string; rest?: SetupRest | null; switching: boolean; onOpen: () => void; onRetry: () => void; onWhy: () => void }) {
  const { m, locale } = useI18n();
  const { phone, ext } = words(locale);
  const resting = phase === 'failed' && rest !== null;
  const restOver = useRestOver(resting ? rest : null);
  useMascot(
    resting
      ? { state: 'idle' }
      : preparing && phase !== 'failed' && !stages.some((st) => st.result === 'failed')
        ? { state: 'syncing', look: null }
        : phase === 'failed' || stages.some((st) => st.result === 'failed')
          ? { state: 'stale', look: null }
          : phase === 'connected'
            ? { state: 'all-done', look: null }
            : { state: 'idle' },
  );
  // A pause: why, when it ends, and "Coba lagi" only once it can work (never for the day's limit).
  const restLine = resting ? <JLine>{rest.kind === 'day' ? ext.rest.dayLine : ext.rest.line}</JLine> : null;
  const restStatus = resting ? (
    <JStatus tone="wait">{rest.kind === 'day' ? ext.rest.dayStatus : ext.rest.shortStatus(formatClock(rest.until, Intl.DateTimeFormat().resolvedOptions().timeZone, m))}</JStatus>
  ) : null;
  const restActions =
    resting && rest.kind === 'short' ? (
      <JActions>
        <Button disabled={!restOver} onClick={onRetry}>
          {phone.preparing.retry}
        </Button>
      </JActions>
    ) : null;
  if (preparing) {
    // The bar's four segments follow the rows: connected, then each stage that ended well.
    const results = stageResults(stages);
    const current = STAGE_ROWS.find((r) => results[r] === null) ?? STAGE_ROWS[STAGE_ROWS.length - 1]!;
    // Paused before SIKOLA answered: not even the connection counts (journey-preparing.tsx preparingRows).
    const done = (resting && !STAGE_ROWS.some((r) => results[r] === 'ok') ? 0 : 1) + STAGE_ROWS.filter((r) => results[r] === 'ok').length;
    const failed = !resting && (phase === 'failed' || STAGE_ROWS.some((r) => results[r] === 'failed'));
    return (
      <>
        <JTitle id="ob-title">{phone.preparing.title}</JTitle>
        {restLine}
        {restActions}
        {failed && <JLine>{phone.preparing.failedTitle}</JLine>}
        {failed && (
          <JActions>
            <Button onClick={onRetry}>{phone.preparing.retry}</Button>
          </JActions>
        )}
        <JAfter>
          {restStatus ?? (failed ? <JStatus tone="problem">{failedReason || phone.preparing.failedTitle}</JStatus> : <JStatus tone="busy">{phone.preparing.stages[current]}</JStatus>)}
          <div role="progressbar" aria-label={phone.preparing.title} aria-valuemin={0} aria-valuemax={4} aria-valuenow={done} className="mt-4 flex w-[240px] gap-1.5">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-150 ${i < done ? 'bg-foreground' : 'bg-foreground/20'}`} />
            ))}
          </div>
        </JAfter>
      </>
    );
  }
  const status =
    phase === 'checking' ? (
      <JStatus tone="busy">{ext.connect.checking}</JStatus>
    ) : phase === 'waiting' ? (
      <JStatus tone="busy">{ext.connect.waiting}</JStatus>
    ) : phase === 'need_login' ? (
      <JStatus tone="wait">{ext.connect.needLogin}</JStatus>
    ) : phase === 'connected' ? (
      <JStatus tone="ok">{ext.connect.connected}</JStatus>
    ) : (
      (restStatus ?? <JStatus tone="problem">{failedReason}</JStatus>)
    );
  return (
    <>
      <JTitle id="ob-title">{ext.connect.title}</JTitle>
      {restLine ?? <JLine>{switching ? ext.connect.switchBody : ext.connect.body}</JLine>}
      {resting ? (
        restActions
      ) : (
        <JActions>{phase === 'failed' ? <Button onClick={onRetry}>{phone.preparing.retry}</Button> : <Button onClick={onOpen}>{ext.connect.open}</Button>}</JActions>
      )}
      <JLink onClick={onWhy}>{ext.why}</JLink>
      <JAfter>{status}</JAfter>
    </>
  );
}


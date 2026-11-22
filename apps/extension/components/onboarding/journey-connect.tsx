// "Hubungkan dengan SIKOLA" (Tahap 2, second layout). The scene is a picture
// of a browser tab, not a form: no fields, no buttons, no sign-in words,
// hidden from screen readers and not clickable. The status line under the
// actions says what Sulo sees; "Tersambung" shows 600 ms before
// "Menyiapkan Sulo" (journey-preparing.tsx).

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

export function ConnectText({ phase, preparing, stages, failedReason, switching, onOpen, onRetry, onWhy }: { phase: ConnectPhase; preparing: boolean; stages: OnboardingStages['stages']; failedReason: string; switching: boolean; onOpen: () => void; onRetry: () => void; onWhy: () => void }) {
  const { locale } = useI18n();
  const { phone, ext } = words(locale);
  useMascot(preparing && phase !== 'failed' && !stages.some((st) => st.result === 'failed') ? { state: 'syncing', look: null } : phase === 'failed' || stages.some((st) => st.result === 'failed') ? { state: 'stale', look: null } : phase === 'connected' ? { state: 'all-done', look: null } : { state: 'idle' });
  if (preparing) {
    // The bar's four segments follow the rows: connected, then each stage that ended well.
    const results = stageResults(stages);
    const current = STAGE_ROWS.find((r) => results[r] === null) ?? STAGE_ROWS[STAGE_ROWS.length - 1]!;
    const done = 1 + STAGE_ROWS.filter((r) => results[r] === 'ok').length;
    const failed = phase === 'failed' || STAGE_ROWS.some((r) => results[r] === 'failed');
    return (
      <>
        <JTitle id="ob-title">{phone.preparing.title}</JTitle>
        {failed && <JLine>{phone.preparing.failedTitle}</JLine>}
        {failed && (
          <JActions>
            <Button onClick={onRetry}>{phone.preparing.retry}</Button>
          </JActions>
        )}
        <JAfter>
          {failed ? <JStatus tone="problem">{failedReason || phone.preparing.failedTitle}</JStatus> : <JStatus tone="busy">{phone.preparing.stages[current]}</JStatus>}
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
      <JStatus tone="problem">{failedReason}</JStatus>
    );
  return (
    <>
      <JTitle id="ob-title">{ext.connect.title}</JTitle>
      <JLine>{switching ? ext.connect.switchBody : ext.connect.body}</JLine>
      <JActions>
        {phase === 'failed' ? <Button onClick={onRetry}>{phone.preparing.retry}</Button> : <Button onClick={onOpen}>{ext.connect.open}</Button>}
      </JActions>
      <JLink onClick={onWhy}>{ext.why}</JLink>
      <JAfter>{status}</JAfter>
    </>
  );
}


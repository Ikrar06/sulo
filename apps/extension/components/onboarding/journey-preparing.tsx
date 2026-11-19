// "Menyiapkan Sulo" (Tahap 2, second layout): four rows, all shown from the
// start, in the real order of the setup sync's events (connected, then
// runSync's stages: tasks, courses, attendance). Each row is a 56 card: a
// 20 status icon, the label, the real number on the right. Waiting: dimmed,
// a slowly pulsing dot, no number. Running: full, a small spinner. Done: the
// check (as the task circle fills) and the number counting up. Failed: a
// neutral warning icon. Rows never move or change height; every change comes
// from a real event, no timer stands in for one.

import { useEffect, useState } from 'react';
import { STAGE_ROWS, stageResults, type OnboardingStages } from '@sulo/core/onboarding/stages';
import type { SyncStage } from '@sulo/core/sync/run-sync';
import { extOnboardingWords } from '@sulo/core/i18n/ext-onboarding';
import { useI18n } from '@sulo/ui/i18n';
import { AlertIcon } from '@sulo/ui/icons';
import { sceneLevel, story, useNarrow } from './journey';

const words = (locale: 'id' | 'en') => extOnboardingWords(locale);

export type RowState = 'waiting' | 'running' | 'done' | 'failed';

/** Each row's state from the stages so far; the first unfinished one runs, or fails when the sync failed. */
export function preparingRows(stages: OnboardingStages['stages'], failed: boolean): Record<'connected' | SyncStage, RowState> {
  const results = stageResults(stages);
  const out: Record<'connected' | SyncStage, RowState> = { connected: 'done', tasks: 'waiting', courses: 'waiting', attendance: 'waiting' };
  let running = false;
  for (const r of STAGE_ROWS) {
    const res = results[r];
    if (res === 'ok') out[r] = 'done';
    else if (res === 'failed') out[r] = 'failed';
    else if (!running) {
      out[r] = failed ? 'failed' : 'running';
      running = true;
    }
  }
  return out;
}

/** A number counting up to `to` once it is known (at once under reduced motion). */
function useCountUp(to: number | null): number | null {
  const [v, setV] = useState<number | null>(to === null || sceneLevel() !== 'full' ? to : 0);
  useEffect(() => {
    if (to === null) return setV(null);
    if (sceneLevel() !== 'full') return setV(to);
    const start = performance.now();
    const ms = story(500);
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      setV(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return v;
}

function StatusIcon({ state }: { state: RowState }) {
  if (state === 'failed') return <AlertIcon className="size-5 text-muted-foreground" />;
  if (state === 'running') return <span aria-hidden="true" className="obj-spin block size-4 rounded-full border-2 border-foreground/25 border-t-foreground" />;
  const done = state === 'done';
  // The task circle's check: the circle fills and the tick shows (150 ms).
  return (
    <span aria-hidden="true" className={`inline-flex size-5 items-center justify-center rounded-full border-2 transition-colors duration-150 motion-reduce:transition-none ${done ? 'border-foreground bg-foreground text-bg' : 'border-transparent text-transparent'}`}>
      {done ? (
        <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5 10 17 19 7.5" />
        </svg>
      ) : (
        <span className="obj-pulse block size-2 rounded-full bg-foreground" />
      )}
    </span>
  );
}

function Row({ state, label, value }: { state: RowState; label: string; value: string | null }) {
  return (
    <div className={`m-card rounded-card flex h-14 items-center gap-3 px-4 transition-opacity duration-150 motion-reduce:transition-none ${state === 'waiting' ? 'opacity-50' : ''}`}>
      <span className="flex size-5 shrink-0 items-center justify-center">
        <StatusIcon state={state} />
      </span>
      <span className="min-w-0 flex-1 text-[15px] leading-5 font-medium">{label}</span>
      <span className="min-w-[7.5rem] text-right text-[15px] leading-5 font-semibold whitespace-nowrap tabular-nums">{value}</span>
    </div>
  );
}

export function ScenePreparing({ stages, counts, failed = false }: { stages: OnboardingStages['stages']; counts: { tasks: number; courses: number }; failed?: boolean }) {
  const { locale } = useI18n();
  const { phone, ext } = words(locale);
  const rows = preparingRows(stages, failed);
  const tasks = useCountUp(rows.tasks === 'done' ? counts.tasks : null);
  const courses = useCountUp(rows.courses === 'done' ? counts.courses : null);
  const narrow = useNarrow();
  const all = [
    { key: 'connected', state: rows.connected, label: ext.preparing.connected, value: null },
    { key: 'tasks', state: rows.tasks, label: ext.preparing.rows.tasks, value: tasks === null ? null : phone.preparing.chips.tasks(tasks) },
    { key: 'courses', state: rows.courses, label: ext.preparing.rows.courses, value: courses === null ? null : phone.preparing.chips.courses(courses) },
    { key: 'attendance', state: rows.attendance, label: rows.attendance === 'done' ? ext.preparing.rows.attendanceDone : ext.preparing.rows.attendance, value: null },
  ];
  return (
    <div className="obj-scene obj-rows" aria-live="polite">
      {(narrow ? all.slice(1) : all).map((r) => (
        <Row key={r.key} state={r.state} label={r.label} value={r.value} />
      ))}
    </div>
  );
}

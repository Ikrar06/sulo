// "Menyiapkan Sulo" (Tahap 2, second layout): four results in a 2x2 grid with
// real numbers (connected, then each stage of the setup sync as it ends).

import { STAGE_ROWS, stageResults, type OnboardingStages } from '@sulo/core/onboarding/stages';
import { extOnboardingWords } from '@sulo/core/i18n/ext-onboarding';
import { useI18n } from '@sulo/ui/i18n';
import { CheckIcon } from '@sulo/ui/icons';
import { In } from './journey-intro';
import { useNarrow } from './journey';

const words = (locale: 'id' | 'en') => extOnboardingWords(locale);

/** "Menyiapkan Sulo": four results in a 2x2 grid with real numbers, each in as its stage of the sync ends. */
export function ScenePreparing({ stages, counts }: { stages: OnboardingStages['stages']; counts: { tasks: number; courses: number } }) {
  const { locale } = useI18n();
  const { phone, ext } = words(locale);
  const results = stageResults(stages);
  const narrow = useNarrow();
  const pieces = [
    { key: 'connected', ok: true, text: ext.preparing.connected },
    ...STAGE_ROWS.map((r) => ({ key: r, ok: results[r] === 'ok', text: r === 'tasks' ? phone.preparing.chips.tasks(counts.tasks) : r === 'courses' ? phone.preparing.chips.courses(counts.courses) : phone.preparing.chips.attendance })),
  ].slice(0, narrow ? 3 : 4);
  return (
    <div className="obj-scene" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }} aria-live="polite">
      {pieces.map((p, i) => (
        // Each place is kept (no background) so a piece never moves when the next one comes in.
        <div key={p.key} className="h-[160px]">
          {p.ok && (
            <In i={i === 0 ? 0 : 1}>
              <div className="m-card rounded-card flex h-[160px] flex-col justify-between p-4">
                <span className="flex size-9 items-center justify-center rounded-full" style={{ background: 'var(--layer-inset)' }}>
                  <CheckIcon className="size-4" />
                </span>
                <span className="text-[16px] leading-6 font-semibold">{p.text}</span>
              </div>
            </In>
          )}
        </div>
      ))}
    </div>
  );
}


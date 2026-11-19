import { useMemo } from 'react';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { NO_ACTIONS, PopupView } from '@/components/popup/PopupView';
import { DEFAULT_REMINDERS } from '@sulo/core/reminders/settings';
import { DEFAULT_UPDATES } from '@sulo/core/radar/settings';
import { useI18n } from '@sulo/ui/i18n';
import type { UnixSeconds } from '@sulo/core/types';
import type { MascotState, PopupView as View } from '@sulo/core/view/popup-view';
import { buildSampleView } from '@sulo/core/view/sample-view';


export interface SampleCardProps {
  now: UnixSeconds;
  timeZone: string;
  mascot: MascotState;
  celebrate?: number;
  /** Replace the invented tasks with another view (step 4: the user's own list). */
  view?: View;
  /** Caption under the card; "Contoh tampilan" by default. */
  label?: string;
}

/**
 * The real popup component, filled with invented tasks, with the mascot
 * perched on its top edge. Inert: it only shows what Sulo looks like.
 */
export function SampleCard({ now, timeZone, mascot, celebrate = 0, view, label }: SampleCardProps) {
  const { m } = useI18n();
  const sample = useMemo(() => view ?? buildSampleView(now, timeZone, m), [view, now, timeZone, m]);
  return (
    <figure className="ob-sample">
      <div className="ob-sample-frame">
        <div className="ob-perch" aria-hidden="true">
          <Mascot state={mascot} celebrate={celebrate} size={128} followCursor effects grounded />
        </div>
        <div className="ob-sample-card" inert>
          <PopupView view={sample} now={now} timeZone={timeZone} dueFormat="both" reminders={DEFAULT_REMINDERS} updatesSettings={DEFAULT_UPDATES} {...NO_ACTIONS} sample dev={null} />
        </div>
      </div>
      <figcaption className="ob-sample-label">{label ?? m.onboarding.intro.sampleLabel}</figcaption>
    </figure>
  );
}

// "Semua siap." (Tahap 2, second layout): the user's own nearest tasks as
// real task cards (three, four at 1440x900), or one calm card when there is
// none; the mascot celebrates in its usual place.

import type { TaskRow } from '@sulo/core/view/popup-view';
import { extOnboardingWords } from '@sulo/core/i18n/ext-onboarding';
import { useI18n } from '@sulo/ui/i18n';
import { CheckIcon } from '@sulo/ui/icons';
import { Chip } from '@sulo/ui/mobile/cards';
import { TaskCardView } from '@sulo/ui/mobile/task-card';
import { courseTint } from '@sulo/ui/mobile/tint';
import { Button } from '@sulo/ui/ui/button';
import { URGENCY_TEXT } from '@sulo/ui/urgency';
import { In } from './journey-intro';
import { JActions, JAfter, JLine, JTitle, sceneLevel, useMascot, useRoomy } from './journey';

const words = (locale: 'id' | 'en') => extOnboardingWords(locale);

// ---------- Done: the user's own nearest tasks, then Ringkasan ----------

/** Up to four of the user's tasks, in the popup's order (the most pressing first); the scene shows three, four at 1440x900. */
export function doneTasks(groups: { rows: TaskRow[] }[]): TaskRow[] {
  return groups.flatMap((g) => g.rows).slice(0, 4);
}

export function SceneDone({ tasks }: { tasks: TaskRow[] }) {
  const { locale } = useI18n();
  const { ext } = words(locale);
  const shown = tasks.slice(0, useRoomy() ? 4 : 3);
  if (shown.length === 0) {
    return (
      <div className="obj-scene">
        <In i={0}>
          <div className="m-card rounded-card flex items-center gap-3 p-4 text-[14px] leading-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--layer-inset)' }}>
              <CheckIcon className="size-4 text-muted-foreground" />
            </span>
            {ext.done.noTasks}
          </div>
        </In>
      </div>
    );
  }
  return (
    <div className="obj-scene pointer-events-none">
      {shown.map((t, i) => (
        <In key={t.eventId} i={i}>
          <TaskCardView course={t.courseName} color={courseTint(t.courseColor)} title={t.name} relative={t.left || t.remaining} tone={URGENCY_TEXT[t.urgency]} done={false} doneLabel="" onDone={() => undefined} still />
        </In>
      ))}
    </div>
  );
}

export function DoneText({ tasks, courses, onOpen }: { tasks: number; courses: number; onOpen: () => void }) {
  const { locale } = useI18n();
  const { phone, ext } = words(locale);
  // It celebrates (a jump, star eyes for a moment, then happy), in its usual place.
  useMascot({ state: 'all-done', celebrate: sceneLevel() === 'still' ? 0 : 1, look: null });
  return (
    <>
      <JTitle id="ob-title">{phone.done.title}</JTitle>
      <JLine>{ext.done.body}</JLine>
      <JActions>
        <Button onClick={onOpen}>{phone.done.open}</Button>
      </JActions>
      <JAfter>
        <div className="flex flex-wrap gap-2">
          <Chip>{tasks > 0 ? phone.done.tasks(tasks) : phone.done.empty}</Chip>
          <Chip>{ext.done.courses(courses)}</Chip>
        </div>
      </JAfter>
    </>
  );
}

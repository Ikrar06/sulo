// "Nilai" in a task's details (1.1.0, from a user's suggestion): hidden until "Lihat nilai" is tapped, then
// one read of the assignment page on SIKOLA (sync.ts taskGrade, core tasks/grade-service.ts), kept a day.
// Leaving the task hides it again. Masked in privacy mode like every grade. When Sulo cannot read it, the
// card says so and offers SIKOLA's own page.

import { formatAgo } from '@sulo/core/format/time';
import { mobileDash } from '@sulo/core/i18n/mobile';
import { gradeLine } from '@sulo/core/tasks/grade-view';
import type { Task } from '@sulo/core/types';
import { useTaskGrade } from '@sulo/ui/dashboard/task-grade';
import { useI18n } from '@sulo/ui/i18n';
import { ExternalIcon } from '@sulo/ui/icons';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { Private } from '@sulo/ui/private';
import { useMobileData } from '../shell/data';
import { taskGrade } from '../sync';

export function TaskGradeCard({ task }: { task: Task & { cmId: number } }) {
  const { m, locale } = useI18n();
  const d = mobileDash(locale);
  const t = d.tugas;
  const { data, actions, platform } = useMobileData();
  const grade = useTaskGrade((again) => taskGrade(platform, task.cmId, again));
  const s = grade.state;
  const line = s.phase === 'shown' ? gradeLine(s.outcome, m.intl) : null;
  const checkedAt = line && 'fetchedAt' in line ? line.fetchedAt : null;
  const message =
    line === null || line.kind === 'value'
      ? null
      : { none: t.gradeNone, not_shown: t.gradeNotShown, unknown: t.gradeUnknown, failed: t.gradeFailed, expired: t.gradeExpired, wait: t.gradeWait }[line.kind];
  // Where Sulo could not give the answer, SIKOLA's own page can.
  const offerSikola = line !== null && (line.kind === 'unknown' || line.kind === 'failed' || line.kind === 'not_shown');

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-m15 font-semibold">{t.grade}</h3>
        {checkedAt !== null && <span className="text-m12 text-muted-foreground">{t.gradeChecked(formatAgo(checkedAt, data!.now, m))}</span>}
      </div>
      {s.phase === 'hidden' && <p className="mt-1 text-m13 text-muted-foreground">{t.gradeHelp}</p>}
      {s.phase === 'loading' && (
        <p role="status" className="mt-1 text-m13 text-muted-foreground">
          {t.gradeLoading}
        </p>
      )}
      {line?.kind === 'value' && (
        <p className="m-data-in mt-2 text-m22 font-semibold tabular-nums">
          <Private>{line.text}</Private>
        </p>
      )}
      {message && (
        <p role="status" className="m-data-in mt-1 text-m13 text-muted-foreground">
          {message}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {s.phase !== 'shown' ? (
          <PillButton small disabled={s.phase === 'loading'} onPress={grade.see}>
            {t.gradeSee}
          </PillButton>
        ) : (
          <>
            {line?.kind !== 'expired' && line?.kind !== 'wait' && line?.kind !== 'unknown' && (
              <PillButton small onPress={grade.again}>
                {t.gradeAgain}
              </PillButton>
            )}
            {offerSikola && (
              <PillButton small icon={ExternalIcon} onPress={() => actions.openExternal(task.url)}>
                {d.common.openInSikola}
              </PillButton>
            )}
            <PillButton small onPress={grade.hide}>
              {t.gradeHide}
            </PillButton>
          </>
        )}
      </div>
    </Card>
  );
}

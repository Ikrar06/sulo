// sulo-dev-diagnostics: development builds only. Loaded through a lazy
// import inside `import.meta.env.MODE === 'development'`, so production and tester bundles never
// contain it (scripts/check-no-dev-code.mjs fails the build if they do).
// Plain English on purpose: users never see budgets, backoff or turns.

import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { activeCourseIds } from '@/lib/courses/active-score';
import { loopPaused } from '@/lib/moodle/budget';
import { BACKOFF_KEY } from '@/lib/moodle/backoff';
import { DAILY_BUDGET, DAILY_CALL_BUDGET, MANUAL_COOLDOWN_SEC, SOFT_DAILY_POSTS } from '@/lib/moodle/limits';
import { coursesDueSoon, pickCoursesToCheck } from '@/lib/radar/schedule';
import type { BackoffState } from '@/lib/types';
import type { DashboardData } from './data';
import { Card } from './Shell';

export default function DevDiagnostics({ data }: { data: DashboardData }) {
  const [backoff, setBackoff] = useState<BackoffState | null>(null);
  useEffect(() => {
    void browser.storage.local.get(BACKOFF_KEY).then((r) => setBackoff((r[BACKOFF_KEY] as BackoffState | undefined) ?? null));
  }, [data.now]);
  const budget = data.view.budget;
  const user = data.user;
  const now = data.now;
  const lastSync = data.view.lastSyncAt;
  const cooldown = lastSync === null ? 0 : Math.max(0, MANUAL_COOLDOWN_SEC - (now - lastSync));
  const checkedAt = user?.radar.stateCheckedAt ?? {};
  const active = user ? [...activeCourseIds(user.courses)] : [];
  const turn = user ? pickCoursesToCheck(active, checkedAt, now, { soon: coursesDueSoon(user.tasks, now) }) : [];
  const name = (id: number) => data.view.courseNames[String(id)] ?? String(id);
  const age = (at: number | undefined) => (at === undefined ? 'never' : `${Math.round((now - at) / 60)} min ago`);
  return (
    <Card title="Diagnostics (dev build only)">
      <dl className="grid gap-x-6 gap-y-1 text-[12px] tabular-nums sm:grid-cols-2">
        <dt className="text-muted-foreground">POSTs today</dt>
        <dd>
          {budget.used} (saver from {SOFT_DAILY_POSTS}, hard stop {DAILY_BUDGET})
        </dd>
        <dt className="text-muted-foreground">Function calls today</dt>
        <dd>
          {budget.calls ?? 0} / {DAILY_CALL_BUDGET}
        </dd>
        <dt className="text-muted-foreground">Automatic sync mode</dt>
        <dd>{budget.used >= SOFT_DAILY_POSTS ? 'saver' : 'normal'}</dd>
        <dt className="text-muted-foreground">Loop guard</dt>
        <dd>{loopPaused(budget, now) ? `paused until ${new Date((budget.pausedUntil ?? 0) * 1000).toLocaleTimeString()}` : `${budget.recent?.length ?? 0} POSTs in the last 5 min`}</dd>
        <dt className="text-muted-foreground">Backoff</dt>
        <dd>{backoff && backoff.failures > 0 ? `${backoff.failures} failures, next ${new Date(backoff.nextAllowedAt * 1000).toLocaleTimeString()}` : 'none'}</dd>
        <dt className="text-muted-foreground">Update cooldown</dt>
        <dd>{cooldown > 0 ? `${cooldown} s left` : 'ready'}</dd>
        <dt className="text-muted-foreground">By source</dt>
        <dd>{Object.entries(budget.bySource ?? {}).map(([k, v]) => `${k} ${v}`).join(', ') || '-'}</dd>
      </dl>
      <p className="mt-3 text-[12px] font-semibold">Radar: next automatic turn</p>
      <p className="text-[12px]">{turn.length > 0 ? turn.map(name).join(', ') : 'nothing due'}</p>
      <ul className="mt-2 space-y-1 text-[12px] text-muted-foreground">
        {active.map((id) => (
          <li key={id}>
            {name(id)}: {age(checkedAt[String(id)])}
          </li>
        ))}
      </ul>
    </Card>
  );
}

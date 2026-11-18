// Development builds only: request counters, the request log and the
// session probe. PopupView loads it lazily behind MODE === 'development', so
// no other build contains it.

import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { SESSION_AGE_KEY, sessionAgeStats, type SessionAgeState } from '@/lib/net/session-age';
import { useI18n } from '@/components/i18n';
import { Button } from '@/components/ui/button';
import { DEV_WORDS } from '@/lib/i18n/dev';
import type { RequestSource } from '@/lib/types';
import type { PopupView as PopupViewModel } from '@/lib/view/popup-view';
import type { PopupViewProps } from './PopupView';

export default function DevPanel({ view, dev }: { view: PopupViewModel; dev: NonNullable<PopupViewProps['dev']> }) {
  const { locale } = useI18n();
  const t = DEV_WORDS[locale === 'en' ? 'en' : 'id'];
  const [probe, setProbe] = useState<string | null>(null);
  const [age, setAge] = useState<SessionAgeState | null>(null);
  useEffect(() => {
    void browser.storage.local.get(SESSION_AGE_KEY).then((r) => setAge((r[SESSION_AGE_KEY] as SessionAgeState | undefined) ?? null));
  }, []);
  const ageStats = sessionAgeStats(age?.entries ?? []);
  const sources = Object.entries(view.budget.bySource ?? {}) as [RequestSource, number][];
  const clock = (at: number) => new Date(at * 1000).toTimeString().slice(0, 8);
  return (
    <details className="mx-3 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground">
      <summary>{t.dev.title}</summary>
      <p className="tabular-nums">{t.dev.requests(view.budget.used, dev.budgetLimit)}</p>
      <p className="tabular-nums">{t.dev.calls(view.budget.calls ?? 0, dev.callLimit)}</p>
      <ul className="tabular-nums">
        {sources.map(([s, n]) => (
          <li key={s}>
            {t.dev.sources[s] ?? s}: {n}
          </li>
        ))}
      </ul>
      <p className="tabular-nums">{t.dev.withCourseList(view.budget.withCourseList ?? 0)}</p>
      {dev.openMs !== null && <p className="tabular-nums">{t.dev.openMs(dev.openMs)}</p>}
      {dev.onProbeSession && (
        <p className="flex items-center gap-2 py-1">
          <Button size="sm" variant="outline" onClick={() => void dev.onProbeSession?.().then(setProbe)}>
            {t.dev.probe}
          </Button>
          {probe && <span className="tabular-nums">{probe}</span>}
        </p>
      )}
      {/* Session age (M7 part F): entries and "since the last success"; the full list is at dashboard.html#dev-sesi. */}
      <p className="pt-1 font-semibold">Session age: {ageStats.count} expiries</p>
      <p className="tabular-nums">
        median {ageStats.median ?? '-'} min, min {ageStats.min ?? '-'} min since the last success
      </p>
      <ol className="max-h-24 overflow-y-auto tabular-nums">
        {(age?.entries ?? []).map((e) => (
          <li key={e.expiredDetectedAt}>
            {clock(e.expiredDetectedAt)} +{e.sejakSuksesTerakhirMenit}m / session {e.sejakMulaiSesiMenit ?? '-'}m
          </li>
        ))}
      </ol>
      <p className="pt-1 font-semibold">{t.dev.log(dev.requestLog.length)}</p>
      {dev.requestLog.length === 0 ? (
        <p>{t.dev.logEmpty}</p>
      ) : (
        <ol className="max-h-40 overflow-y-auto tabular-nums">
          {dev.requestLog.map((e, i) => (
            <li key={`${e.at}-${i}`}>
              {clock(e.at)} {e.domain} {e.trigger} {e.calls > 0 ? `${e.calls}f ` : ''}
              {e.bytes ?? '-'}c {e.outcome}
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}

// "Lengkapi data dari NEOSIA": the NEOSIA pages Sulo reads data from, each
// with a "Buka" link that opens that page in a new tab because the user
// clicked it. Sulo never opens a tab by itself, never closes or touches one.
// Status follows the stored snapshots, so it updates as soon as data comes
// in (the dashboard re-reads storage). One list everywhere:
// - overview: a full-width card while a required page is missing, then
//   "Data NEOSIA lengkap" once (5 s), then nothing
// - page (Nilai, Jadwal): replaces the page; `highlight` marks the page it needs
// - settings: the list only, always

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@sulo/ui/i18n';
import { Button } from '@sulo/ui/ui/button';
import { formatAgo } from '@sulo/core/format/time';
import { neosiaWords } from '@sulo/core/i18n/neosia';
import { completion, overviewNeosiaCard, sourceStatuses, type SourceId } from '@sulo/core/neosia/sources';
import type { Snapshots } from '@sulo/core/neosia/store';
import { CheckCircleIcon } from '@sulo/ui/dashboard-icons';
import { Card } from './Shell';

/** How long "Data NEOSIA lengkap" stays on the overview. */
const DONE_MS = 5000;

/** An empty circle: no data from this page yet. */
const EmptyCircle = ({ className = '' }: { className?: string }) => <span aria-hidden="true" className={`inline-block size-4 rounded-full border-2 border-muted-foreground ${className}`} />;

function ChecklistItems({ snapshots, now, highlight }: { snapshots: Snapshots; now: number; highlight?: SourceId }) {
  const { m, locale } = useI18n();
  const w = neosiaWords(locale).checklist;
  return (
    <ul className="divide-y divide-border">
      {sourceStatuses(snapshots).map(({ source, has, seenAt }) => {
        const s = w.sources[source.id];
        const marked = highlight === source.id && !has;
        return (
          <li key={source.id} className={`flex items-center gap-3 py-3 ${marked ? '-mx-3 rounded-lg bg-surface-raised px-3' : ''}`}>
            {has ? <CheckCircleIcon className="size-4 shrink-0 text-foreground" aria-label={w.has} role="img" aria-hidden={false} /> : <EmptyCircle className="shrink-0" />}
            {!has && <span className="sr-only">{w.missing}</span>}
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">
                {s.name}
                {source.checklist === 'optional' && <span className="ml-2 text-[12px] font-normal text-muted-foreground">{w.optional}</span>}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {s.desc}
                {seenAt !== null && ` · ${w.last(formatAgo(seenAt, now, m))}`}
              </p>
            </div>
            <Button variant={marked ? 'default' : 'outline'} size="sm" asChild>
              <a href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`${w.open} ${s.name}`}>
                {w.open}
              </a>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export function NeosiaChecklist({ snapshots, now, highlight, variant = 'page' }: { snapshots: Snapshots; now: number; highlight?: SourceId; variant?: 'page' | 'settings' }) {
  const { locale } = useI18n();
  const w = neosiaWords(locale).checklist;
  const list = <ChecklistItems snapshots={snapshots} now={now} highlight={highlight} />;
  if (variant === 'settings') return list;
  return (
    <Card title={w.title}>
      <p className="mb-1 max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{w.help}</p>
      {list}
    </Card>
  );
}

/**
 * The overview card, module on only (the invite covers "off"). It shows
 * "Data NEOSIA lengkap" only when the last required page came in while the
 * overview was open; a later visit with complete data shows nothing.
 */
export function NeosiaOverviewChecklist({ snapshots, now }: { snapshots: Snapshots; now: number }) {
  const { locale } = useI18n();
  const w = neosiaWords(locale).checklist;
  const { done, total, complete } = completion(sourceStatuses(snapshots));
  const sawIncomplete = useRef(!complete);
  if (!complete) sawIncomplete.current = true;
  const [doneShown, setDoneShown] = useState(false);
  const card = overviewNeosiaCard({ moduleOn: true, complete, sawIncomplete: sawIncomplete.current, doneShown });
  useEffect(() => {
    if (card !== 'done') return;
    const t = setTimeout(() => setDoneShown(true), DONE_MS);
    return () => clearTimeout(t);
  }, [card]);

  if (card === null) return null;
  if (card === 'done') {
    return (
      <section role="status" className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-[14px]" aria-label="NEOSIA">
        <CheckCircleIcon className="size-4 shrink-0 text-foreground" />
        <span className="font-semibold">{w.done}</span>
      </section>
    );
  }
  return (
    <Card title={w.count(done, total)}>
      <p className="mb-1 max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{w.overviewHelp}</p>
      <ChecklistItems snapshots={snapshots} now={now} />
    </Card>
  );
}

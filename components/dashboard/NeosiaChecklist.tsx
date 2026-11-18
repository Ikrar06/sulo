// "Lengkapi data dari NEOSIA" (M7.1): the NEOSIA pages whose data Sulo still
// lacks, each with a "Buka" link that opens that page in a new tab because
// the user clicked it. Sulo never opens a tab by itself, never closes or
// touches one. Status follows the stored snapshots, so it updates as soon as
// data comes in (the dashboard re-reads storage).

import { useI18n } from '@/components/i18n';
import { Button } from '@/components/ui/button';
import { routeHash } from '@/lib/dashboard/routes';
import { formatAgo } from '@/lib/format/time';
import { neosiaWords } from '@/lib/i18n/neosia';
import { completion, sourceStatuses, type SourceId } from '@/lib/neosia/sources';
import type { Snapshots } from '@/lib/neosia/store';
import { CheckCircleIcon } from './icons';
import { Card, CardLink } from './Shell';

/** An empty circle: no data from this page yet. */
const EmptyCircle = ({ className = '' }: { className?: string }) => <span aria-hidden="true" className={`inline-block size-4 rounded-full border-2 border-muted-foreground ${className}`} />;

/**
 * - page: only while something is missing; `highlight` marks the page this
 *   screen needs most.
 * - settings: always, as the list of statuses.
 */
export function NeosiaChecklist({ snapshots, now, highlight, variant = 'page' }: { snapshots: Snapshots; now: number; highlight?: SourceId; variant?: 'page' | 'settings' }) {
  const { m, locale } = useI18n();
  const w = neosiaWords(locale).checklist;
  const statuses = sourceStatuses(snapshots);
  const { complete } = completion(statuses);
  if (variant === 'page' && complete) return null;
  const list = (
    <ul className="divide-y divide-border">
      {statuses.map(({ source, has, seenAt }) => {
        const s = w.sources[source.id];
        const marked = highlight === source.id && !has;
        return (
          <li key={source.id} className={`flex items-center gap-3 py-3 ${marked ? '-mx-3 rounded-lg bg-surface-raised px-3' : ''}`}>
            {has ? <CheckCircleIcon className="size-4 shrink-0 text-foreground" aria-label={w.has} role="img" aria-hidden={false} /> : <EmptyCircle className="shrink-0" />}
            {!has && <span className="sr-only">{w.missing}</span>}
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">{s.name}</p>
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
  if (variant === 'settings') return list;
  return (
    <Card title={w.title}>
      <p className="mb-1 max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{w.help}</p>
      {list}
    </Card>
  );
}

/** The overview's Studies card: one line, "Lengkapi data dari NEOSIA (2 dari 4)", to the settings. */
export function NeosiaChecklistLine({ snapshots }: { snapshots: Snapshots }) {
  const { locale } = useI18n();
  const w = neosiaWords(locale).checklist;
  const { done, total, complete } = completion(sourceStatuses(snapshots));
  if (complete) return null;
  return (
    <p className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-[12px] text-muted-foreground">
      <span>{w.count(done, total)}</span>
      <CardLink href={routeHash('pengaturan', 'neosia')}>{w.toSettings}</CardLink>
    </p>
  );
}

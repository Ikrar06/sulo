// NEOSIA parts of the overview (M7 part E): KRS readiness, the survey
// line and the short profile with the academic advisor. All data is NEOSIA
// page data validated twice; it is rendered as text only, never as HTML.

import { useState, type ComponentType, type SVGProps } from 'react';
import { useI18n } from '@/components/i18n';
import { Private, usePrivacy } from '@/components/private';
import { Button } from '@/components/ui/button';
import { formatDateKey } from '@/lib/calendar/countdown';
import { formatAgo } from '@/lib/format/time';
import { neosiaWords, type NeosiaWords } from '@/lib/i18n/neosia';
import { NEOSIA_APP_ORIGIN } from '@/lib/neosia/allowlist';
import { advisorName, profile, SKS_BAR_SCALE, type ItemState, type KrsWindow, type ReadinessItem } from '@/lib/neosia/view';
import type { Snapshots } from '@/lib/neosia/store';
import type { Messages } from '@/lib/i18n';
import { AlertCircleIcon, CheckCircleIcon, DashCircleIcon, InfoCircleIcon } from './icons';
import { Card } from './Shell';

const STATE_ICON: Record<ItemState, ComponentType<SVGProps<SVGSVGElement>>> = {
  ok: CheckCircleIcon,
  action: AlertCircleIcon,
  info: InfoCircleIcon,
  unknown: DashCircleIcon,
};
/** Line icons in status colors; no backgrounds, no colored edges. */
const STATE_CLASS: Record<ItemState, string> = {
  ok: 'text-foreground',
  action: 'text-urgency-soon',
  info: 'text-muted-foreground',
  unknown: 'text-muted-foreground',
};

const date = (key: string, m: Messages) => formatDateKey(key, m.intl, { day: 'numeric', month: 'long' });

function itemText(item: ReadinessItem, w: NeosiaWords, m: Messages) {
  const k = w.krs;
  switch (item.id) {
    case 'window':
      if (!item.window || !item.phase) return k.window.unknown;
      return item.phase === 'before' ? k.window.before(date(item.window.start, m), date(item.window.end, m)) : item.phase === 'open' ? k.window.open(date(item.window.end, m)) : k.window.closed(date(item.window.end, m));
    case 'payment':
      return item.paid === null ? k.unknownItem : item.paid ? k.payment.ok : k.payment.action;
    case 'pa':
      return item.name === null ? k.pa.unknown : (
        <>
          {w.profile.pa}: <Private>{item.name}</Private>
        </>
      );
    case 'survey':
      return item.filled === null ? k.unknownItem : item.filled ? k.survey.ok : k.survey.action;
    case 'sks':
      if (item.max === null) return k.unknownItem;
      return <Private>{k.sks(item.available, item.max)}</Private>;
    case 'krs':
      return item.status === null ? k.unknownItem : k.status[item.status];
  }
}

/** "Buka di NEOSIA" only where something needs doing. */
const needsLink = (item: ReadinessItem) => item.state === 'action';

export function KrsReadinessCard({ items, window, seenAt, now }: { items: ReadinessItem[]; window: KrsWindow | null; seenAt: number | null; now: number }) {
  const { m, locale } = useI18n();
  const w = neosiaWords(locale);
  return (
    <Card title={w.krs.title}>
      <ul className="space-y-2">
        {items.map((item) => {
          const Icon = STATE_ICON[item.state];
          return (
            <li key={item.id} className="flex items-start gap-2 text-[14px] leading-6">
              <Icon className={`mt-1 size-4 shrink-0 ${STATE_CLASS[item.state]}`} aria-label={w.krs.states[item.state]} role="img" aria-hidden={false} />
              <span className="min-w-0 flex-1">{itemText(item, w, m)}</span>
              {needsLink(item) && (
                <a href={NEOSIA_APP_ORIGIN} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded text-[14px] text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus">
                  {w.openInNeosia}
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {/* High-risk data: always the source, its time and where to confirm (project rule 16). */}
      <p className="mt-3 text-[12px] leading-normal text-muted-foreground">
        {window?.source === 'calendar' && seenAt === null ? w.krs.sourceCalendar : w.krs.source(seenAt === null ? '-' : formatAgo(seenAt, now, m))}
      </p>
    </Card>
  );
}

/** One status line (no box): the survey is not filled in, so the KHS stays locked. */
export function SurveyLine() {
  const { locale } = useI18n();
  const w = neosiaWords(locale);
  return (
    <p className="flex flex-wrap items-center gap-2 text-[14px]" role="status">
      <AlertCircleIcon className="size-4 shrink-0 text-urgency-soon" />
      <span>{w.survey.body}</span>
      <a href={NEOSIA_APP_ORIGIN} target="_blank" rel="noopener noreferrer" className="rounded text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus">
        {w.survey.link}
      </a>
    </p>
  );
}

/**
 * Semester, credits passed (a solid neutral bar), GPA behind "Tampilkan"
 * (not remembered: closing the page hides it again), and the advisor's name.
 * The greeting above it always uses the nickname from the settings.
 */
export function ProfileCard({ snapshots }: { snapshots: Snapshots }) {
  const { locale } = useI18n();
  const w = neosiaWords(locale).profile;
  const [shown, setShown] = useState(false);
  const masked = usePrivacy();
  const p = profile(snapshots);
  const pa = advisorName(snapshots);
  if (!p && !pa) return null;
  const fill = p?.sksPassed != null ? Math.min(100, Math.round((p.sksPassed / SKS_BAR_SCALE) * 100)) : null;
  const gpa = (v: number | null) => (v === null ? '-' : v.toFixed(2));
  return (
    <section className="w-full rounded-xl border border-border bg-surface p-4 sm:w-[280px]" aria-label="NEOSIA">
      {p?.semester != null && <p className="text-[14px] font-semibold">{w.semester(p.semester)}</p>}
      {p?.sksPassed != null && fill !== null && (
        <div className="mt-2">
          <p className="text-[12px] text-muted-foreground">
            <Private>{w.sksPassed(p.sksPassed)}</Private>
          </p>
          {/* Solid neutral bar, no gradient; empty in privacy mode (its length would tell the credits). */}
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-raised" role="img" aria-label={w.sksScale(SKS_BAR_SCALE)} title={w.sksScale(SKS_BAR_SCALE)}>
            {!masked && <div className="h-full rounded-full bg-muted-foreground" style={{ width: `${fill}%` }} />}
          </div>
        </div>
      )}
      {p && (p.ipk !== null || p.ips !== null) && (
        <div className="mt-3 flex items-center gap-3 text-[14px]">
          <span>
            {w.ipk} <span className="font-semibold tabular-nums">{shown ? <Private>{gpa(p.ipk)}</Private> : '•••'}</span>
          </span>
          <span>
            {w.ips} <span className="font-semibold tabular-nums">{shown ? <Private>{gpa(p.ips)}</Private> : '•••'}</span>
          </span>
          <Button size="sm" variant="ghost" className="ml-auto" aria-pressed={shown} onClick={() => setShown(!shown)}>
            {shown ? w.hide : w.show}
          </Button>
        </div>
      )}
      {pa && (
        <p className="mt-3 border-t border-border pt-3 text-[12px] text-muted-foreground">
          {w.pa}: <span className="text-foreground">
            <Private>{pa}</Private>
          </span>
        </p>
      )}
    </section>
  );
}

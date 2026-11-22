// NEOSIA parts of the overview (M7 part E): KRS readiness, the survey
// line and the short profile. All data is NEOSIA
// page data validated twice; it is rendered as text only, never as HTML.

import { useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { useI18n } from '../i18n';
import { Private, usePrivacy } from '../private';
import { Button } from '../ui/button';
import { formatDateKey } from '@sulo/core/calendar/countdown';
import { formatAgo } from '@sulo/core/format/time';
import { neosiaWords, type NeosiaWords } from '@sulo/core/i18n/neosia';
import { neosiaUrl } from '@sulo/core/links';
import { advisorName, profile, type ItemState, type KrsWindow, type ReadinessItem } from '@sulo/core/neosia/view';
import type { Snapshots } from '@sulo/core/neosia/store';
import type { Messages } from '@sulo/core/i18n';
import { AlertCircleIcon, CheckCircleIcon, DashCircleIcon, InfoCircleIcon, XIcon } from '../dashboard-icons';
import { Card, CardLink } from '../card';
import { routeHash } from '@sulo/core/dashboard/routes';
import { dashFor } from '@sulo/core/i18n/dashboard';
import type { LinkedMeeting } from '@sulo/core/neosia/linked';
import { completion, sourceStatuses } from '@sulo/core/neosia/sources';
import { NEOSIA_KHS, NEOSIA_KRS } from '@sulo/core/links';

export const STATE_ICON: Record<ItemState, ComponentType<SVGProps<SVGSVGElement>>> = {
  ok: CheckCircleIcon,
  action: AlertCircleIcon,
  info: InfoCircleIcon,
  unknown: DashCircleIcon,
};
/** Line icons in status colors; no backgrounds, no colored edges. */
export const STATE_CLASS: Record<ItemState, string> = {
  ok: 'text-foreground',
  action: 'text-urgency-soon',
  info: 'text-muted-foreground',
  unknown: 'text-muted-foreground',
};

const date = (key: string, m: Messages) => formatDateKey(key, m.intl, { day: 'numeric', month: 'long' });

/** A readiness item as text (dates formatted, credits and the advisor masked in privacy mode); shared with Android. */
export function itemText(item: ReadinessItem, w: NeosiaWords, m: Messages) {
  const k = w.krs;
  switch (item.id) {
    case 'window':
    {
      if (!item.window || !item.phase) return k.window.unknown;
      // NEOSIA's own caption ("Perubahan KRS"), shown as text only.
      const caption = item.window.caption ?? k.window.defaultCaption;
      return item.phase === 'before' ? k.window.before(caption, date(item.window.start, m), date(item.window.end, m)) : item.phase === 'open' ? k.window.open(caption, date(item.window.end, m)) : k.window.closed(caption, date(item.window.end, m));
    }
    case 'payment':
      return item.paid === null ? k.unknownItem : item.paid ? k.payment.ok : k.payment.action;
    case 'survey':
      return item.filled === null ? k.surveyUnchecked : item.filled ? k.survey.ok : k.survey.action;
    case 'sks':
      if (item.max === null) return k.sksMissing;
      return <Private>{k.sks(item.available, item.max)}</Private>;
    case 'krs':
      return item.status === null ? k.unknownItem : k.status[item.status];
    case 'advisor':
      return <Private>{k.advisor(item.name)}</Private>;
  }
}

/**
 * Where an item's link goes, if it has one: KRS where something needs doing
 * or the credit limit is missing; the KHS page (it brings the survey
 * status) while the survey is unchecked during the KRS window.
 */
export function readinessLink(item: ReadinessItem, windowOpen: boolean): { href: string; label: 'open' | 'surveyCheck' } | null {
  if (item.id === 'survey' && item.filled === null) return windowOpen ? { href: NEOSIA_KHS, label: 'surveyCheck' } : null;
  if (item.id === 'sks' && item.max === null) return { href: NEOSIA_KRS, label: 'open' };
  return item.state === 'action' ? { href: NEOSIA_KRS, label: 'open' } : null;
}

export function KrsReadinessCard({ items, window, seenAt, now }: { items: ReadinessItem[]; window: KrsWindow | null; seenAt: number | null; now: number }) {
  const { m, locale } = useI18n();
  const w = neosiaWords(locale);
  const windowOpen = items.some((i) => i.id === 'window' && i.phase === 'open');
  return (
    <Card title={w.krs.title}>
      <ul className="space-y-2">
        {items.map((item) => {
          const Icon = STATE_ICON[item.state];
          const link = readinessLink(item, windowOpen);
          return (
            <li key={item.id} className="flex items-start gap-2 text-[14px] leading-6">
              <Icon className={`mt-1 size-4 shrink-0 ${STATE_CLASS[item.state]}`} aria-label={w.krs.states[item.state]} role="img" aria-hidden={false} />
              <span className="min-w-0 flex-1">{itemText(item, w, m)}</span>
              {link && (
                <a href={link.href} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded text-[14px] text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus">
                  {link.label === 'surveyCheck' ? w.krs.surveyCheck : w.openInNeosia}
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
      <a href={neosiaUrl()} target="_blank" rel="noopener noreferrer" className="rounded text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus">
        {w.survey.link}
      </a>
    </p>
  );
}

/**
 * "Studi" (overview, right column under the academic calendar): semester
 * and credits passed of the target on a solid neutral bar, GPA behind
 * "Tampilkan" (not remembered), semester GPA only when NEOSIA has one.
 */
/** "Presensi rata-rata 96,9%", to the Presensi page (M7.3). From stored data only, no request. */
/** The Studi card's attendance: average, plus the lowest course when below it. */
export interface AttendanceSummary {
  average: number;
  lowest: { name: string; percent: number } | null;
}

/** Stand-ins for a value inside a dictionary sentence, so the value can be an element (a masked one in privacy mode). */
const PCT = '\u0001';
const NAME = '\u0002';
/** The sentence with each stand-in replaced by its element, in the sentence's own order. */
function withValues(sentence: string, values: Record<string, ReactNode>): ReactNode[] {
  const keys = Object.keys(values).sort((a, b) => b.length - a.length);
  const out: ReactNode[] = [];
  let rest = sentence;
  while (rest.length > 0) {
    const hit = keys.map((k) => ({ k, at: rest.indexOf(k) })).filter((x) => x.at >= 0).sort((a, b) => a.at - b.at)[0];
    if (!hit) {
      out.push(rest);
      break;
    }
    if (hit.at > 0) out.push(rest.slice(0, hit.at));
    out.push(<span key={out.length}>{values[hit.k]}</span>);
    rest = rest.slice(hit.at + hit.k.length);
  }
  return out;
}

function AttendanceLine({ summary }: { summary: AttendanceSummary | null }) {
  const { locale } = useI18n();
  if (summary === null) return null;
  const words = dashFor(locale).presensi;
  const pct = (n: number) => n.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 1 });
  // The sentences come whole from the dictionary; the percentages and the course name are masked in privacy mode, as on the phone.
  const percent = (n: number) => <Private>{pct(n)}%</Private>;
  return (
    <div className="mt-3 text-[14px]">
      <p className="flex items-center justify-between gap-2">
        <span>{withValues(words.average(PCT), { [`${PCT}%`]: percent(summary.average) })}</span>
        <CardLink href={routeHash('presensi')}>{dashFor(locale).nav.presensi}</CardLink>
      </p>
      {summary.lowest && (
        <p className="mt-1 truncate text-muted-foreground">
          {withValues(words.lowest(NAME, PCT), { [NAME]: <Private>{summary.lowest.name}</Private>, [`${PCT}%`]: percent(summary.lowest.percent) })}
        </p>
      )}
    </div>
  );
}

/**
 * Studies card. NEOSIA parts only while that module is on; the attendance
 * line whenever attendance data exists (it comes from SIKOLA).
 */
export function StudiCard({ snapshots, sksTarget, neosiaOn = true, attendance = null }: { snapshots: Snapshots; sksTarget: number; neosiaOn?: boolean; attendance?: AttendanceSummary | null }) {
  const { locale } = useI18n();
  const w = neosiaWords(locale).studi;
  if (!neosiaOn) {
    return attendance === null ? null : (
      <Card title={w.title}>
        <AttendanceLine summary={attendance} />
      </Card>
    );
  }
  return <NeosiaStudi snapshots={snapshots} sksTarget={sksTarget} attendance={attendance} />;
}

function NeosiaStudi({ snapshots, sksTarget, attendance }: { snapshots: Snapshots; sksTarget: number; attendance: AttendanceSummary | null }) {
  const { locale } = useI18n();
  const w = neosiaWords(locale).studi;
  const [shown, setShown] = useState(false);
  const masked = usePrivacy();
  const profileData = profile(snapshots);
  const advisor = advisorName(snapshots);
  const incomplete = !completion(sourceStatuses(snapshots)).complete;
  // Required pages missing: one line; the checklist itself is the overview card above.
  if (incomplete) {
    return (
      <Card title={w.title} action={<CardLink href={routeHash('nilai')}>{w.seeGrades}</CardLink>}>
        <p className="text-[14px] text-muted-foreground">{neosiaWords(locale).checklist.waiting}</p>
        <AttendanceLine summary={attendance} />
      </Card>
    );
  }
  if (!profileData) return null;
  const p = profileData ?? { semester: null, sksPassed: null, ipk: null, ips: null, masaStudi: null };
  const fill = p.sksPassed !== null ? Math.min(100, Math.round((p.sksPassed / sksTarget) * 100)) : null;
  const gpa = (v: number) => v.toFixed(2);
  return (
    <Card title={w.title} action={<CardLink href={routeHash('nilai')}>{w.seeGrades}</CardLink>}>
      {/* "Semester 8" in 14 px semibold, the credits muted. */}
      <p className="text-[14px]">
        {p.semester !== null && <span className="font-semibold">{`Semester ${p.semester}`}</span>}
        {p.sksPassed !== null && (
          <span className="text-muted-foreground">
            {p.semester !== null ? ' · ' : ''}
            <Private>{w.creditsOf(p.sksPassed, sksTarget)}</Private>
          </span>
        )}
      </p>
      {fill !== null && (
        // Solid neutral bar, no gradient; empty in privacy mode (its length would tell the credits).
        // Same as the teaching-week bar: 6 px, neutral track, fill in the main text color.
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised" role="img" aria-label={neosiaWords(locale).profile.sksScale(sksTarget)}>
          {!masked && <div className="h-full rounded-full bg-foreground" style={{ width: `${fill}%` }} />}
        </div>
      )}
      {p.ipk !== null && (
        <p className="mt-3 flex items-center gap-2 text-[14px]">
          <span>{w.ipk}</span>
          <span className="font-semibold tabular-nums">{shown ? <Private>{gpa(p.ipk)}</Private> : '••••'}</span>
          <span aria-hidden="true" className="text-muted-foreground">·</span>
          <button type="button" aria-pressed={shown} onClick={() => setShown(!shown)} className="rounded text-[14px] text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus">
            {shown ? w.hide : w.show}
          </button>
        </p>
      )}
      {/* No semester GPA yet: no row at all (never "-"). */}
      {p.ips !== null && (
        <p className="mt-1 flex items-center gap-2 text-[14px]">
          <span>{w.ips}</span>
          <span className="font-semibold tabular-nums">{shown ? <Private>{gpa(p.ips)}</Private> : '••••'}</span>
        </p>
      )}
      {/* The academic advisor (KRS page), masked in privacy mode. */}
      {advisor !== null && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          <Private>{w.advisor(advisor)}</Private>
        </p>
      )}
      <AttendanceLine summary={attendance} />
    </Card>
  );
}

/**
 * "Hubungkan NEOSIA" while the module is off: one thin full-width line under
 * the hero, no mascot (the hero has it). "Nanti saja" hides it for 30 days.
 */
export function NeosiaInvite({ onConnect, onLater }: { onConnect: () => void; onLater: () => void }) {
  const { locale } = useI18n();
  const w = neosiaWords(locale).invite;
  return (
    <section className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3" aria-label="NEOSIA">
      <InfoCircleIcon className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 text-[14px]">{w.text}</p>
      <Button variant="outline" onClick={onConnect}>
        {w.connect}
      </Button>
      <Button variant="ghost" size="icon" aria-label={w.later} title={w.later} onClick={onLater}>
        <XIcon className="size-4" />
      </Button>
    </section>
  );
}

/** "Kuliah berikutnya: Rab, 25 Nov · 07.50 · Magang", when nothing is left today (holidays skipped). */
export function NextClassLine({ next }: { next: { meeting: LinkedMeeting; day: string } }) {
  const { m, locale } = useI18n();
  const w = neosiaWords(locale).today;
  const c = next.meeting;
  const day = formatDateKey(next.day, m.intl, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = locale === 'id' ? c.start.replace(':', '.') : c.start;
  return (
    <p className="flex items-center gap-2 text-[14px]">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: c.color === null ? 'var(--muted)' : `var(--course-${c.color})` }} />
      <span className="min-w-0 truncate">
        <span className="text-muted-foreground">{w.next}: </span>
        {day} · <span className="tabular-nums">{time}</span> · <span className="font-semibold">{c.displayName}</span>
      </span>
    </p>
  );
}

/** "Kuliah hari ini": time, course and room, before the task groups. */
export function TodayClasses({ classes }: { classes: readonly LinkedMeeting[] }) {
  const { locale } = useI18n();
  const w = neosiaWords(locale).today;
  const clock = (hhmm: string) => (locale === 'id' ? hhmm.replace(':', '.') : hhmm);
  return (
    <section aria-label={w.title}>
      <h3 className="mb-1 text-[12px] font-semibold text-muted-foreground">{w.title}</h3>
      <ul>
        {classes.map((c, i) => (
          <li key={`${c.key}-${c.start}-${i}`} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2">
            <span className="w-24 shrink-0 pt-px text-[12px] leading-5 text-muted-foreground tabular-nums">
              {clock(c.start)}–{clock(c.end)}
            </span>
            <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full" style={{ background: c.color === null ? 'var(--muted)' : `var(--course-${c.color})` }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">
                {c.displayName}
                {c.classLabel ? ` ${c.classLabel}` : ''}
              </span>
              {c.room && <span className="block truncate text-[12px] text-muted-foreground">{c.room}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

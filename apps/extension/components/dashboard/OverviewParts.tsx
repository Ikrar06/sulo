import { neosiaWords } from '@sulo/core/i18n/neosia';
import { Fragment } from 'react';
import { useI18n } from '@sulo/ui/i18n';
import { countdownOf, formatDateKey } from '@sulo/core/calendar/countdown';
import type { CalendarFile } from '@sulo/core/calendar/schema';
import { nextImportant, SHORT_LABEL_KATEGORI } from '@sulo/core/calendar/upcoming';
import type { SummaryCountdown, SummaryPart } from '@sulo/core/dashboard/overview';
import type { DashMessages } from '@sulo/core/i18n/dashboard';
import { useRange, WeekLine } from './CalendarParts';

export function nextForSummary(calendar: CalendarFile, today: string, d: DashMessages): { label: string; countdown: SummaryCountdown } | null {
  const next = nextImportant(calendar, today);
  if (!next) return null;
  const k = next.kegiatan;
  const label = SHORT_LABEL_KATEGORI.has(k.kategori) ? d.kalender.kategori[k.kategori] : k.judul;
  const c = countdownOf(k, today);
  const countdown: SummaryCountdown = c.kind === 'days' ? c : c.kind === 'today' || c.kind === 'tomorrow' ? c : { kind: 'ongoing' };
  return { label, countdown };
}

/** "1 tugas terlambat · 0 tenggat minggu ini · UAS mulai 14 hari lagi": late in warning color, countdown in accent, the rest muted. */
export function SummaryLine({ parts, d }: { parts: SummaryPart[]; d: DashMessages }) {
  const s = d.ringkasan.summary;
  const { locale } = useI18n();
  const piece = (p: SummaryPart) => {
    if (p.kind === 'overdue') {
      const [a, b] = s.overdue(p.n);
      return (
        <span className="text-urgency-overdue">
          {a}
          <span className="font-semibold tabular-nums">{p.n}</span>
          {b}
        </span>
      );
    }
    if (p.kind === 'none') return <span>{s.none}</span>;
    if (p.kind === 'classes') return <span>{neosiaWords(locale).today.summary(p.n)}</span>;
    if (p.kind === 'week') {
      const [a, b] = s.week(p.n);
      return (
        <span>
          {a}
          <span className="tabular-nums">{p.n}</span>
          {b}
        </span>
      );
    }
    const c = p.countdown;
    if (c.kind === 'days') {
      const [a, b] = s.days(p.label, c.n);
      return (
        <span>
          {a}
          <span className="db-accent-text font-semibold tabular-nums">{c.n}</span>
          {b}
        </span>
      );
    }
    return <span>{c.kind === 'today' ? s.today(p.label) : c.kind === 'tomorrow' ? s.tomorrow(p.label) : s.ongoing(p.label)}</span>;
  };
  return (
    <p className="text-[14px] leading-normal text-muted-foreground">
      {parts.map((p, i) => (
        <Fragment key={p.kind}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          {piece(p)}
        </Fragment>
      ))}
    </p>
  );
}

/** "Berikutnya": the countdown (number in accent, unit in text color), the event and its dates; then the teaching week. */
export function AcademicCard({ calendar, today, d }: { calendar: CalendarFile; today: string; d: DashMessages }) {
  const { m } = useI18n();
  const r = d.ringkasan;
  const k = d.kalender;
  const next = nextImportant(calendar, today);
  const range = useRange(d);
  const c = next ? countdownOf(next.kegiatan, today) : null;
  return (
    <div className="flex h-full flex-col gap-4">
      {next && c ? (
        <div>
          <p className="text-[12px] text-muted-foreground">{r.nextLabel}</p>
          <p className="mt-1 leading-8">
            {c.kind === 'days' ? (
              <>
                <span className="db-accent-text font-heading text-[24px] font-semibold tabular-nums">{c.n}</span> <span className="text-[16px]">{r.daysUnit(c.n)}</span>
              </>
            ) : (
              <span className="text-[16px] font-semibold">
                {c.kind === 'today'
                  ? k.countdown.today
                  : c.kind === 'tomorrow'
                    ? k.countdown.tomorrow
                    : c.kind === 'ongoing'
                      ? k.countdown.ongoing(formatDateKey(c.until, m.intl, { day: 'numeric', month: 'long' }))
                      : k.countdown.ongoingOpen}
              </span>
            )}
          </p>
          <p className="mt-1 text-[14px] font-semibold">{next.kegiatan.judul}</p>
          <p className="text-[12px] text-muted-foreground">{range(next.kegiatan)}</p>
        </div>
      ) : (
        <p className="text-[14px] text-muted-foreground">{k.nothing}</p>
      )}
      <div className="mt-auto border-t border-border pt-3">
        <WeekLine calendar={calendar} today={today} d={d} />
      </div>
    </div>
  );
}

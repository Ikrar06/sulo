import { useI18n } from '@/components/i18n';
import { ExternalIcon } from '@/components/icons';
import { countdownOf, formatDateKey, formatRange } from '@/lib/calendar/countdown';
import { currentWeek } from '@/lib/calendar/current-week';
import type { CalendarFile, Kegiatan } from '@/lib/calendar/schema';
import { nextImportant } from '@/lib/calendar/upcoming';
import type { DashMessages } from '@/lib/i18n/dashboard';

// Calendar pieces shared by Ringkasan and Kalender. Every view of calendar
// data says where it comes from and that the official document prevails.
// Scale: 24 px for the big number, 16 card titles, 14 body, 12 captions.

export function useRange(d: DashMessages) {
  const { m } = useI18n();
  return (e: { mulai: string; selesai: string | null }) => formatRange(e, m.intl, d.kalender.to, d.kalender.badge.ujungTerbuka.toLowerCase());
}

export function CountdownText({ event, today, d }: { event: Pick<Kegiatan, 'mulai' | 'selesai'>; today: string; d: DashMessages }) {
  const { m } = useI18n();
  const c = countdownOf(event, today);
  const k = d.kalender.countdown;
  switch (c.kind) {
    case 'today':
      return <>{k.today}</>;
    case 'tomorrow':
      return <>{k.tomorrow}</>;
    case 'days':
      return <>{k.days(c.n)}</>;
    case 'ongoing':
      return <>{k.ongoing(formatDateKey(c.until, m.intl, { day: 'numeric', month: 'long' }))}</>;
    case 'ongoingOpen':
      return <>{k.ongoingOpen}</>;
  }
}

/** "Tanggal penting terdekat": the countdown as the card's big number. */
export function ImportantCard({ calendar, today, d }: { calendar: CalendarFile; today: string; d: DashMessages }) {
  const next = nextImportant(calendar, today);
  const range = useRange(d);
  if (!next) return <p className="text-[14px] text-muted-foreground">{d.kalender.nothing}</p>;
  return (
    <div>
      <p className="font-heading text-[24px] leading-8 tabular-nums">
        <CountdownText event={next.kegiatan} today={today} d={d} />
      </p>
      <p className="mt-1 text-[14px] font-semibold">{next.kegiatan.judul}</p>
      <p className="text-[12px] text-muted-foreground">{range(next.kegiatan)}</p>
    </div>
  );
}

/**
 * "Minggu ke-X dari Y" with a thin solid bar, from the week list in the
 * calendar data. Outside the lecture period, or while the weeks are not
 * known, the nearest agenda is shown instead.
 */
export function WeekProgress({ calendar, today, d }: { calendar: CalendarFile; today: string; d: DashMessages }) {
  const { m } = useI18n();
  const { semester, info } = currentWeek(calendar, today);
  const w = d.kalender.week;
  const range = useRange(d);
  const semesterLabel = semester ? w.semester[semester] : null;

  if (info.kind === 'week') {
    const percent = Math.round((info.nomor / info.total) * 100);
    return (
      <div>
        {semesterLabel && <p className="text-[12px] text-muted-foreground">{semesterLabel}</p>}
        <p className="text-[16px] leading-6 font-semibold">
          {w.n(info.nomor, info.total)}
          {info.uts ? <span className="font-normal text-muted-foreground">, {w.uts}</span> : info.uas ? <span className="font-normal text-muted-foreground">, {w.uas}</span> : null}
        </p>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={info.total}
          aria-valuenow={info.nomor}
          aria-label={w.n(info.nomor, info.total)}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised"
        >
          <div className="h-full rounded-full bg-foreground" style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  }

  // Not inside a numbered week: say why, then the nearest agenda.
  const next = nextImportant(calendar, today);
  const reason =
    info.kind === 'unavailable'
      ? w.unavailable
      : info.kind === 'before'
        ? w.before(formatDateKey(info.startsOn, m.intl, { day: 'numeric', month: 'long' }))
        : info.kind === 'excluded'
          ? w.excluded(info.alasan)
          : w.after;
  return (
    <div>
      {semesterLabel && <p className="text-[12px] text-muted-foreground">{semesterLabel}</p>}
      <p className="text-[16px] leading-6 font-semibold">{reason}</p>
      {info.kind === 'unavailable' && <p className="text-[12px] text-muted-foreground">{w.unavailableHelp}</p>}
      {next && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[12px] text-muted-foreground">{w.nextAgenda}</p>
          <p className="text-[14px] font-semibold">{next.kegiatan.judul}</p>
          <p className="text-[12px] text-muted-foreground">
            {range(next.kegiatan)}, <CountdownText event={next.kegiatan} today={today} d={d} />
          </p>
        </div>
      )}
    </div>
  );
}

/** Source, revision, verification date, the official PDF and "rujuk dokumen resmi". */
export function SourceLine({ calendar, d }: { calendar: CalendarFile; d: DashMessages }) {
  const { m } = useI18n();
  const k = d.kalender;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-normal text-muted-foreground">
      <span>{k.source(calendar.sumber.sk, calendar.revisi, formatDateKey(calendar.diverifikasi_pada, m.intl, { day: 'numeric', month: 'long', year: 'numeric' }))}</span>
      <a className="inline-flex items-center gap-1 rounded underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus" href={calendar.sumber.pdf_url} target="_blank" rel="noopener noreferrer">
        {k.officialPdf}
        <ExternalIcon className="size-3" />
      </a>
      <span>{k.refer}</span>
    </p>
  );
}

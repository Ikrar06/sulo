import { useI18n } from '@/components/i18n';
import { ExternalIcon } from '@/components/icons';
import { countdownOf, formatDateKey, formatRange } from '@/lib/calendar/countdown';
import { currentWeek } from '@/lib/calendar/current-week';
import type { CalendarFile, Kegiatan } from '@/lib/calendar/schema';
import { nextImportant } from '@/lib/calendar/upcoming';
import type { DashMessages } from '@/lib/i18n/dashboard';
import { routeHash } from '@/lib/dashboard/routes';

// Calendar pieces shared by Ringkasan and Kalender. Every view of calendar
// data says where it comes from and that the official document prevails.

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

/** "Tanggal penting terdekat" with its countdown (Ringkasan). */
export function ImportantCard({ calendar, today, d }: { calendar: CalendarFile; today: string; d: DashMessages }) {
  const next = nextImportant(calendar, today);
  const range = useRange(d);
  const k = d.kalender;
  return (
    <div>
      {next ? (
        <>
          <p className="font-heading text-[22px] leading-7 tabular-nums">
            <CountdownText event={next.kegiatan} today={today} d={d} />
          </p>
          <p className="mt-1 text-[14.5px] font-medium">{next.kegiatan.judul}</p>
          <p className="text-[13px] text-muted-foreground">{range(next.kegiatan)}</p>
        </>
      ) : (
        <p className="text-[14px] text-muted-foreground">{k.nothing}</p>
      )}
    </div>
  );
}

/** "Pekan 14 dari 16", or why there is no number. */
export function WeekText({ calendar, today, d }: { calendar: CalendarFile; today: string; d: DashMessages }) {
  const { m } = useI18n();
  const { semester, info } = currentWeek(calendar, today);
  const w = d.kalender.week;
  const label = semester ? `${w.semester[semester]}: ` : '';
  switch (info.kind) {
    case 'week':
      return (
        <p className="text-[14px]">
          <span className="font-semibold">{label}{w.n(info.nomor, info.total)}</span>
          {info.uts ? `, ${w.uts}` : info.uas ? `, ${w.uas}` : ''}
        </p>
      );
    case 'unavailable':
      return (
        <p className="text-[14px]">
          <span className="font-semibold">{label}{w.unavailable}</span>
          <span className="block text-[12.5px] text-muted-foreground">{w.unavailableHelp}</span>
        </p>
      );
    case 'before':
      return <p className="text-[14px]">{label}{w.before(formatDateKey(info.startsOn, m.intl, { day: 'numeric', month: 'long' }))}</p>;
    case 'excluded':
      return <p className="text-[14px]">{label}{w.excluded(info.alasan)}</p>;
    case 'after':
      return <p className="text-[14px] text-muted-foreground">{w.after}</p>;
  }
}

/** Source, revision, verification date, the official PDF and "rujuk dokumen resmi". */
export function SourceLine({ calendar, d }: { calendar: CalendarFile; d: DashMessages }) {
  const { m } = useI18n();
  const k = d.kalender;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] leading-[18px] text-muted-foreground">
      <span>{k.source(calendar.sumber.sk, calendar.revisi, formatDateKey(calendar.diverifikasi_pada, m.intl, { day: 'numeric', month: 'long', year: 'numeric' }))}</span>
      <a className="inline-flex items-center gap-1 rounded underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus" href={calendar.sumber.pdf_url} target="_blank" rel="noopener noreferrer">
        {k.officialPdf}
        <ExternalIcon className="size-3" />
      </a>
      <span>{k.refer}</span>
    </p>
  );
}

export const calendarLink = routeHash('kalender');

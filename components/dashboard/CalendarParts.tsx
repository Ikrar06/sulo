import { useI18n } from '@/components/i18n';
import { BellIcon, ExternalIcon } from '@/components/icons';
import { countdownOf, formatDateKey, formatRange } from '@/lib/calendar/countdown';
import { currentWeek } from '@/lib/calendar/current-week';
import type { CalendarFile } from '@/lib/calendar/schema';
import { nextImportant, SHORT_LABEL_KATEGORI } from '@/lib/calendar/upcoming';
import { routeHash } from '@/lib/dashboard/routes';
import type { DashMessages } from '@/lib/i18n/dashboard';

// Calendar pieces shared by Ringkasan and Kalender. The source of the data
// is named once, at the foot of the Kalender page.

export function useRange(d: DashMessages) {
  const { m } = useI18n();
  return (e: { mulai: string; selesai: string | null }) => formatRange(e, m.intl, d.kalender.to, d.kalender.badge.ujungTerbuka.toLowerCase());
}

/** "Semester Awal · Minggu ke-14 dari 16" or why there is no numbered week. */
function useWeekText(calendar: CalendarFile, today: string, d: DashMessages) {
  const { m } = useI18n();
  const { semester, info } = currentWeek(calendar, today);
  const w = d.kalender.week;
  const text =
    info.kind === 'week'
      ? w.n(info.nomor, info.total)
      : info.kind === 'unavailable'
        ? w.unavailable
        : info.kind === 'before'
          ? w.before(formatDateKey(info.startsOn, m.intl, { day: 'numeric', month: 'long' }))
          : info.kind === 'excluded'
            ? w.excluded(info.alasan)
            : w.after;
  return { info, text, semesterLabel: semester ? w.semester[semester] : null };
}

/** The teaching week as one 12 px line and a 6 px bar (neutral track, text-colored fill). */
export function WeekLine({ calendar, today, d }: { calendar: CalendarFile; today: string; d: DashMessages }) {
  const { info, text, semesterLabel } = useWeekText(calendar, today, d);
  return (
    <div>
      <p className="text-[12px] leading-normal">{[semesterLabel, text].filter(Boolean).join(' · ')}</p>
      {info.kind === 'week' && <WeekBar nomor={info.nomor} total={info.total} label={text} className="mt-2 w-full" />}
    </div>
  );
}

export function WeekBar({ nomor, total, label, className = '' }: { nomor: number; total: number; label: string; className?: string }) {
  return (
    <div role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={nomor} aria-label={label} className={`h-1.5 overflow-hidden rounded-full bg-surface-raised ${className}`}>
      <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.round((nomor / total) * 100)}%` }} />
    </div>
  );
}

/**
 * Kalender's one-line strip: the week with a 120 px bar, then the next
 * important date ("UAS dalam 14 hari · 30 Nov sampai 5 Des", the number in
 * accent), and a bell to the calendar notification settings.
 */
export function CalendarStrip({ calendar, today, d }: { calendar: CalendarFile; today: string; d: DashMessages }) {
  const k = d.kalender;
  const { info, text } = useWeekText(calendar, today, d);
  const next = nextImportant(calendar, today);
  const range = useRange(d);
  const c = next ? countdownOf(next.kegiatan, today) : null;
  const label = next ? (SHORT_LABEL_KATEGORI.has(next.kegiatan.kategori) ? k.kategori[next.kegiatan.kategori] : next.kegiatan.judul) : '';
  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-5 py-3">
      <span className="text-[14px] font-semibold">{text}</span>
      {info.kind === 'week' && <WeekBar nomor={info.nomor} total={info.total} label={text} className="w-[120px]" />}
      {next && c && (
        <>
          <span aria-hidden="true" className="h-4 w-px bg-border" />
          <span className="min-w-0 text-[14px]">
            {c.kind === 'days' ? (
              <>
                {k.examIn(label, c.n)[0]}
                <span className="db-accent-text font-semibold tabular-nums">{c.n}</span>
                {k.examIn(label, c.n)[1]}
              </>
            ) : (
              `${label}: ${c.kind === 'today' ? k.countdown.today : c.kind === 'tomorrow' ? k.countdown.tomorrow : k.countdown.ongoingOpen}`
            )}
            <span className="text-muted-foreground"> · {range(next.kegiatan)}</span>
          </span>
        </>
      )}
      <a
        href={routeHash('pengaturan', 'kalender')}
        aria-label={k.notifyAria}
        title={k.notifyAria}
        className="ml-auto inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-surface-raised hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus"
      >
        <BellIcon className="size-4" />
      </a>
    </section>
  );
}

/** The one place that names the source: decree, revision and check date from the data, the official PDF, and that Sulo is unofficial. */
export function SourceFooter({ calendar, d }: { calendar: CalendarFile; d: DashMessages }) {
  const { m } = useI18n();
  const k = d.kalender;
  return (
    <p className="text-[12px] leading-normal text-muted-foreground">
      {k.source(calendar.sumber.sk, calendar.revisi, formatDateKey(calendar.diverifikasi_pada, m.intl, { day: 'numeric', month: 'short', year: 'numeric' }))}
      <span aria-hidden="true"> · </span>
      <a className="inline-flex items-center gap-1 rounded underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus" href={calendar.sumber.pdf_url} target="_blank" rel="noopener noreferrer">
        {k.officialPdf}
        <ExternalIcon className="size-3" />
      </a>
      <span aria-hidden="true"> · </span>
      {k.refer}
    </p>
  );
}

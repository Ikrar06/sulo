import { useI18n } from '@/components/i18n';
import { formatDateKey } from '@/lib/calendar/countdown';
import { groupByMonth, visibleKegiatan, type CalendarFilter } from '@/lib/calendar/month';
import type { CalendarFile } from '@/lib/calendar/schema';
import type { DashMessages } from '@/lib/i18n/dashboard';
import { EventInfo, HolidayInfo } from './EventInfo';

/** Every academic event (estimates included) and holiday, month by month. */
export function ListView({ calendar, filter, today, angkatan, d }: { calendar: CalendarFile; filter: CalendarFilter; today: string; angkatan: number | null; d: DashMessages }) {
  const { m } = useI18n();
  const events = visibleKegiatan(calendar, filter);
  const holidays = filter.holidays && filter.kategori === null ? calendar.libur_nasional : [];
  const months = groupByMonth(events);
  const holidayMonths = new Set(holidays.map((h) => h.mulai.slice(0, 7)));
  const allMonths = [...new Set([...months.map((g) => g.month), ...holidayMonths])].sort();
  if (allMonths.length === 0) return <p className="text-[14px] text-muted-foreground">{d.kalender.emptyList}</p>;

  return (
    <div className="space-y-5">
      {allMonths.map((month) => {
        const list = months.find((g) => g.month === month)?.events ?? [];
        const offs = holidays.filter((h) => h.mulai.slice(0, 7) === month);
        const past = month < today.slice(0, 7);
        return (
          <section key={month} className={`rounded-xl border border-border bg-surface p-4 ${past ? 'opacity-70' : ''}`}>
            <h3 className="mb-3 font-heading text-[16px]">{formatDateKey(`${month}-01`, m.intl, { month: 'long', year: 'numeric' })}</h3>
            <ul className="space-y-4">
              {offs.map((l) => (
                <li key={l.id}>
                  <HolidayInfo l={l} d={d} />
                </li>
              ))}
              {list.map((k) => (
                <li key={k.id}>
                  <EventInfo k={k} d={d} angkatan={angkatan} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

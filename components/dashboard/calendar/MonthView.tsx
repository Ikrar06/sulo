import { useI18n } from '@/components/i18n';
import { formatDateKey } from '@/lib/calendar/countdown';
import { itemsOnDay, monthGrid, type CalendarFilter, type CalendarItem } from '@/lib/calendar/month';
import type { CalendarFile } from '@/lib/calendar/schema';
import { routeHash } from '@/lib/dashboard/routes';
import type { DashMessages } from '@/lib/i18n/dashboard';
import { EventInfo, HolidayInfo } from './EventInfo';

type TaskItem = Extract<CalendarItem, { type: 'tugas' }>;

const MAX_IN_CELL = 3;

/**
 * Three kinds that must never be confused, told apart by shape and label,
 * not by color alone: academic events are filled chips, task deadlines are
 * outlined chips with the course dot, national holidays are filled chips
 * with a red tint and the word in their tooltip.
 */
function Chip({ item, d }: { item: CalendarItem; d: DashMessages }) {
  const base = 'block truncate rounded px-1.5 text-[11.5px] leading-[18px]';
  if (item.type === 'tugas') {
    return (
      <span className={`${base} border border-border`} title={`${d.kalender.tasks}: ${item.name}`}>
        <span aria-hidden="true" className="mr-1 inline-block size-1.5 rounded-full align-middle" style={{ background: `var(--course-${item.courseColor})` }} />
        {item.name}
      </span>
    );
  }
  if (item.type === 'libur') {
    return (
      <span className={`${base} bg-[color-mix(in_oklch,var(--danger)_16%,var(--surface))]`} title={`${d.kalender.holiday}: ${item.libur.nama}`}>
        {item.libur.nama}
      </span>
    );
  }
  const k = item.kegiatan;
  const exam = k.kategori === 'uts' || k.kategori === 'uas';
  return (
    <span className={`${base} ${exam ? 'bg-[color-mix(in_oklch,var(--brand-amber)_28%,var(--surface))] font-medium' : 'bg-surface-raised'}`} title={`${d.kalender.academic}: ${k.judul}`}>
      {k.judul}
    </span>
  );
}

export interface MonthViewProps {
  month: string;
  today: string;
  calendar: CalendarFile;
  filter: CalendarFilter;
  tasks: readonly TaskItem[];
  selected: string;
  onSelect: (day: string) => void;
  angkatan: number | null;
  d: DashMessages;
}

export function MonthView({ month, today, calendar, filter, tasks, selected, onSelect, angkatan, d }: MonthViewProps) {
  const { m } = useI18n();
  const weeks = monthGrid(month);
  const dayItems = (day: string) => itemsOnDay(day, calendar, filter, tasks);
  const selectedItems = dayItems(selected);
  const weekdayNames = weeks[0]!.map((day) => formatDateKey(day, m.intl, { weekday: 'short' }));

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-px pb-1 text-center text-[12px] text-muted-foreground" aria-hidden="true">
            {weekdayNames.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <ol className="grid grid-cols-7 gap-1">
            {weeks.flat().map((day) => {
              const items = dayItems(day);
              const outside = day.slice(0, 7) !== month;
              const isToday = day === today;
              const isSelected = day === selected;
              const label = `${formatDateKey(day, m.intl, { weekday: 'long', day: 'numeric', month: 'long' })}: ${items.length}`;
              return (
                <li key={day}>
                  <button
                    type="button"
                    onClick={() => onSelect(day)}
                    aria-pressed={isSelected}
                    aria-label={label}
                    className={`flex h-[104px] w-full flex-col gap-0.5 rounded-lg border p-1.5 text-left outline-none focus-ring:ring-2 focus-ring:ring-focus ${
                      isSelected ? 'border-foreground/50' : 'border-border hover:border-foreground/25'
                    } ${outside ? 'bg-transparent opacity-55' : 'bg-surface'}`}
                  >
                    <span className={`text-[12.5px] tabular-nums ${isToday ? 'inline-flex size-5 items-center justify-center rounded-full bg-foreground font-semibold text-background' : ''}`}>
                      {Number(day.slice(8))}
                    </span>
                    {items.slice(0, MAX_IN_CELL).map((item, i) => (
                      <Chip key={i} item={item} d={d} />
                    ))}
                    {items.length > MAX_IN_CELL && <span className="px-1 text-[11px] text-muted-foreground">{d.kalender.more(items.length - MAX_IN_CELL)}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <section aria-live="polite" className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-[14px] font-semibold">{formatDateKey(selected, m.intl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
        {selectedItems.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">{d.kalender.emptyList}</p>
        ) : (
          <ul className="space-y-4">
            {selectedItems.map((item, i) => (
              <li key={i}>
                {item.type === 'kegiatan' ? (
                  <EventInfo k={item.kegiatan} d={d} angkatan={angkatan} />
                ) : item.type === 'libur' ? (
                  <HolidayInfo l={item.libur} d={d} />
                ) : (
                  <a href={routeHash('tugas', item.eventId)} className="flex items-center gap-2 rounded-md text-[14px] outline-none hover:underline focus-ring:ring-2 focus-ring:ring-focus">
                    <span aria-hidden="true" className="size-2 rounded-full" style={{ background: `var(--course-${item.courseColor})` }} />
                    <span className="font-medium">{item.name}</span>
                    <span className="text-[12.5px] text-muted-foreground">{d.kalender.taskDue(item.courseName)}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

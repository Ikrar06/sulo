import { useMemo, type KeyboardEvent } from 'react';
import { useI18n } from '@/components/i18n';
import { formatDateKey } from '@/lib/calendar/countdown';
import { addDays } from '@/lib/calendar/dates';
import { eventsOnDay, type CalEvent } from '@/lib/calendar/groups';
import { monthGrid } from '@/lib/calendar/month';
import { layoutWeek, periodAt, type WeekBar } from '@/lib/calendar/week-layout';
import type { DashMessages } from '@/lib/i18n/dashboard';

/**
 * One month as one grid with 1 px lines (radius only on the outer corners).
 * Each week row has two layers: the day cells (buttons, with the date, a
 * status-period tint and label, and "+n lagi") and the event bars laid out
 * by layoutWeek(). Arrow keys move the selected day; bars are decoration for
 * the cell buttons, which carry the accessible names.
 */
export function MonthView({ month, today, events, holidays, selected, onSelect, d }: {
  month: string;
  today: string;
  events: readonly CalEvent[];
  holidays: ReadonlySet<string>;
  selected: string;
  /** `keyboard` is true when an arrow key moved the selection (the page may switch months). */
  onSelect: (day: string, keyboard: boolean) => void;
  d: DashMessages;
}) {
  const { m } = useI18n();
  const weeks = monthGrid(month);
  const layouts = useMemo(() => weeks.map((w) => layoutWeek(events, w[0]!)), [weeks, events]);
  const weekdays = weeks[0]!.map((day) => formatDateKey(day, m.intl, { weekday: 'short' }));

  const move = (e: KeyboardEvent<HTMLButtonElement>, day: string) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(e.key in step)) return;
    e.preventDefault();
    const next = addDays(day, step[e.key]!);
    onSelect(next, true);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus());
  };

  return (
    <div>
      <div className="grid grid-cols-7 pb-2 text-center text-[12px] text-muted-foreground" aria-hidden="true">
        {weekdays.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
        {weeks.map((week, wi) => {
          const layout = layouts[wi]!;
          return (
            <div key={week[0]} className="relative grid min-h-28 grid-cols-7 gap-px">
              {week.map((day, col) => {
                const inMonth = day.slice(0, 7) === month;
                const period = periodAt(layout, col);
                const periodStarts = period !== null && period.startCol === col;
                const count = eventsOnDay(events, day).length;
                const hidden = layout.hidden[col]!;
                const label = d.kalender.selectDay(formatDateKey(day, m.intl, { weekday: 'long', day: 'numeric', month: 'long' }), count);
                return (
                  <button
                    key={day}
                    type="button"
                    data-day={day}
                    tabIndex={day === selected ? 0 : -1}
                    aria-pressed={day === selected}
                    aria-current={day === today ? 'date' : undefined}
                    aria-label={label}
                    onClick={() => onSelect(day, false)}
                    onKeyDown={(e) => move(e, day)}
                    className={`relative flex min-w-0 flex-col items-start p-1 text-left outline-none focus-ring:z-10 focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-inset ${
                      day === selected ? 'bg-surface-raised' : period ? `db-cat-${period.event.group} db-cat-period` : 'bg-surface'
                    } hover:bg-surface-raised`}
                  >
                    <span className="flex w-full min-w-0 items-center gap-1">
                      <DayNumber day={day} today={day === today} inMonth={inMonth} holiday={holidays.has(day)} />
                      {periodStarts && (
                        <span className="truncate text-[12px] text-muted-foreground" title={period.event.title}>
                          {period.event.source.type === 'kegiatan' ? d.kalender.kategori[period.event.source.kegiatan.kategori] : period.event.title}
                        </span>
                      )}
                    </span>
                    {hidden > 0 && <span className="absolute bottom-1 left-2 text-[12px] leading-4 font-semibold text-muted-foreground">{d.kalender.more(hidden)}</span>}
                  </button>
                );
              })}
              {/* Bars: an overlay grid under the date row, three 20 px lanes. Clicks select the segment's first day. */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-7 grid grid-cols-7 gap-x-px gap-y-1" style={{ gridAutoRows: '20px' }}>
                {layout.bars.map((bar) => (
                  <Bar key={`${bar.event.id}-${week[0]}`} bar={bar} onClick={() => onSelect(week[bar.startCol]!, false)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayNumber({ day, today, inMonth, holiday }: { day: string; today: boolean; inMonth: boolean; holiday: boolean }) {
  const n = Number(day.slice(8));
  if (today) return <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-orange text-[12px] font-semibold text-ink tabular-nums">{n}</span>;
  // Outside the month only the number is dimmed; the events keep full contrast.
  const tone = !inMonth ? 'text-muted-foreground' : holiday ? 'db-holiday-number font-semibold' : '';
  return <span className={`flex size-6 shrink-0 items-center justify-center text-[12px] tabular-nums ${tone}`}>{n}</span>;
}

function Bar({ bar, onClick }: { bar: WeekBar; onClick: () => void }) {
  const e = bar.event;
  const ends = `${bar.continuesBefore ? '' : 'ml-1 rounded-l-md'} ${bar.continuesAfter ? '' : 'mr-1 rounded-r-md'}`;
  return (
    <div
      onClick={onClick}
      title={e.title}
      style={{ gridColumn: `${bar.startCol + 1} / span ${bar.span}`, gridRow: bar.lane + 1 }}
      className={`db-cat-${e.group} db-cat-bar pointer-events-auto flex min-w-0 cursor-pointer items-center gap-1 px-2 text-[12px] leading-5 ${ends}`}
    >
      {e.source.type === 'tugas' && <span className="size-2 shrink-0 rounded-full" style={{ background: `var(--course-${e.source.courseColor})` }} />}
      <span className="truncate">{e.title}</span>
    </div>
  );
}

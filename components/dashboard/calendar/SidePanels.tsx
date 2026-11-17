import { useI18n } from '@/components/i18n';
import { formatDateKey, formatRange } from '@/lib/calendar/countdown';
import { eventsOnDay, upcomingEvents, type CalEvent } from '@/lib/calendar/groups';
import { countdownLabel } from '@/lib/format/countdown';
import { countdownOrLate, formatClock } from '@/lib/format/time';
import type { DashMessages } from '@/lib/i18n/dashboard';
import { timeZone } from '../data';
import { Card } from '../Shell';
import { EventInfo, HolidayInfo } from './EventInfo';

/** Category dot: the group's color, never the only cue (the category is written next to it). */
export function CategoryDot({ event }: { event: CalEvent }) {
  if (event.source.type === 'tugas') return <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full" style={{ background: `var(--course-${event.source.courseColor})` }} />;
  return <span aria-hidden="true" className={`db-cat-${event.group} db-cat-dot mt-2 size-2 shrink-0 rounded-full`} />;
}

/** "Hari dipilih": the full date, then every event on it with its details; tasks show the course and due time. */
export function SelectedDay({ day, events, angkatan, d, countdown = false, now = 0 }: { day: string; events: readonly CalEvent[]; angkatan: number | null; d: DashMessages; countdown?: boolean; now?: number }) {
  const { m, locale } = useI18n();
  const items = eventsOnDay(events, day);
  return (
    <Card title={formatDateKey(day, m.intl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>
      {items.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">{d.kalender.dayEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((e) => (
            <li key={e.id} className="flex items-start gap-2">
              <CategoryDot event={e} />
              <div className="min-w-0 flex-1">
                {e.source.type === 'kegiatan' ? (
                  <EventInfo k={e.source.kegiatan} d={d} angkatan={angkatan} />
                ) : e.source.type === 'libur' ? (
                  <HolidayInfo l={e.source.libur} d={d} />
                ) : (
                  <div>
                    <p className="text-[14px] font-semibold">{e.title}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {e.source.courseName} ·{' '}
                      {countdown && e.source.dueAt >= now ? (
                        <span className="tabular-nums" data-due-at={e.source.dueAt} aria-label={countdownLabel((e.source.dueAt - now) * 1000, locale) ?? undefined}>
                          {countdownOrLate(e.source.dueAt, now, timeZone, m)}
                        </span>
                      ) : (
                        d.kalender.dueAt(formatClock(e.source.dueAt, timeZone, m))
                      )}
                    </p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** A small date block: the day large, the month small. */
export function DateBlock({ day }: { day: string }) {
  const { m } = useI18n();
  return (
    <span aria-hidden="true" className="flex w-10 shrink-0 flex-col items-center rounded-lg border border-border py-1 leading-none">
      <span className="text-[16px] font-semibold tabular-nums">{Number(day.slice(8))}</span>
      <span className="mt-1 text-[12px] text-muted-foreground">{formatDateKey(day, m.intl, { month: 'short' })}</span>
    </span>
  );
}

/** "Akan datang": the next five events from today. */
export function Upcoming({ events, today, d, onSelect }: { events: readonly CalEvent[]; today: string; d: DashMessages; onSelect: (day: string) => void }) {
  const { m } = useI18n();
  const next = upcomingEvents(events, today);
  const k = d.kalender;
  const range = (e: CalEvent) => formatRange({ mulai: e.start, selesai: e.end }, m.intl, k.to, '');
  return (
    <Card title={k.upcoming}>
      {next.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">{k.upcomingEmpty}</p>
      ) : (
        <ul className="space-y-1">
          {next.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onSelect(e.start)}
                className="-mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-surface-raised focus-ring:ring-2 focus-ring:ring-focus"
              >
                <DateBlock day={e.start} />
                <span className="min-w-0 flex-1">
                  {/* Up to two lines for the name; the dates get their own line. Nothing cut short. */}
                  <span className="line-clamp-2 text-[14px] leading-5 font-semibold" title={e.title}>
                    {e.title}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
                    <span aria-hidden="true" className={`db-cat-${e.group} db-cat-dot size-2 shrink-0 rounded-full`} />
                    {k.groups[e.group]}
                  </span>
                  {e.end !== e.start && <span className="block text-[12px] text-muted-foreground tabular-nums">{range(e)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

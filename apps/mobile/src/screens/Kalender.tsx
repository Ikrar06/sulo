// Kalender (M8c.1, cards). The focal point: a hero card with the next important
// date ("UAS 12 hari lagi", the number in the accent), its range and the
// teaching week's progress. Then Daftar/Bulan as a pill segmented control,
// category chips that scroll sideways, and either the list (each event a
// card with a 44 px date tile in its category tint) or the month in one card
// with the selected day's events below. Subscribing is a carousel of three
// cards opening Google Calendar in the browser. Bell and Perbarui sit in the
// header (AppShell).

import { offscreenRow } from './LongList';
import { useMemo, useState } from 'react';
import { countdownOf, formatDateKey, formatRange } from '@sulo/core/calendar/countdown';
import { calendarEvents, CALENDAR_GROUPS, eventsOnDay, holidayDays, type CalEvent, type CalendarGroup, type TaskForCalendar } from '@sulo/core/calendar/groups';
import { FEED_IDS, feedUrl } from '@sulo/core/calendar/feeds';
import { monthGrid, shiftMonth } from '@sulo/core/calendar/month';
import { calendarStatus } from '@sulo/core/calendar/status';
import { googleSubscribeUrl } from '@sulo/core/calendar/subscribe-links';
import { nextImportant } from '@sulo/core/calendar/upcoming';
import { buildTaskItems } from '@sulo/core/dashboard/tasks';
import { formatClock } from '@sulo/core/format/time';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { localParts } from '@sulo/core/reminders/zoned';
import { SourceFooter, useRange, useWeekText, WeekBar } from '@sulo/ui/dashboard/CalendarParts';
import { useI18n } from '@sulo/ui/i18n';
import { ChevronLeftIcon, ChevronRightIcon } from '@sulo/ui/icons';
import { SuloMascot } from '@sulo/ui/mascot/SuloMascot';
import { Card, Chip, EmptyCard, SectionHead, Tile } from '@sulo/ui/mobile/cards';
import { IconButton, PillButton, Segmented } from '@sulo/ui/mobile/controls';
import { courseTint, tintBg, type TintColor } from '@sulo/ui/mobile/tint';
import { timeZone, useMobileData } from '../shell/data';

type View = 'list' | 'month';
const catTint = (g: CalendarGroup): TintColor => `cat-${g}`;

export function KalenderScreen() {
  const { m, locale } = useI18n();
  const d = mobileDash(locale);
  const w = mobileWords(locale);
  const k = d.kalender;
  const { data, actions } = useMobileData();
  const calendar = data!.calendar;
  const today = data!.today;
  const filter = data!.prefs.calendarFilter;
  const [view, setView] = useState<View>('list');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const status = calendarStatus(calendar, today);

  const tasks = useMemo<TaskForCalendar[]>(
    () =>
      data!.user
        ? buildTaskItems(data!.user)
            .filter((i) => i.status === 'pending' && i.task.dueAt !== null)
            .map((i) => ({ eventId: i.task.eventId, name: i.task.name, courseName: i.courseName, courseColor: i.courseColor, dueAt: i.task.dueAt!, dateKey: localParts(i.task.dueAt!, timeZone).dateKey }))
        : [],
    [data],
  );
  const events = useMemo(() => calendarEvents(calendar, tasks, filter), [calendar, tasks, filter]);
  const listEvents = useMemo(() => calendarEvents(calendar, [], filter, { estimates: true }), [calendar, filter]);
  const holidays = useMemo(() => holidayDays(calendar), [calendar]);
  const toggle = (g: CalendarGroup) => void actions.setPrefs({ calendarFilter: { ...filter, [g]: !filter[g] } });

  return (
    <div className="space-y-6">
      {status.kind === 'expired' ? (
        <Card hero>
          <p className="text-m15 font-semibold">{k.expiredTitle}</p>
          <p className="mt-1 text-m13 text-muted-foreground">{k.expiredBody(formatDateKey(status.berlakuSampai, m.intl, { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
        </Card>
      ) : (
        <Hero calendar={calendar} today={today} d={d} w={w} />
      )}

      <div className="space-y-3">
        <Segmented value={view} onChange={setView} label={k.viewLabel} options={[{ value: 'list', label: k.list }, { value: 'month', label: k.month }]} />
        <div role="group" aria-label={k.filterLabel} className="m-carousel -mx-4 flex gap-2 overflow-x-auto px-4">
          {CALENDAR_GROUPS.filter((g) => g !== 'kuliah').map((g) => (
            <Chip key={g} dot color={catTint(g)} dashed={!filter[g]} onPress={() => toggle(g)} selected={false}>
              {k.groups[g]}
            </Chip>
          ))}
        </div>
      </div>

      {view === 'list' ? (
        <EventList events={listEvents} today={today} d={d} />
      ) : (
        <div className="space-y-3">
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <IconButton icon={ChevronLeftIcon} inset label={k.prevMonth} onPress={() => setMonth(shiftMonth(month, -1))} />
              <span className="flex-1 text-center text-m15 font-semibold" aria-live="polite">
                {formatDateKey(`${month}-01`, m.intl, { month: 'long', year: 'numeric' })}
              </span>
              <IconButton icon={ChevronRightIcon} inset label={k.nextMonth} onPress={() => setMonth(shiftMonth(month, 1))} />
            </div>
            <MonthGrid month={month} today={today} selected={selected} onSelect={setSelected} events={events} holidays={holidays} intl={m.intl} />
          </Card>
          <DayCard day={selected} events={eventsOnDay(events, selected)} d={d} />
        </div>
      )}

      <section aria-labelledby="sub-title">
        <SectionHead id="sub-title" title={k.subscribe.title} />
        <ul className="m-carousel -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {FEED_IDS.map((id) => {
            const feed = k.subscribe.feeds[id];
            return (
              <li key={id} className="w-[240px] shrink-0">
                <Card className="flex h-full flex-col">
                  <p className="text-m15 font-semibold">{feed.name}</p>
                  <p className="mt-1 line-clamp-3 text-m13 text-muted-foreground">{feed.desc}</p>
                  <div className="mt-auto pt-3">
                    <PillButton small onPress={() => actions.openExternal(googleSubscribeUrl(feedUrl(id)))}>
                      {k.subscribe.google}
                    </PillButton>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-m12 font-normal text-muted-foreground">{k.subscribe.note}</p>
      </section>
      <div className="[&_*]:!text-m12">
        <SourceFooter calendar={calendar} d={d} />
      </div>
    </div>
  );
}

/** The next important date, large, with the teaching week. */
function Hero({ calendar, today, d, w }: { calendar: Parameters<typeof useWeekText>[0]; today: string; d: ReturnType<typeof mobileDash>; w: ReturnType<typeof mobileWords> }) {
  const k = d.kalender;
  const { info } = useWeekText(calendar, today, d);
  const range = useRange(d);
  const next = nextImportant(calendar, today);
  const c = next ? countdownOf(next.kegiatan, today) : null;
  const days = c?.kind === 'days' ? w.app.daysLeftParts(c.n) : null;
  return (
    <Card hero>
      {next && c ? (
        <>
          {/* The event's name, how far off it is, then its dates: no label repeating the name. */}
          <p className="text-m15">{next.kegiatan.judul}</p>
          <p className="mt-1 text-m26 whitespace-nowrap">
            {days ? (
              <>
                <span className="db-accent-text tabular-nums">{days[0]}</span>
                {days[1]}
              </>
            ) : c.kind === 'today' ? (
              k.countdown.today
            ) : c.kind === 'tomorrow' ? (
              k.countdown.tomorrow
            ) : (
              k.countdown.ongoingOpen
            )}
          </p>
          <p className="text-m13 text-muted-foreground tabular-nums">{range(next.kegiatan)}</p>
        </>
      ) : (
        <p className="text-m15">{k.nothing}</p>
      )}
      {info.kind === 'week' && (
        <div className="mt-4 flex items-center gap-3">
          <WeekBar nomor={info.nomor} total={info.total} label={w.app.weekOf(info.nomor, info.total)} className="flex-1" />
          <span className="shrink-0 text-m13 text-muted-foreground tabular-nums">{w.app.weekOf(info.nomor, info.total)}</span>
        </div>
      )}
    </Card>
  );
}

/** By month (13 semibold), each event a card with a 44 px tile in its category tint. */
function EventList({ events, today, d }: { events: readonly CalEvent[]; today: string; d: ReturnType<typeof mobileDash> }) {
  const { m } = useI18n();
  const k = d.kalender;
  const [showPast, setShowPast] = useState(false);
  const pastCount = events.filter((e) => e.end < today).length;
  const shown = [...events].filter((e) => showPast || e.end >= today).sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.id.localeCompare(b.id));
  const months = [...new Set(shown.map((e) => e.start.slice(0, 7)))];
  // pnpm check:fit (web build only): the longest event name in the calendar data.
  if (__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web') (window as unknown as { __suloEventTitles?: string[] }).__suloEventTitles = events.map((e) => e.title);
  return (
    <div className="space-y-4">
      {pastCount > 0 && (
        <button type="button" onClick={() => setShowPast((v) => !v)} className="m-hit rounded text-m13 text-muted-foreground underline underline-offset-2 outline-none focus-ring:ring-2 focus-ring:ring-focus">
          {showPast ? k.hidePast : k.showPast}
        </button>
      )}
      {shown.length === 0 ? (
        <EmptyCard mascot={<SuloMascot mood="happy" size={48} />} text={k.listEmpty} />
      ) : (
        months.map((month) => (
          <section key={month}>
            <h2 className="mb-2 text-m13 font-semibold text-muted-foreground">{formatDateKey(`${month}-01`, m.intl, { month: 'long', year: 'numeric' })}</h2>
            <ul className="space-y-2">
              {shown
                .filter((e) => e.start.slice(0, 7) === month)
                .map((e) => {
                  const k2 = e.source.type === 'kegiatan' ? e.source.kegiatan : null;
                  return (
                    <li key={e.id} style={offscreenRow(shown.length, 80)}>
                      {/* The tile at the title's top; the text takes the rest of the width: the title (two
                          lines at most), then the dates on the left (they may end in an ellipsis) with the
                          kind and, for an estimate, a neutral "Perkiraan" chip on the right (never cut). */}
                      <Card dense className="flex items-start gap-3">
                        <Tile color={e.source.type === 'tugas' ? courseTint(e.source.courseColor) : catTint(e.group)} size={44}>
                          <span className="text-m18 leading-none tabular-nums">{Number(e.start.slice(8))}</span>
                          <span className="text-m11 text-muted-foreground">{formatDateKey(e.start, m.intl, { month: 'short' })}</span>
                        </Tile>
                        <div className="min-w-0 flex-1">
                          <p data-fit-event className="line-clamp-2 text-m15">{e.title}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <p className="min-w-0 flex-1 truncate text-m13 text-muted-foreground tabular-nums">{formatRange({ mulai: e.start, selesai: k2 ? k2.selesai : e.end }, m.intl, k.to, k.badge.ujungTerbuka.toLowerCase())}</p>
                            {k2?.perkiraan && <span className="shrink-0 rounded-full bg-m-inset px-2 text-m11 leading-5 text-muted-foreground">{k.badge.perkiraan}</span>}
                            <span className="shrink-0 rounded-full px-2 text-m11 leading-5" style={{ background: tintBg(e.source.type === 'tugas' ? courseTint(e.source.courseColor) : catTint(e.group), 16, 'var(--m-card)') }}>
                              {k.groups[e.group]}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

/** Seven columns; today in an accent circle, colored dots for the day's kinds. */
function MonthGrid({ month, today, selected, onSelect, events, holidays, intl }: { month: string; today: string; selected: string; onSelect: (day: string) => void; events: readonly CalEvent[]; holidays: ReadonlyMap<string, unknown> | ReadonlySet<string>; intl: string }) {
  const weeks = monthGrid(month);
  const heads = weeks[0]!.map((day) => formatDateKey(day, intl, { weekday: 'narrow' }));
  return (
    <div role="grid" aria-label={formatDateKey(`${month}-01`, intl, { month: 'long', year: 'numeric' })}>
      <div role="row" className="grid grid-cols-7">
        {heads.map((h, i) => (
          <span key={i} role="columnheader" className="py-1 text-center text-m12 text-muted-foreground">
            {h}
          </span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} role="row" className="grid grid-cols-7">
          {week.map((day) => {
            const dayEvents = eventsOnDay(events, day);
            const kinds = [...new Set(dayEvents.map((e) => e.group))].slice(0, 3);
            const isSelected = day === selected;
            const isToday = day === today;
            return (
              <button
                key={day}
                type="button"
                role="gridcell"
                aria-selected={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${formatDateKey(day, intl, { weekday: 'long', day: 'numeric', month: 'long' })}${dayEvents.length > 0 ? `, ${dayEvents.length}` : ''}`}
                onClick={() => onSelect(day)}
                className={`flex h-12 flex-col items-center justify-center gap-1 outline-none focus-ring:ring-2 focus-ring:ring-focus ${day.startsWith(month) ? '' : 'opacity-40'}`}
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-m13 tabular-nums ${isToday ? 'bg-primary text-primary-foreground' : isSelected ? 'bg-m-inset font-semibold' : holidays.has(day) ? 'db-holiday-number' : ''}`}
                >
                  {Number(day.slice(8))}
                </span>
                <span className="flex h-1.5 gap-1" aria-hidden="true">
                  {kinds.map((g) => (
                    <span key={g} className={`db-cat-${g} db-cat-dot size-1.5 rounded-full`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** The selected day's events: a card per day, rows with inset hairlines. */
function DayCard({ day, events, d }: { day: string; events: readonly CalEvent[]; d: ReturnType<typeof mobileDash> }) {
  const { m } = useI18n();
  const k = d.kalender;
  return (
    <Card>
      <p className="text-m15 font-semibold">{formatDateKey(day, m.intl, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      {events.length === 0 ? (
        <p className="mt-1 text-m13 text-muted-foreground">{k.dayEmpty}</p>
      ) : (
        <ul className="mt-2">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line">
              <span aria-hidden="true" className={`db-cat-${e.group} db-cat-dot size-2.5 shrink-0 rounded-full`} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-m15">{e.title}</span>
                {e.source.type === 'tugas' && (
                  <span className="block text-m13 text-muted-foreground">
                    <Chip small color={courseTint(e.source.courseColor)}>
                      {e.source.courseName}
                    </Chip>{' '}
                    {k.dueAt(formatClock(e.source.dueAt, timeZone, m))}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

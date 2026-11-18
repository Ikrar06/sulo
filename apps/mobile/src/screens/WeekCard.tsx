// Ringkasan's "7 hari ke depan": seven equal columns, each a full-height
// button that opens Tugas filtered to that day. Per column: the due count
// (blank at 0), a 20 px rounded bar scaled to the busiest day (4 px muted
// baseline when empty), the weekday letter and the date, and a category dot
// for an exam or an important date. Bars are neutral; today is the accent.
// They grow once on mount (240 ms, 20 ms apart; none under reduced motion).

import { formatDateKey } from '@sulo/core/calendar/countdown';
import type { WeekBar } from '@sulo/core/dashboard/week-bars';
import { Card, SectionHead } from '@sulo/ui/mobile/cards';

interface Words {
  title: string;
  empty: string;
  day: (date: string, n: number) => string;
}

const NEUTRAL = 'color-mix(in oklch, var(--text) 70%, transparent)';
const BASELINE = 'var(--m-line)';
const ACCENT = 'var(--brand-orange)';

export function WeekCard({ bars, intl, words, onOpen }: { bars: readonly WeekBar[]; intl: string; words: Words; onOpen: (dateKey: string) => void }) {
  const allZero = bars.every((b) => b.count === 0);
  return (
    <section aria-labelledby="week-title">
      <SectionHead id="week-title" title={words.title} />
      <Card>
        {allZero && <p className="mb-3 text-m13 text-muted-foreground">{words.empty}</p>}
        <ol className="grid grid-cols-7">
          {bars.map((b, i) => {
            // "Jumat 20 November, 3 tenggat": the weekday and the date without Intl's comma between them.
            const label = words.day(`${formatDateKey(b.dateKey, intl, { weekday: 'long' })} ${formatDateKey(b.dateKey, intl, { day: 'numeric', month: 'long' })}`, b.count);
            const fill = b.isToday ? ACCENT : b.count === 0 ? BASELINE : NEUTRAL;
            return (
              <li key={b.dateKey} className="flex">
                <button
                  type="button"
                  aria-label={label}
                  aria-current={b.isToday ? 'date' : undefined}
                  onClick={() => onOpen(b.dateKey)}
                  className="flex w-full flex-col items-center gap-1 rounded-ctl py-1 outline-none focus-ring:ring-2 focus-ring:ring-focus"
                >
                  <span aria-hidden="true" className="h-4 text-m12 text-muted-foreground tabular-nums">
                    {b.count > 0 ? b.count : ''}
                  </span>
                  <span aria-hidden="true" className="flex h-12 items-end">
                    <span className="m-bar-grow block w-5 rounded-full" style={{ height: b.height, background: fill, ['--i' as string]: i }} />
                  </span>
                  <span aria-hidden="true" className={`text-m12 ${b.isToday ? 'db-accent-text font-semibold' : 'text-muted-foreground'}`}>
                    {formatDateKey(b.dateKey, intl, { weekday: 'narrow' })}
                  </span>
                  <span aria-hidden="true" className="text-m12 tabular-nums">
                    {formatDateKey(b.dateKey, intl, { day: 'numeric' })}
                  </span>
                  <span aria-hidden="true" className={`size-1.5 rounded-full ${b.dot ? `db-cat-${b.dot} db-cat-dot` : ''}`} />
                </button>
              </li>
            );
          })}
        </ol>
      </Card>
    </section>
  );
}

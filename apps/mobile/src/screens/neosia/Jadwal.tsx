// Jadwal (M8d B4): the week's classes from NEOSIA's KRS, one card per day,
// today first with the orange mark ("today" is one of the three uses of
// orange), course chips tinted like the rest of Sulo, times that never wrap.
// The data's age shows; "Perbarui dari NEOSIA" only opens the KRS page.

import { useMemo } from 'react';
import { formatAgo } from '@sulo/core/format/time';
import { neosiaWords } from '@sulo/core/i18n/neosia';
import { linkedMeetings } from '@sulo/core/neosia/linked';
import { holidayOn, holidayRanges } from '@sulo/core/neosia/schedule';
import { classMeetings } from '@sulo/core/neosia/view';
import { addDays, weekday } from '@sulo/core/calendar/dates';
import { Card, Chip, EmptyCard } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { FitLine } from '@sulo/ui/mobile/fit-line';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { useI18n } from '@sulo/ui/i18n';
import { useMobileData } from '../../shell/data';
import { useNeosia } from '../../neosia/NeosiaProvider';

export function JadwalScreen() {
  const { locale, m } = useI18n();
  const n = neosiaWords(locale);
  const neo = useNeosia();
  const { data } = useMobileData();
  const today = data!.today;
  const meetings = useMemo(() => linkedMeetings(classMeetings(neo.snapshots), data!.user?.courses ?? [], neo.courseMap), [neo.snapshots, neo.courseMap, data]);
  const seenAt = neo.snapshots.belanja_krs?.seenAt ?? null;
  const holidays = useMemo(() => holidayRanges(data!.calendar), [data]);

  if (!neo.enabled || meetings.length === 0) {
    return (
      <div className="space-y-3 pt-2">
        <EmptyCard mascot={<Mascot state="idle" size={48} />} text={neo.enabled ? n.schedule.emptyNoData : n.invite.text} />
        {neo.enabled && (
          <PillButton full onPress={() => void neo.open('krs')}>
            {n.refresh.openKrs}
          </PillButton>
        )}
      </div>
    );
  }

  // The coming seven days, today first: each day's own classes (a holiday says so instead).
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  return (
    <div className="space-y-3 pt-2">
      {seenAt !== null && <p className="text-m12 text-muted-foreground">{n.jadwal.updated(formatAgo(seenAt, data!.now, m))}</p>}
      {days.map((day) => {
        const wd = weekday(day);
        const list = meetings.filter((x) => x.weekday === wd).sort((a, b) => a.start.localeCompare(b.start));
        const holiday = holidayOn(holidays, day);
        if (list.length === 0 && holiday === null) return null;
        const isToday = day === today;
        return (
          <Card key={day} inner="space-y-3">
            <p className="flex items-center gap-2 text-m15 font-semibold">
              {isToday && <span aria-hidden="true" className="size-2 rounded-full" style={{ background: "var(--brand-orange)" }} />}
              {n.jadwal.days[wd]}
              <span className="text-m12 font-normal text-muted-foreground">{day.slice(8, 10)}/{day.slice(5, 7)}</span>
            </p>
            {holiday !== null ? (
              <p className="text-m13 text-muted-foreground">{n.jadwal.holiday(holiday)}</p>
            ) : (
              <ul className="space-y-3">
                {list.map((x) => (
                  <li key={`${x.key}-${x.start}`} className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
                    <FitLine size="text-m13" text={`${x.start}${x.end}`} className="tabular-nums text-muted-foreground">
                      {x.start}–{x.end}
                    </FitLine>
                    <Chip color={x.color !== null ? `course-${x.color}` : null} dot>
                      {x.displayName}
                      {x.classLabel ? ` ${x.classLabel}` : ''}
                    </Chip>
                    {x.room && <p className="col-start-2 text-m12 text-muted-foreground">{x.room}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
      <PillButton full onPress={() => void neo.open('krs')}>
        {n.refresh.grades}
      </PillButton>
    </div>
  );
}

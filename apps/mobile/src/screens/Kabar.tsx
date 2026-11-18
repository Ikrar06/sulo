// Kabar terbaru (M8c.1, cards): pill chips filter by kind and by course
// (both scroll sideways), a round bell opens "Atur notifikasi" in a bottom
// sheet, and each update is a card (a tile for its kind, the change, the
// course, the time, a dot while unseen). Tapping one opens it on SIKOLA.

import { useEffect, useState } from 'react';
import { formatClock } from '@sulo/core/format/time';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { markAllSeen } from '@sulo/core/radar/log';
import { changeUrl, describeChange } from '@sulo/core/radar/describe';
import { categoryOf, UPDATE_CATEGORIES, type UpdateCategory } from '@sulo/core/radar/settings';
import { addDays, localParts } from '@sulo/core/reminders/zoned';
import type { ChangeLogEntry } from '@sulo/core/types';
import { BookIcon, GradeIcon, NewsIcon, TasksIcon } from '@sulo/ui/dashboard-icons';
import { useI18n } from '@sulo/ui/i18n';
import { BellIcon } from '@sulo/ui/icons';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { Card, Chip, EmptyCard, IconTile } from '@sulo/ui/mobile/cards';
import { IconButton, PillButton, Toggle } from '@sulo/ui/mobile/controls';
import { Sheet } from '@sulo/ui/mobile/sheet';
import type { TintColor } from '@sulo/ui/mobile/tint';
import { timeZone, useMobileData } from '../shell/data';
import type { Screen } from '../shell/nav';
import { HeaderTools } from '../shell/screen-header';

const KIND: Record<UpdateCategory, { icon: typeof NewsIcon; tint: TintColor }> = {
  materials: { icon: BookIcon, tint: 'course-5' },
  deadlines: { icon: TasksIcon, tint: 'course-1' },
  grades: { icon: GradeIcon, tint: 'course-7' },
  forum: { icon: NewsIcon, tint: 'course-3' },
};

export function KabarScreen({ courseId }: { courseId: number | null; go: (s: Screen) => void }) {
  const { m, locale } = useI18n();
  const d = mobileDash(locale);
  const w = mobileWords(locale);
  const t = d.kabar;
  const u = m.popup.updates;
  const { data, actions } = useMobileData();
  const [course, setCourse] = useState<string>(courseId === null ? 'all' : String(courseId));
  useEffect(() => {
    if (courseId !== null) setCourse(String(courseId));
  }, [courseId]);
  const [kind, setKind] = useState<UpdateCategory | 'all'>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const view = data!.view;
  const entries = view.updates.filter((e) => (course === 'all' || String(e.change.courseId) === course) && (kind === 'all' || categoryOf(e.change) === kind));
  const courseIds = [...new Set(view.updates.map((e) => e.change.courseId).filter((id): id is number => id !== null))];
  const settings = data!.prefs.updates;
  const today = localParts(data!.now, timeZone).dateKey;
  const dayOf = (e: ChangeLogEntry) => localParts(e.at, timeZone).dateKey;
  const days = [...new Set(entries.map(dayOf))];
  const dayName = (key: string) => (key === today ? u.today : key === addDays(today, -1) ? u.yesterday : new Intl.DateTimeFormat(m.intl, { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${key}T12:00:00Z`)));

  return (
    <div className="space-y-4">
      <HeaderTools>
        <IconButton icon={BellIcon} label={t.notify} onPress={() => setSettingsOpen(true)} />
      </HeaderTools>
      <div className="space-y-2">
        <div role="group" aria-label={t.kind} className="m-carousel -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip selected={kind === 'all'} onPress={() => setKind('all')}>
            {t.allKinds}
          </Chip>
          {UPDATE_CATEGORIES.map((c) => (
            <Chip key={c} selected={kind === c} onPress={() => setKind(c)}>
              {u.categories[c]}
            </Chip>
          ))}
        </div>
        {courseIds.length > 1 && (
          <div role="group" aria-label={t.course} className="m-carousel -mx-4 flex gap-2 overflow-x-auto px-4">
            <Chip selected={course === 'all'} onPress={() => setCourse('all')}>
              {t.allCourses}
            </Chip>
            {courseIds.map((id) => (
              <Chip key={id} selected={course === String(id)} onPress={() => setCourse(String(id))}>
                {view.courseNames[String(id)] ?? u.otherCourse}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyCard mascot={<Mascot state="all-done" size={48} />} text={u.empty} />
      ) : (
        <>
          {view.updatesUnseen > 0 && (
            <PillButton small onPress={() => void actions.updateUser('changes', markAllSeen)}>
              {u.markAll}
            </PillButton>
          )}
          {days.map((day) => (
            <section key={day}>
              <h2 className="mb-2 text-m13 font-semibold text-muted-foreground">{dayName(day)}</h2>
              <ul className="space-y-2">
                {entries
                  .filter((e) => dayOf(e) === day)
                  .map((e) => {
                    const url = changeUrl(e.change);
                    const k = KIND[categoryOf(e.change) ?? 'forum'];
                    const courseName = e.change.courseId !== null ? (view.courseNames[String(e.change.courseId)] ?? u.otherCourse) : u.otherCourse;
                    const text = describeChange(e.change, timeZone, m);
                    const body = (
                      <div className="flex items-start gap-3">
                        <IconTile color={k.tint} icon={k.icon} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className={`line-clamp-3 text-m15 ${e.seen ? 'font-normal' : ''}`}>{text}</p>
                          <p className="truncate text-m13 text-muted-foreground">{courseName}</p>
                        </div>
                        <span className="flex shrink-0 flex-col items-end gap-2">
                          <span className="text-m12 font-normal text-muted-foreground tabular-nums">{formatClock(e.at, timeZone, m)}</span>
                          {!e.seen && <span aria-label={u.markerNew} role="img" className="size-2 rounded-full bg-foreground" />}
                        </span>
                      </div>
                    );
                    return (
                      <li key={e.id}>
                        {url ? (
                          <Card dense onPress={() => actions.openExternal(url)} label={`${text}, ${courseName}${e.seen ? '' : `, ${u.markerNew}`}`}>
                            {body}
                          </Card>
                        ) : (
                          <Card dense>{body}</Card>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </>
      )}

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen} title={t.notify}>
        <div className="rounded-card bg-m-inset px-4 py-1">
          {UPDATE_CATEGORIES.map((c) => (
            <label key={c} className="flex min-h-12 items-center gap-3 py-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line">
              <span className="min-w-0 flex-1 text-m15">{u.categories[c]}</span>
              <Toggle checked={settings[c]} label={u.categories[c]} onChange={(v) => void actions.setPrefs({ updates: { ...settings, [c]: v } })} />
            </label>
          ))}
        </div>
        <p className="mt-2 text-m13 text-muted-foreground">{u.settingsNote}</p>
        <div className="mt-4">
          <PillButton full onPress={() => setSettingsOpen(false)}>
            {w.app.doneSheet}
          </PillButton>
        </div>
      </Sheet>
    </div>
  );
}

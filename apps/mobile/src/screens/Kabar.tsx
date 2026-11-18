// Kabar terbaru (M8c.1, cards): one row of two filter pills (kind, course)
// that open single-choice sheets and can both be on; a round bell opens
// "Atur notifikasi" in a bottom sheet; "Tandai semua sudah dilihat" is a
// text link beside the first day's title while something is unseen. Each
// update is a card (a tile for its kind, the change in two lines at most,
// the course, the time, a dot while unseen); tapping one opens it on SIKOLA.
// A filter with no result: one sentence and Hapus filter.

import { useEffect, useMemo, useState } from 'react';
import { activeCourseIds } from '@sulo/core/courses/active-score';
import { assignCourseColors } from '@sulo/core/courses/colors';
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
import { Card, EmptyCard, IconTile } from '@sulo/ui/mobile/cards';
import { FilterPill, IconButton, PillButton, Toggle } from '@sulo/ui/mobile/controls';
import { Sheet, SheetOptions, afterSheetClosed } from '@sulo/ui/mobile/sheet';
import { courseTint, tintVar, type TintColor } from '@sulo/ui/mobile/tint';
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
  const [picker, setPicker] = useState<'kind' | 'course' | null>(null);
  const k = w.kabar;
  const user = data!.user!;
  const colors = useMemo(() => assignCourseColors(user.courses.filter((c) => activeCourseIds(user.courses).has(c.id))), [user.courses]);
  const view = data!.view;
  const entries = view.updates.filter((e) => (course === 'all' || String(e.change.courseId) === course) && (kind === 'all' || categoryOf(e.change) === kind));
  const courseIds = [...new Set(view.updates.map((e) => e.change.courseId).filter((id): id is number => id !== null))];
  const settings = data!.prefs.updates;
  const today = localParts(data!.now, timeZone).dateKey;
  const dayOf = (e: ChangeLogEntry) => localParts(e.at, timeZone).dateKey;
  const days = [...new Set(entries.map(dayOf))];
  const courseName = (id: string) => view.courseNames[id] ?? u.otherCourse;
  const kindLabel = kind === 'all' ? t.allKinds : u.categories[kind];
  const courseLabel = course === 'all' ? t.allCourses : courseName(course);
  const clearAll = () => {
    setKind('all');
    setCourse('all');
  };
  const dayName = (key: string) => (key === today ? u.today : key === addDays(today, -1) ? u.yesterday : new Intl.DateTimeFormat(m.intl, { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${key}T12:00:00Z`)));

  return (
    <div className="space-y-4">
      <HeaderTools>
        <IconButton icon={BellIcon} label={t.notify} onPress={() => setSettingsOpen(true)} />
      </HeaderTools>
      {view.updates.length > 0 && (
        <div className="flex gap-2">
          <FilterPill label={kindLabel} active={kind !== 'all'} onOpen={() => setPicker('kind')} onClear={() => setKind('all')} clearLabel={k.clearFilter(kindLabel)} />
          {courseIds.length > 1 && <FilterPill label={courseLabel} active={course !== 'all'} onOpen={() => setPicker('course')} onClear={() => setCourse('all')} clearLabel={k.clearFilter(courseLabel)} />}
        </div>
      )}

      {view.updates.length === 0 ? (
        <EmptyCard mascot={<Mascot state="all-done" size={48} />} text={u.empty} />
      ) : entries.length === 0 ? (
        <Card>
          <p role="status" className="text-m15">
            {k.noneForFilter}
          </p>
          <div className="mt-3">
            <PillButton onPress={clearAll}>{k.clearFilters}</PillButton>
          </div>
        </Card>
      ) : (
        <>
          {days.map((day) => (
            <section key={day}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-m13 font-semibold text-muted-foreground">{dayName(day)}</h2>
                {day === days[0] && view.updatesUnseen > 0 && (
                  <button type="button" onClick={() => void actions.updateUser('changes', markAllSeen)} className="m-hit rounded text-m13 underline underline-offset-2 outline-none focus-ring:ring-2 focus-ring:ring-focus">
                    {u.markAll}
                  </button>
                )}
              </div>
              <ul className="space-y-2">
                {entries
                  .filter((e) => dayOf(e) === day)
                  .map((e) => {
                    const url = changeUrl(e.change);
                    const k = KIND[categoryOf(e.change) ?? 'forum'];
                    const course = e.change.courseId !== null ? courseName(String(e.change.courseId)) : u.otherCourse;
                    const text = describeChange(e.change, timeZone, m);
                    const body = (
                      <div className="flex items-start gap-3">
                        <IconTile color={k.tint} icon={k.icon} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className={`line-clamp-2 text-m15 ${e.seen ? 'font-normal' : ''}`}>{text}</p>
                          <p className="truncate text-m13 text-muted-foreground">{course}</p>
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
                          <Card dense onPress={() => actions.openExternal(url)} label={`${text}, ${course}${e.seen ? '' : `, ${u.markerNew}`}`}>
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

      <Sheet open={picker === 'kind'} onOpenChange={(o) => !o && setPicker(null)} title={t.kind}>
        <SheetOptions
          value={kind}
          options={[{ value: 'all' as const, label: t.allKinds }, ...UPDATE_CATEGORIES.map((c) => ({ value: c, label: u.categories[c] }))]}
          onChoose={(v) => {
            setPicker(null);
            // The list re-filters once the sheet is gone.
            afterSheetClosed(() => setKind(v));
          }}
        />
      </Sheet>
      <Sheet open={picker === 'course'} onOpenChange={(o) => !o && setPicker(null)} title={t.course}>
        <SheetOptions
          value={course}
          options={[{ value: 'all', label: t.allCourses }, ...courseIds.map((id) => ({ value: String(id), label: courseName(String(id)), dot: tintVar(courseTint(colors.get(id) ?? null)) }))]}
          onChoose={(v) => {
            setPicker(null);
            afterSheetClosed(() => setCourse(v));
          }}
        />
      </Sheet>
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

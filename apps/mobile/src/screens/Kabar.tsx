// Kabar terbaru: the same entries as the dashboard (core view), filtered by
// course and kind, with "Atur notifikasi" under the filters. A course from a
// tapped reminder opens filtered to it.

import { useEffect, useState } from 'react';
import { mobileDash } from '@sulo/core/i18n/mobile';
import { markAllSeen } from '@sulo/core/radar/log';
import { categoryOf, UPDATE_CATEGORIES, type UpdateCategory } from '@sulo/core/radar/settings';
import { useI18n } from '@sulo/ui/i18n';
import { ChevronDownIcon } from '@sulo/ui/icons';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@sulo/ui/ui/select';
import { UpdateSettingsChecks, UpdatesPanel } from '@sulo/ui/updates/UpdatesPanel';
import { timeZone, useMobileData } from '../shell/data';
import type { Screen } from '../shell/nav';

export function KabarScreen({ courseId }: { courseId: number | null; go: (s: Screen) => void }) {
  const { m, locale } = useI18n();
  const t = mobileDash(locale).kabar;
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

  return (
    <div className="m-touch space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Select value={course} onValueChange={setCourse}>
          <SelectTrigger className="w-full" aria-label={t.course}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allCourses}</SelectItem>
            {courseIds.map((id) => (
              <SelectItem key={id} value={String(id)}>
                {view.courseNames[String(id)] ?? m.popup.updates.otherCourse}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={(v) => setKind(v as UpdateCategory | 'all')}>
          <SelectTrigger className="w-full" aria-label={t.kind}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allKinds}</SelectItem>
            {UPDATE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {m.popup.updates.categories[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <section className="rounded-xl border border-border bg-surface">
        <button type="button" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)} className="flex min-h-12 w-full items-center justify-between px-4 text-left text-[14px] font-medium outline-none focus-ring:ring-2 focus-ring:ring-focus">
          {t.notify}
          <ChevronDownIcon className={`size-4 text-muted-foreground transition-transform motion-reduce:transition-none ${settingsOpen ? 'rotate-180' : ''}`} />
        </button>
        {settingsOpen && (
          <div className="border-t border-border px-4 py-3">
            <UpdateSettingsChecks settings={settings} onChange={(updates) => void actions.setPrefs({ updates })} />
          </div>
        )}
      </section>
      <div className="flex flex-col rounded-xl border border-border bg-surface">
        <UpdatesPanel
          entries={entries}
          courseNames={view.courseNames}
          now={data!.now}
          timeZone={timeZone}
          settings={settings}
          onOpen={actions.openExternal}
          onMarkAllSeen={() => void actions.updateUser('changes', markAllSeen)}
          onChangeSettings={(updates) => void actions.setPrefs({ updates })}
          embedded
          showSettings={false}
          empty={
            <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
              <Mascot state="all-done" size={40} />
              <p className="text-[14px] text-muted-foreground">{m.popup.updates.empty}</p>
            </div>
          }
        />
      </div>
    </div>
  );
}

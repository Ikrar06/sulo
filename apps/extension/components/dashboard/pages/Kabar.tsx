import { useEffect, useState } from 'react';
import { useI18n } from '@sulo/ui/i18n';
import { BellIcon } from '@sulo/ui/icons';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { Popover, PopoverContent, PopoverTrigger } from '@sulo/ui/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@sulo/ui/ui/select';
import { UpdateSettingsChecks, UpdatesPanel } from '@sulo/ui/updates/UpdatesPanel';
import { markAllSeen } from '@sulo/core/radar/log';
import { categoryOf, UPDATE_CATEGORIES, type UpdateCategory } from '@sulo/core/radar/settings';
import { timeZone } from '../data';
import type { PageProps } from '../types';

/**
 * The popup's "Kabar terbaru" panel, full width, with course and kind
 * filters. "Notify me about" lives in a popover on the toolbar, reading and
 * writing the same prefs.updates as Pengaturan.
 */
export function KabarPage({ d, data, actions, route }: PageProps) {
  const { m } = useI18n();
  const t = d.kabar;
  // #kabar/<courseId> (from a notification) opens filtered to that course.
  const [course, setCourse] = useState<string>(route.detail ?? 'all');
  useEffect(() => {
    if (route.detail) setCourse(route.detail);
  }, [route.detail]);
  const [kind, setKind] = useState<UpdateCategory | 'all'>('all');
  const entries = data.view.updates.filter(
    (e) => (course === 'all' || String(e.change.courseId) === course) && (kind === 'all' || categoryOf(e.change) === kind),
  );
  const courseIds = [...new Set(data.view.updates.map((e) => e.change.courseId).filter((id): id is number => id !== null))];
  const settings = data.prefs.updates;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={course} onValueChange={setCourse}>
          <SelectTrigger className="w-auto min-w-[200px]" aria-label={t.course}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allCourses}</SelectItem>
            {courseIds.map((id) => (
              <SelectItem key={id} value={String(id)}>
                {data.view.courseNames[String(id)] ?? m.popup.updates.otherCourse}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={(v) => setKind(v as UpdateCategory | 'all')}>
          <SelectTrigger className="w-auto min-w-[200px]" aria-label={t.kind}>
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
        <Popover>
          <PopoverTrigger className="ml-auto inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-[14px] font-medium outline-none hover:bg-surface-raised focus-ring:ring-2 focus-ring:ring-focus data-[state=open]:bg-surface-raised">
            <BellIcon className="size-4" />
            {t.notify}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <p className="mb-1 text-[12px] font-semibold text-muted-foreground">{m.popup.updates.settings}</p>
            <UpdateSettingsChecks settings={settings} onChange={(updates) => void actions.setPrefs({ updates })} />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-col rounded-xl border border-border bg-surface">
        <UpdatesPanel
          entries={entries}
          courseNames={data.view.courseNames}
          courseColors={data.view.courseColors}
          now={data.now}
          timeZone={timeZone}
          settings={settings}
          onOpen={actions.openTab}
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

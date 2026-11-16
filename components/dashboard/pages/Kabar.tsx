import { useState } from 'react';
import { useI18n } from '@/components/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UpdatesPanel } from '@/components/updates/UpdatesPanel';
import { markAllSeen } from '@/lib/radar/log';
import { categoryOf, UPDATE_CATEGORIES, type UpdateCategory } from '@/lib/radar/settings';
import { timeZone } from '../data';
import type { PageProps } from '../types';

/** The popup's "Kabar terbaru" panel, wide, with course and kind filters. */
export function KabarPage({ d, data, actions }: PageProps) {
  const { m } = useI18n();
  const t = d.kabar;
  const [course, setCourse] = useState<string>('all');
  const [kind, setKind] = useState<UpdateCategory | 'all'>('all');
  const entries = data.view.updates.filter(
    (e) => (course === 'all' || String(e.change.courseId) === course) && (kind === 'all' || categoryOf(e.change) === kind),
  );
  const courseIds = [...new Set(data.view.updates.map((e) => e.change.courseId).filter((id): id is number => id !== null))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={course} onValueChange={setCourse}>
          <SelectTrigger className="w-60" aria-label={t.course}>
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
          <SelectTrigger className="w-60" aria-label={t.kind}>
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
      <div className="flex max-w-[860px] flex-col rounded-xl border border-border bg-surface">
        <UpdatesPanel
          entries={entries}
          courseNames={data.view.courseNames}
          now={data.now}
          timeZone={timeZone}
          settings={data.prefs.updates}
          onOpen={actions.openTab}
          onMarkAllSeen={() => void actions.updateUser('changes', markAllSeen)}
          onChangeSettings={(updates) => void actions.setPrefs({ updates })}
          embedded
        />
      </div>
    </div>
  );
}

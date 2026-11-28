// "Tambah tugas" and "Ubah tugas" (1.1.0, from a user's suggestion): a task from a lecturer that SIKOLA does
// not have. A title, an optional course (chips of the followed courses, as the filters on Tugas), an optional
// due date and time; in edit mode a delete that asks once more. Writes nothing itself: the screen that opens
// it saves through core (tasks/own.ts).

import { useEffect, useId, useMemo, useState } from 'react';
import { activeCourseIds } from '@sulo/core/courses/active-score';
import { courseAlias } from '@sulo/core/courses/display-name';
import { mobileDash } from '@sulo/core/i18n/mobile';
import { localParts, zonedToUnix } from '@sulo/core/reminders/zoned';
import { cleanTitle, OWN_TITLE_MAX, type OwnTask, type OwnTaskInput } from '@sulo/core/tasks/own';
import type { CourseId, CourseRecord, UnixSeconds } from '@sulo/core/types';
import { useI18n } from '@sulo/ui/i18n';
import { Chip } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { Sheet } from '@sulo/ui/mobile/sheet';
import { Input } from '@sulo/ui/ui/input';
import { timeZone } from '../shell/data';

/** A datetime-local value from a time, in the phone's zone; '' for none. */
function localValue(at: UnixSeconds | null): string {
  if (at === null) return '';
  const p = localParts(at, timeZone);
  return `${p.dateKey}T${String(Math.floor(p.minuteOfDay / 60)).padStart(2, '0')}:${String(p.minuteOfDay % 60).padStart(2, '0')}`;
}

/** A time from a datetime-local value; null when empty or not a whole date and time. */
function fromLocal(value: string): UnixSeconds | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  return match ? zonedToUnix(match[1]!, Number(match[2]) * 60 + Number(match[3]), timeZone) : null;
}

export function OwnTaskSheet({
  open,
  onOpenChange,
  editing,
  courses,
  onSave,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The task being changed; null to add one. */
  editing: OwnTask | null;
  courses: readonly CourseRecord[];
  onSave: (input: OwnTaskInput) => void;
  onRemove?: () => void;
}) {
  const { locale } = useI18n();
  const t = mobileDash(locale).tugas;
  const ids = { title: useId(), due: useId(), course: useId() };
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState<CourseId | null>(null);
  const [due, setDue] = useState('');
  const [confirming, setConfirming] = useState(false);
  // Each opening starts from the task being changed, or empty.
  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? '');
    setCourseId(editing?.courseId ?? null);
    setDue(localValue(editing?.dueAt ?? null));
    setConfirming(false);
  }, [open, editing]);
  const followed = useMemo(() => {
    const active = activeCourseIds(courses);
    return courses.filter((c) => active.has(c.id) || c.id === editing?.courseId).map((c) => ({ id: c.id, name: courseAlias(c) }));
  }, [courses, editing]);
  const ready = cleanTitle(title) !== null;
  const save = () => {
    if (!ready) return;
    onSave({ title, courseId, dueAt: fromLocal(due) });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={editing ? t.ownEdit : t.ownAdd}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <p className="text-m13 text-muted-foreground">{t.ownHelp}</p>
        <div className="space-y-1">
          <label htmlFor={ids.title} className="block text-m13 font-semibold">
            {t.ownTitle}
          </label>
          <Input id={ids.title} value={title} maxLength={OWN_TITLE_MAX} placeholder={t.ownTitlePlaceholder} enterKeyHint="done" onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1">
          <p id={ids.course} className="text-m13 font-semibold">
            {t.ownCourse}
          </p>
          <div role="radiogroup" aria-labelledby={ids.course} className="flex flex-wrap gap-2">
            <Chip selected={courseId === null} onPress={() => setCourseId(null)}>
              {t.ownNoCourse}
            </Chip>
            {followed.map((c) => (
              <Chip key={c.id} selected={courseId === c.id} onPress={() => setCourseId(c.id)}>
                {c.name}
              </Chip>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor={ids.due} className="block text-m13 font-semibold">
            {t.ownDue}
          </label>
          <Input id={ids.due} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          <p className="text-m12 text-muted-foreground">{t.ownDueHelp}</p>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <PillButton kind="primary" full disabled={!ready} onPress={save}>
            {t.ownSave}
          </PillButton>
          {editing && onRemove && (
            <PillButton full onPress={() => (confirming ? onRemove() : setConfirming(true))}>
              {confirming ? t.ownRemoveConfirm : t.ownRemove}
            </PillButton>
          )}
        </div>
      </form>
    </Sheet>
  );
}

// "Tambah tugas" and "Ubah tugas" on the dashboard (1.1.0, from a user's suggestion): a task from a lecturer
// that SIKOLA does not have. A title, an optional course (the followed ones), an optional due date and time;
// in edit mode a delete that asks once more. The same fields as the phone's sheet (apps/mobile OwnTaskSheet);
// the page saves through core (tasks/own.ts).

import { useEffect, useId, useMemo, useState } from 'react';
import { activeCourseIds } from '@sulo/core/courses/active-score';
import { courseAlias } from '@sulo/core/courses/display-name';
import type { DashMessages } from '@sulo/core/i18n/dashboard';
import { localParts, zonedToUnix } from '@sulo/core/reminders/zoned';
import { cleanTitle, OWN_TITLE_MAX, type OwnTask, type OwnTaskInput } from '@sulo/core/tasks/own';
import type { CourseRecord, UnixSeconds } from '@sulo/core/types';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@sulo/ui/ui/alert-dialog';
import { Button } from '@sulo/ui/ui/button';
import { Input } from '@sulo/ui/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@sulo/ui/ui/select';
import { timeZone } from './data';

const NONE = 'none';

function localValue(at: UnixSeconds | null): string {
  if (at === null) return '';
  const p = localParts(at, timeZone);
  return `${p.dateKey}T${String(Math.floor(p.minuteOfDay / 60)).padStart(2, '0')}:${String(p.minuteOfDay % 60).padStart(2, '0')}`;
}

function fromLocal(value: string): UnixSeconds | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  return match ? zonedToUnix(match[1]!, Number(match[2]) * 60 + Number(match[3]), timeZone) : null;
}

export function OwnTaskDialog({
  open,
  onOpenChange,
  editing,
  courses,
  t,
  cancelLabel,
  onSave,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: OwnTask | null;
  courses: readonly CourseRecord[];
  t: DashMessages['tugas'];
  cancelLabel: string;
  onSave: (input: OwnTaskInput) => void;
  onRemove?: () => void;
}) {
  const ids = { title: useId(), course: useId(), due: useId() };
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState(NONE);
  const [due, setDue] = useState('');
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? '');
    setCourse(editing?.courseId != null ? String(editing.courseId) : NONE);
    setDue(localValue(editing?.dueAt ?? null));
    setConfirming(false);
  }, [open, editing]);
  const followed = useMemo(() => {
    const active = activeCourseIds(courses);
    return courses
      .filter((c) => active.has(c.id) || c.id === editing?.courseId)
      .map((c) => ({ id: c.id, name: courseAlias(c) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [courses, editing]);
  const ready = cleanTitle(title) !== null;
  const save = () => {
    if (!ready) return;
    onSave({ title, courseId: course === NONE ? null : (Number(course) as OwnTaskInput['courseId']), dueAt: fromLocal(due) });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>{editing ? t.ownEdit : t.ownAdd}</AlertDialogTitle>
        <AlertDialogDescription className="mt-2">{t.ownHelp}</AlertDialogDescription>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="space-y-1">
            <label htmlFor={ids.title} className="block text-[14px] font-medium">
              {t.ownTitle}
            </label>
            <Input id={ids.title} autoFocus value={title} maxLength={OWN_TITLE_MAX} placeholder={t.ownTitlePlaceholder} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label id={ids.course} className="block text-[14px] font-medium">
              {t.ownCourse}
            </label>
            <Select value={course} onValueChange={setCourse}>
              <SelectTrigger className="w-full" aria-labelledby={ids.course}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t.ownNoCourse}</SelectItem>
                {followed.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor={ids.due} className="block text-[14px] font-medium">
              {t.ownDue}
            </label>
            <Input id={ids.due} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            <p className="text-[12px] text-muted-foreground">{t.ownDueHelp}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {editing && onRemove && (
              <Button type="button" variant="outline" className="mr-auto" onClick={() => (confirming ? onRemove() : setConfirming(true))}>
                {confirming ? t.ownRemoveConfirm : t.ownRemove}
              </Button>
            )}
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline">
                {cancelLabel}
              </Button>
            </AlertDialogCancel>
            <Button type="submit" disabled={!ready}>
              {t.ownSave}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

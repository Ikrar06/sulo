import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AlertIcon, ChevronDownIcon } from '../icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Switch } from '../ui/switch';
import { isCourseActive } from '@sulo/core/courses/active-score';
import { assignCourseColors } from '@sulo/core/courses/colors';
import { courseAlias } from '@sulo/core/courses/display-name';
import { ALIAS_MAX } from '@sulo/core/courses/edit';
import { applyCourseEdit, partitionCourses, sikolaName, type CourseEdit } from '@sulo/core/courses/row';
import type { CourseAccess, UserData } from '@sulo/core/storage';
import type { CourseRecord } from '@sulo/core/types';
import { ColorSwatches } from './ColorSwatches';
import { PencilIcon } from '../dashboard-icons';
import { Card } from '../card';
import type { DashMessages } from '@sulo/core/i18n/dashboard';
import type { UpdateUser } from './done-undo';

/**
 * Courses as a compact list: color dot (popover with the swatches), the
 * display name edited in place, SIKOLA's name with the class code, and a
 * "Dipantau" switch. Not-followed courses sit in a closed section. Shared
 * by the dashboard and the Android app; `children` comes last (the
 * dashboard's NEOSIA mapping).
 */
export function MataKuliahList({ d, user, actions, children }: { d: DashMessages; user: UserData; actions: UpdateUser; children?: ReactNode }) {
  const t = d.mataKuliah;
  const [moved, setMoved] = useState<number | null>(null);
  const { followed, others } = partitionCourses(user.courses);
  const colors = assignCourseColors(followed);
  const access = user.radar.courseAccess ?? {};
  const edit = (id: number, change: CourseEdit) => {
    if (change.kind === 'monitor') setMoved(id);
    void actions.updateUser('courses', (list) => applyCourseEdit(list, id, change));
  };

  if (user.courses.length === 0) return <p className="text-[14px] text-muted-foreground">{t.empty}</p>;

  /** The color "Otomatis" would give this course right now. */
  const autoColorOf = (c: CourseRecord) => (isCourseActive(c) ? (assignCourseColors(followed.map((x) => (x.id === c.id ? { ...x, color: null } : x))).get(c.id) ?? null) : null);

  const row = (c: CourseRecord, followedRow: boolean) => (
    <CourseRow
      key={c.id}
      course={c}
      followed={followedRow}
      color={colors.get(c.id) ?? null}
      autoColor={autoColorOf(c)}
      access={access[String(c.id)]}
      entering={moved === c.id}
      d={d}
      onEdit={(change) => edit(c.id, change)}
    />
  );

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-muted-foreground">{t.lead}</p>
      <Card title={`${t.active} (${followed.length})`}>
        <ul className="-mx-2">{followed.map((c) => row(c, true))}</ul>
      </Card>
      {others.length > 0 && (
        <Collapsible className="rounded-xl border border-border bg-surface">
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-xl p-5 text-left outline-none focus-ring:ring-2 focus-ring:ring-focus">
            <span className="text-[16px] leading-6 font-semibold">{`${t.inactive} (${others.length})`}</span>
            <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-5 pb-5">
            <ul className="-mx-2">{others.map((c) => row(c, false))}</ul>
          </CollapsibleContent>
        </Collapsible>
      )}
      {children}
    </div>
  );
}

function CourseRow({ course, followed, color, autoColor, access, entering, d, onEdit }: {
  course: CourseRecord;
  followed: boolean;
  color: number | null;
  autoColor: number | null;
  access: CourseAccess | undefined;
  entering: boolean;
  d: DashMessages;
  onEdit: (edit: CourseEdit) => void;
}) {
  const t = d.mataKuliah;
  const name = courseAlias(course);
  const chosen = course.color ? Number(course.color.replace('course-', '')) : null;
  const colorName = chosen === null ? t.colorAuto : (t.colorNames[chosen - 1] ?? t.colorAuto);
  const [open, setOpen] = useState(false);
  return (
    <li className={`flex min-h-14 items-center gap-3 rounded-lg border-b border-border px-2 py-2 last:border-b-0 hover:bg-surface-raised/60 ${entering ? 'db-row-enter' : ''}`}>
      {followed && color !== null ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            aria-label={t.colorButton(name, colorName)}
            title={t.colorButton(name, colorName)}
            className="flex size-8 shrink-0 items-center justify-center rounded-full outline-none hover:bg-surface-raised focus-ring:ring-2 focus-ring:ring-focus"
          >
            <span aria-hidden="true" className="size-5 rounded-full" style={{ background: `var(--course-${color})` }} />
          </PopoverTrigger>
          <PopoverContent>
            <ColorSwatches value={chosen} onChange={(v) => onEdit({ kind: 'color', value: v })} onPick={() => setOpen(false)} label={t.colorFor(name)} autoLabel={t.colorAuto} names={t.colorNames} autoColor={autoColor} />
          </PopoverContent>
        </Popover>
      ) : (
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center">
          <span className="size-5 rounded-full border border-dashed border-muted-foreground" />
        </span>
      )}

      <div className={`min-w-0 flex-1 ${followed ? '' : 'text-muted-foreground'}`}>
        <InlineName course={course} name={name} label={t.editName(name)} muted={!followed} onSave={(value) => onEdit({ kind: 'alias', value })} />
        <p className="flex min-w-0 items-center gap-2 text-[12px] leading-5 text-muted-foreground">
          <span className="truncate" title={course.fullname}>
            {sikolaName(course)}
          </span>
          {course.parsed.code && <span className="shrink-0 rounded bg-surface-raised px-1 font-mono text-[12px] leading-5">{course.parsed.code}</span>}
        </p>
        {access && access.failures > 0 && (
          <p className="mt-1 flex items-start gap-2 text-[12px] leading-normal">
            <AlertIcon className="mt-1 size-3 shrink-0 text-urgency-soon" />
            <span>
              <span className="font-semibold text-foreground">{t.accessTitle}.</span> <span className="text-muted-foreground">{t.accessBody(access.failures)}</span>
            </span>
          </p>
        )}
      </div>

      <Switch checked={followed} onCheckedChange={(v) => onEdit({ kind: 'monitor', value: v })} aria-label={t.monitorFor(name)} title={t.monitored} />
    </li>
  );
}

/** The display name as text that becomes a field on click or Enter. Enter or leaving saves, Esc cancels; blank returns to SIKOLA's name. */
function InlineName({ course, name, label, muted, onSave }: { course: CourseRecord; name: string; label: string; muted: boolean; onSave: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const cancelled = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const start = () => {
    cancelled.current = false;
    setDraft(course.alias ?? name);
    setEditing(true);
  };
  const finish = () => {
    setEditing(false);
    if (!cancelled.current && draft.trim() !== (course.alias ?? name)) onSave(draft);
    requestAnimationFrame(() => button.current?.focus());
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelled.current = true;
      e.currentTarget.blur();
    }
  };

  if (editing)
    return (
      <input
        autoFocus
        aria-label={label}
        maxLength={ALIAS_MAX}
        value={draft}
        placeholder={courseAlias({ ...course, alias: null })}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={onKeyDown}
        className="-mx-1 h-6 w-full rounded border border-border bg-background px-1 text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus"
      />
    );
  return (
    <button
      ref={button}
      type="button"
      onClick={start}
      aria-label={label}
      title={name}
      className={`group -mx-1 flex max-w-full items-center gap-2 rounded px-1 text-left text-[14px] leading-6 font-semibold outline-none focus-ring:ring-2 focus-ring:ring-focus ${muted ? 'text-muted-foreground' : ''}`}
    >
      <span className="truncate">{name}</span>
      <PencilIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-ring:opacity-100" />
    </button>
  );
}

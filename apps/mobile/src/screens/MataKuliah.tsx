// Mata kuliah (M8c.1, cards): each course a card with its color tile (tap:
// a bottom sheet of colors), its display name (tap: rename in a sheet), the
// SIKOLA name and code, and a "Dipantau" switch. Not-followed courses sit in
// a section that folds. Edits go through core (courses/row applyCourseEdit).

import { useState } from 'react';
import { isCourseActive } from '@sulo/core/courses/active-score';
import { assignCourseColors } from '@sulo/core/courses/colors';
import { courseAlias } from '@sulo/core/courses/display-name';
import { ALIAS_MAX } from '@sulo/core/courses/edit';
import { applyCourseEdit, partitionCourses, sikolaName, type CourseEdit } from '@sulo/core/courses/row';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import type { CourseRecord } from '@sulo/core/types';
import { useI18n } from '@sulo/ui/i18n';
import { ChevronDownIcon } from '@sulo/ui/icons';
import { Card, EmptyCard } from '@sulo/ui/mobile/cards';
import { Toggle } from '@sulo/ui/mobile/controls';
import { Sheet } from '@sulo/ui/mobile/sheet';
import { initials, ON_SOLID, tintVar } from '@sulo/ui/mobile/tint';
import { Input } from '@sulo/ui/ui/input';
import { useMobileData } from '../shell/data';

const COLORS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function MataKuliahScreen() {
  const { locale } = useI18n();
  const d = mobileDash(locale);
  const w = mobileWords(locale);
  const t = d.mataKuliah;
  const { data, actions } = useMobileData();
  const user = data!.user!;
  const { followed, others } = partitionCourses(user.courses);
  const colors = assignCourseColors(followed);
  const [showOthers, setShowOthers] = useState(false);
  const [colorFor, setColorFor] = useState<CourseRecord | null>(null);
  const [renaming, setRenaming] = useState<CourseRecord | null>(null);
  const [name, setName] = useState('');
  const edit = (id: number, change: CourseEdit) => void actions.updateUser('courses', (list) => applyCourseEdit(list, id, change));
  /** The color "Otomatis" would give a course right now. */
  const autoColorOf = (c: CourseRecord) => (isCourseActive(c) ? (assignCourseColors(followed.map((x) => (x.id === c.id ? { ...x, color: null } : x))).get(c.id) ?? null) : null);

  if (user.courses.length === 0) return <EmptyCard text={t.empty} />;

  const card = (c: CourseRecord, on: boolean) => {
    const color = colors.get(c.id) ?? null;
    const display = courseAlias(c);
    return (
      <li key={c.id}>
        <Card dense className="flex items-center gap-3">
          <button
            type="button"
            disabled={!on}
            onClick={() => setColorFor(c)}
            aria-label={t.colorButton(display, color === null ? t.colorAuto : t.colorNames[color - 1]!)}
            className="m-hit m-press flex size-10 shrink-0 items-center justify-center rounded-ctl text-m13 font-semibold outline-none focus-ring:ring-2 focus-ring:ring-focus disabled:opacity-40"
            style={on ? { background: tintVar(color ? `course-${color}` : 'neutral'), ...ON_SOLID } : { background: 'var(--m-inset)', color: 'var(--muted)' }}
          >
            <span aria-hidden="true">{initials(display)}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setName(c.alias ?? '');
              setRenaming(c);
            }}
            aria-label={t.editName(display)}
            className="m-hit min-w-0 flex-1 rounded text-left outline-none focus-ring:ring-2 focus-ring:ring-focus"
          >
            <span className="block truncate text-m15">{display}</span>
            <span className="block truncate text-m12 font-normal text-muted-foreground">
              {sikolaName(c)}
              {c.parsed.code ? ` · ${c.parsed.code}` : ''}
            </span>
          </button>
          <Toggle checked={on} label={t.monitorFor(display)} onChange={(v) => edit(c.id, { kind: 'monitor', value: v })} />
        </Card>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <p className="text-m13 text-muted-foreground">{t.lead}</p>
      <section>
        <h2 className="mb-2 text-m13 font-semibold text-muted-foreground">
          {t.active} ({followed.length})
        </h2>
        <ul className="space-y-2">{followed.map((c) => card(c, true))}</ul>
      </section>
      {others.length > 0 && (
        <section>
          <button type="button" aria-expanded={showOthers} onClick={() => setShowOthers(!showOthers)} className="m-hit mb-2 flex w-full items-center justify-between rounded text-m13 font-semibold text-muted-foreground outline-none focus-ring:ring-2 focus-ring:ring-focus">
            {t.inactive} ({others.length})
            <ChevronDownIcon className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${showOthers ? 'rotate-180' : ''}`} />
          </button>
          {showOthers && <ul className="space-y-2">{others.map((c) => card(c, false))}</ul>}
        </section>
      )}

      <Sheet open={colorFor !== null} onOpenChange={(o) => !o && setColorFor(null)} title={colorFor ? t.colorFor(courseAlias(colorFor)) : t.color}>
        {colorFor && (
          <div role="radiogroup" aria-label={t.color} className="grid grid-cols-5 gap-3">
            {[null, ...COLORS].map((n) => {
              const chosen = (colorFor.color ? Number(colorFor.color.replace('course-', '')) : null) === n;
              const shown = n ?? autoColorOf(colorFor);
              return (
                <button
                  key={n ?? 'auto'}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  aria-label={n === null ? t.colorAuto : t.colorNames[n - 1]}
                  onClick={() => {
                    edit(colorFor.id, { kind: 'color', value: n });
                    setColorFor(null);
                  }}
                  className={`m-hit flex aspect-square items-center justify-center rounded-full text-m12 outline-none focus-ring:ring-2 focus-ring:ring-focus ${chosen ? 'ring-2 ring-foreground ring-offset-2 ring-offset-[var(--m-card)]' : ''}`}
                  style={shown ? { background: tintVar(`course-${shown}`), ...ON_SOLID } : { background: 'var(--m-inset)' }}
                >
                  {n === null && <span className="rounded-full bg-m-card px-2 text-m11 text-foreground">A</span>}
                </button>
              );
            })}
          </div>
        )}
      </Sheet>

      <Sheet open={renaming !== null} onOpenChange={(o) => !o && setRenaming(null)} title={t.displayName}>
        {renaming && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              edit(renaming.id, { kind: 'alias', value: name });
              setRenaming(null);
            }}
          >
            <Input autoFocus aria-label={t.displayName} maxLength={ALIAS_MAX} placeholder={sikolaName(renaming)} value={name} onChange={(e) => setName(e.target.value)} />
            <p className="mt-2 text-m13 text-muted-foreground">{t.displayNameHelp}</p>
            <div className="mt-4">
              <button type="submit" className="m-hit m-press inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-m15 text-primary-foreground outline-none focus-ring:ring-2 focus-ring:ring-focus">
                {w.app.doneSheet}
              </button>
            </div>
          </form>
        )}
      </Sheet>
    </div>
  );
}


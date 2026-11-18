// Tugas (M8c.1, cards). Header: the name, a round search button (opens the
// field) and Perbarui. Pill chips filter: Semua, Terlambat (n), Hari ini,
// Minggu ini, Selesai. Then the overview's groups (core groupTaskList), each
// task one card: the course chip and the time left in its urgency color,
// the title (two lines), the date and a 28 px check circle. Marking one done
// fills the circle, strikes the title and offers Urungkan for 5 seconds.

import { useMemo, useState } from 'react';
import { groupTaskList, type OverviewGroupKey } from '@sulo/core/dashboard/overview';
import { buildTaskItems, countByStatus, DEFAULT_TASK_FILTER, filterTasks, type TaskItem } from '@sulo/core/dashboard/tasks';
import { formatShortDate, taskDueLines } from '@sulo/core/format/time';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { urgencyOf } from '@sulo/core/tasks/group';
import { useDoneUndo } from '@sulo/ui/dashboard/done-undo';
import { XIcon } from '@sulo/ui/dashboard-icons';
import { useI18n } from '@sulo/ui/i18n';
import { SearchIcon } from '@sulo/ui/icons';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { Card, Chip, EmptyCard } from '@sulo/ui/mobile/cards';
import { CheckCircle, IconButton } from '@sulo/ui/mobile/controls';
import { courseTint } from '@sulo/ui/mobile/tint';
import { Input } from '@sulo/ui/ui/input';
import { timeZone, useMobileData } from '../shell/data';
import type { Screen } from '../shell/nav';
import { HeaderTools } from '../shell/screen-header';
import { LongList } from './LongList';

export const URGENCY_TEXT = { overdue: 'text-urgency-overdue', day: 'text-urgency-soon', threeDays: 'text-urgency-week', normal: 'text-muted-foreground' } as const;

type Filter = 'all' | 'overdue' | 'today' | 'week' | 'done';
/** Which overview groups each chip keeps ("Minggu ini" is today through the next seven days). */
const GROUPS: Record<Exclude<Filter, 'done'>, readonly OverviewGroupKey[] | null> = { all: null, overdue: ['overdue'], today: ['today'], week: ['today', 'tomorrow', 'week'] };

type Row = { kind: 'head'; key: string; label: string } | { kind: 'task'; item: TaskItem };

export function TugasScreen({ go }: { go: (s: Screen) => void }) {
  const { m, locale } = useI18n();
  const d = mobileDash(locale);
  const w = mobileWords(locale);
  const t = d.tugas;
  const { data, actions, platform } = useMobileData();
  const user = data!.user!;
  const now = data!.now;
  const items = useMemo(() => buildTaskItems(user), [user]);
  const counts = useMemo(() => countByStatus(items), [items]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const done = useDoneUndo(actions, d, data!.today, platform.store);

  const groups = useMemo(() => {
    const status = filter === 'done' ? 'done' : 'pending';
    const matching = filterTasks(items, { ...DEFAULT_TASK_FILTER, status: 'all', query }).filter((i) => i.status === status || done.lingering.has(i.task.eventId));
    return status === 'done' ? [{ key: 'next' as OverviewGroupKey, rows: matching }] : groupTaskList(matching.map((i) => ({ ...i, dueAt: i.task.dueAt })), now, timeZone);
  }, [items, query, filter, done.lingering, now]);
  const overdueCount = groups.find((g) => g.key === 'overdue')?.rows.length ?? 0;
  const keep = filter === 'done' ? null : GROUPS[filter];
  const rows = useMemo<Row[]>(
    () =>
      groups
        .filter((g) => keep === null || keep.includes(g.key))
        .flatMap((g): Row[] => [...(filter === 'done' ? [] : [{ kind: 'head' as const, key: `h-${g.key}`, label: d.ringkasan.groups[g.key] }]), ...g.rows.map((item) => ({ kind: 'task' as const, item }))]),
    [groups, keep, filter, d],
  );
  const taskCount = rows.filter((r) => r.kind === 'task').length;
  const allClear = filter !== 'done' && counts.pending === 0 && query.trim() === '';
  const chips: { value: Filter; label: string }[] = [
    { value: 'all', label: w.app.all },
    { value: 'overdue', label: overdueCount > 0 ? `${d.ringkasan.groups.overdue} (${overdueCount})` : d.ringkasan.groups.overdue },
    { value: 'today', label: d.ringkasan.groups.today },
    { value: 'week', label: d.ringkasan.groups.week },
    { value: 'done', label: w.app.done },
  ];

  return (
    <div className="space-y-3">
      <HeaderTools>
        <IconButton icon={searching ? XIcon : SearchIcon} label={searching ? w.app.closeSearch : w.app.search} onPress={() => (searching ? (setSearching(false), setQuery('')) : setSearching(true))} />
      </HeaderTools>
      {searching && (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus type="search" className="m-search rounded-full pl-10" placeholder={t.search} aria-label={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />{/* lint-ui-allow: pl-10 clears the search icon */}
        </div>
      )}
      <div role="group" aria-label={t.status} className="m-carousel -mx-4 flex gap-2 overflow-x-auto px-4">
        {chips.map((c) => (
          <Chip key={c.value} selected={filter === c.value} onPress={() => setFilter(c.value)}>
            {c.label}
          </Chip>
        ))}
      </div>
      <p className="sr-only" role="status">
        {t.count(taskCount)}
      </p>
      {taskCount === 0 ? (
        <EmptyCard mascot={allClear ? <Mascot state="idle" size={48} /> : undefined} text={allClear ? t.allClear : t.empty} />
      ) : (
        <LongList
          items={rows}
          keyOf={(r) => (r.kind === 'head' ? r.key : r.item.task.eventId)}
          className="space-y-2"
          rowHeight={104}
          render={(r) =>
            r.kind === 'head' ? (
              <h2 className="pt-3 pb-0 text-m13 font-semibold text-muted-foreground [li:first-child>&]:pt-0">{r.label}</h2>
            ) : (
              <TaskCard
                item={r.item}
                now={now}
                dueFormat={data!.prefs.dueFormat}
                collapsing={done.collapsing.has(r.item.task.eventId)}
                onOpen={() => go({ name: 'tugas', detail: String(r.item.task.eventId) })}
                onDone={(v) => (v ? done.mark(r.item.task.eventId, filter !== 'done' && counts.pending === 1) : done.unmark(r.item.task.eventId))}
                labels={t}
                m={m}
                locale={locale}
              />
            )
          }
        />
      )}
    </div>
  );
}

function TaskCard({ item, now, dueFormat, collapsing, onOpen, onDone, labels: t, m, locale }: { item: TaskItem; now: number; dueFormat: Parameters<typeof taskDueLines>[5]; collapsing: boolean; onOpen: () => void; onDone: (done: boolean) => void; labels: ReturnType<typeof mobileDash>['tugas']; m: ReturnType<typeof useI18n>['m']; locale: 'id' | 'en' }) {
  const due = item.task.dueAt;
  const isDone = item.status === 'done';
  const relative = due === null ? t.noDue : taskDueLines(due, now, timeZone, m, locale, dueFormat === 'countdown' ? 'countdown' : 'remaining').primary;
  const tone = due === null || isDone ? 'text-muted-foreground' : URGENCY_TEXT[urgencyOf(due, now)];
  return (
    <div className={collapsing ? 'db-collapse' : undefined}>
      <Card dense onPress={onOpen} label={item.task.name}>
        {/* Row 1: the course; the time left in its urgency color, then the date when it fits. */}
        <div className="flex items-center gap-2">
          <span className="min-w-0 shrink">
            <Chip small color={courseTint(item.courseColor)}>
              {item.courseName}
            </Chip>
          </span>
          <span className="ml-auto flex min-w-0 shrink-0 items-baseline justify-end overflow-hidden text-m12 whitespace-nowrap tabular-nums">
            <span className={tone}>{relative}</span>
            {due !== null && <span className="font-normal text-muted-foreground">&nbsp;· {formatShortDate(due, timeZone, m)}</span>}
          </span>
        </div>
        {/* Row 2: the title (two lines at most) and the check circle at its middle. */}
        <div className="mt-1 flex items-center gap-3">
          <p className={`line-clamp-2 min-w-0 flex-1 text-m15 ${isDone ? 'text-muted-foreground line-through' : ''}`}>{item.task.name}</p>
          {/* 28 px, centered on the title without making the row taller. */}
          <span className="-my-1 flex">
            <CheckCircle checked={isDone} onChange={onDone} label={`${isDone ? t.markUndone : t.markDone}: ${item.task.name}`} />
          </span>
        </div>
      </Card>
    </div>
  );
}

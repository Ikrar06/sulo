// Tugas (M8c.1, cards). Header: the name, a round search button (opens the
// field) and Perbarui. Pill chips filter: Semua, Terlambat (n), Hari ini,
// Minggu ini (all unfinished, by default), then the history (1.1.0): Selesai
// (marked done or handed in on SIKOLA), Dinilai, Sudah lama lewat: one list,
// newest first. Opening Tugas reads every followed course's grade report not read
// in the last hour (tasks/grade-sweep.ts, owner's exception of 27 Nov 2026); a read grade
// stands in a card's circle place, its number shown only with "Tampilkan
// nilai" (prefs.gradesShown, off by default), and the screen is kept out of
// screenshots while numbers are on it. Then the overview's groups (core groupTaskList), each
// task one card: the course chip and the time left in its urgency color,
// the title (two lines), the date and a 28 px check circle. Marking one done
// fills the circle, strikes the title and offers Urungkan for 5 seconds.

import { useEffect, useMemo, useState } from 'react';
import { gradeBadge } from '@sulo/core/tasks/grade-view';
import { groupTaskList, type OverviewGroupKey } from '@sulo/core/dashboard/overview';
import { buildTaskItems, countByStatus, DEFAULT_TASK_FILTER, filterTasks, isFinishedItem, type TaskItem } from '@sulo/core/dashboard/tasks';
import { formatShortDate, taskDueLines } from '@sulo/core/format/time';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { localParts } from '@sulo/core/reminders/zoned';
import { formatDateKey } from '@sulo/core/calendar/countdown';
import { urgencyOf } from '@sulo/core/tasks/group';
import { useDoneUndo } from '@sulo/ui/dashboard/done-undo';
import { EyeIcon, EyeOffIcon, XIcon } from '@sulo/ui/dashboard-icons';
import { useI18n } from '@sulo/ui/i18n';
import { SearchIcon } from '@sulo/ui/icons';
import { PlusIcon } from '@sulo/ui/dashboard-icons';
import { addOwnTask } from '@sulo/core/tasks/own';
import { SuloMascot } from '@sulo/ui/mascot/SuloMascot';
import { Card, Chip, EmptyCard } from '@sulo/ui/mobile/cards';
import { CheckCircle, IconButton, PillButton } from '@sulo/ui/mobile/controls';
import { TaskCardView } from '@sulo/ui/mobile/task-card';
import { courseTint } from '@sulo/ui/mobile/tint';
import { Input } from '@sulo/ui/ui/input';
import { timeZone, useMobileData } from '../shell/data';
import type { Screen } from '../shell/nav';
import { HeaderTools } from '../shell/screen-header';
import { useTaskDate } from '../shell/task-date';
import { LongList } from './LongList';
import { useSecureScreen } from '../neosia/secure-screen';
import { sweepGrades } from '../sync';
import { OwnTaskSheet } from './OwnTaskSheet';

export const URGENCY_TEXT = { overdue: 'text-urgency-overdue', day: 'text-urgency-soon', threeDays: 'text-urgency-week', normal: 'text-muted-foreground' } as const;

type HistoryFilter = 'done' | 'graded' | 'past';
type Filter = 'all' | 'overdue' | 'today' | 'week' | HistoryFilter;
/** Which overview groups each chip keeps ("Minggu ini" is today through the next seven days). */
const GROUPS: Record<Exclude<Filter, HistoryFilter>, readonly OverviewGroupKey[] | null> = { all: null, overdue: ['overdue'], today: ['today'], week: ['today', 'tomorrow', 'week'] };
const isHistory = (f: Filter): f is HistoryFilter => f === 'done' || f === 'graded' || f === 'past';
/** The history chips: what each keeps. Handed in on SIKOLA counts as done; "Dinilai" is any status. */
const inHistory = (i: TaskItem, f: HistoryFilter): boolean => (f === 'graded' ? i.graded : f === 'past' ? i.status === 'past' : i.status === 'done' || i.status === 'submitted');

type Row = { kind: 'head'; key: string; label: string } | { kind: 'task'; item: TaskItem };

export function TugasScreen({ go }: { go: (s: Screen) => void }) {
  const { m, locale } = useI18n();
  const d = mobileDash(locale);
  const w = mobileWords(locale);
  const t = d.tugas;
  const { data, actions, platform } = useMobileData();
  const user = data!.user!;
  const now = data!.now;
  const items = useMemo(() => buildTaskItems(user, t.own), [user, t.own]);
  const counts = useMemo(() => countByStatus(items), [items]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  // "Tambah tugas": work from a lecturer that SIKOLA does not have (tasks/own.ts).
  const [adding, setAdding] = useState(false);
  const done = useDoneUndo(actions, d, data!.today, platform.store);
  // A day tapped on Ringkasan's 7-day card: a temporary, removable filter.
  const { date, setDate } = useTaskDate();
  const dateLabel = date ? formatDateKey(date, m.intl, { weekday: 'short', day: 'numeric', month: 'short' }) : '';

  const groups = useMemo(() => {
    const history = isHistory(filter) ? filter : null;
    const matching = filterTasks(items, { ...DEFAULT_TASK_FILTER, status: 'all', query })
      .filter((i) => (history ? inHistory(i, history) : i.status === 'pending') || done.lingering.has(i.task.eventId))
      .filter((i) => date === null || (i.task.dueAt !== null && localParts(i.task.dueAt, timeZone).dateKey === date));
    // History reads newest first, in one list (undated ones, known from a grade report, last).
    return history
      ? [{ key: 'next' as OverviewGroupKey, rows: [...matching].sort((a, b) => (b.task.dueAt ?? 0) - (a.task.dueAt ?? 0)) }]
      : groupTaskList(matching.map((i) => ({ ...i, dueAt: i.task.dueAt })), now, timeZone);
  }, [items, query, filter, done.lingering, now, date]);
  const overdueCount = groups.find((g) => g.key === 'overdue')?.rows.length ?? 0;
  const keep = isHistory(filter) ? null : GROUPS[filter];
  const rows = useMemo<Row[]>(
    () =>
      groups
        .filter((g) => keep === null || keep.includes(g.key))
        .flatMap((g): Row[] => [...(isHistory(filter) ? [] : [{ kind: 'head' as const, key: `h-${g.key}`, label: d.ringkasan.groups[g.key] }]), ...g.rows.map((item) => ({ kind: 'task' as const, item }))]),
    [groups, keep, filter, d],
  );
  const taskCount = rows.filter((r) => r.kind === 'task').length;
  const allClear = !isHistory(filter) && counts.pending === 0 && query.trim() === '' && date === null;
  // Grades in the list: hidden until "Tampilkan nilai" (one remembered choice), masked in privacy mode.
  const view = { gradesShown: data!.prefs.gradesShown, privacyMode: data!.prefs.privacyMode };
  const anyGrade = rows.some((r) => r.kind === 'task' && r.item.gradeRead !== null);
  useSecureScreen(anyGrade && view.gradesShown && !view.privacyMode);
  // Opening Tugas checks a few courses' grades (not read in a day); what it marks done is said once.
  // Once per opening (the words come at render: an effect on them would start again and lose the answer).
  const [swept, setSwept] = useState(0);
  useEffect(() => {
    let live = true;
    void sweepGrades(platform)
      .then((r) => live && setSwept(r.markedDone))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [platform]);
  const sweepLine = swept > 0 ? t.gradesSwept(swept) : null;
  const chips: { value: Filter; label: string }[] = [
    { value: 'all', label: w.app.all },
    { value: 'overdue', label: overdueCount > 0 ? `${d.ringkasan.groups.overdue} (${overdueCount})` : d.ringkasan.groups.overdue },
    { value: 'today', label: d.ringkasan.groups.today },
    { value: 'week', label: d.ringkasan.groups.week },
    { value: 'done', label: w.app.done },
    { value: 'graded', label: w.app.graded },
    { value: 'past', label: w.app.past },
  ];

  return (
    <div className="space-y-3">
      <HeaderTools>
        <IconButton icon={PlusIcon} label={t.ownAdd} onPress={() => setAdding(true)} />
        <IconButton icon={searching ? XIcon : SearchIcon} label={searching ? w.app.closeSearch : w.app.search} onPress={() => (searching ? (setSearching(false), setQuery('')) : setSearching(true))} />
      </HeaderTools>
      {searching && (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus type="search" className="m-search rounded-full pl-10" placeholder={t.search} aria-label={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />{/* lint-ui-allow: pl-10 clears the search icon */}
        </div>
      )}
      <div role="group" aria-label={t.status} className="m-carousel -mx-4 flex gap-2 overflow-x-auto px-4">
        {date && (
          <button type="button" onClick={() => setDate(null)} aria-label={w.app.clearDate(dateLabel)} className="m-hit inline-flex h-[30px] shrink-0 items-center gap-1 rounded-full bg-foreground pr-2 pl-3 text-m12 text-bg outline-none focus-ring:ring-2 focus-ring:ring-focus">
            {dateLabel}
            <XIcon aria-hidden="true" className="size-4" />
          </button>
        )}
        {chips.map((c) => (
          <Chip key={c.value} selected={filter === c.value} onPress={() => setFilter(c.value)}>
            {c.label}
          </Chip>
        ))}
      </div>
      <p className="sr-only" role="status">
        {t.count(taskCount)}
      </p>
      {sweepLine && (
        <p role="status" className="m-data-in text-m13 text-muted-foreground">
          {sweepLine}
        </p>
      )}
      {isHistory(filter) && anyGrade && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-m13 text-muted-foreground">{view.gradesShown ? '' : t.gradesHidden}</p>
          <PillButton small icon={view.gradesShown ? EyeOffIcon : EyeIcon} onPress={() => void actions.setPrefs({ gradesShown: !view.gradesShown })}>
            {view.gradesShown ? t.gradesHide : t.gradesShow}
          </PillButton>
        </div>
      )}
      {taskCount === 0 ? (
        <EmptyCard mascot={allClear ? <SuloMascot mood="neutral" size={48} /> : undefined} text={allClear ? t.allClear : t.empty} />
      ) : (
        <LongList
          items={rows}
          keyOf={(r) => (r.kind === 'task' ? r.item.task.eventId : r.key)}
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
                onDone={(v) => (v ? done.mark(r.item.task.eventId, !isHistory(filter) && counts.pending === 1) : done.unmark(r.item.task.eventId))}
                labels={t}
                m={m}
                locale={locale}
                grade={gradeBadge(r.item.gradeRead, view, m.intl)}
              />
            )
          }
        />
      )}
      <OwnTaskSheet
        open={adding}
        onOpenChange={setAdding}
        editing={null}
        courses={user.courses}
        onSave={(input) => {
          void actions.updateUser('ownTasks', (list) => addOwnTask(list, input, platform.clock.now()));
          setAdding(false);
        }}
      />
    </div>
  );
}

function TaskCard({ item, now, dueFormat, collapsing, onOpen, onDone, labels: t, m, locale, grade = null }: { item: TaskItem; now: number; dueFormat: Parameters<typeof taskDueLines>[5]; collapsing: boolean; onOpen: () => void; onDone: (done: boolean) => void; labels: ReturnType<typeof mobileDash>['tugas']; m: ReturnType<typeof useI18n>['m']; locale: 'id' | 'en'; grade?: ReturnType<typeof gradeBadge> }) {
  const due = item.task.dueAt;
  const isDone = item.status === 'done';
  // A finished task (done, handed in, long past or graded) has no time left to count: its date, quiet.
  const finished = isFinishedItem(item);
  // Known only from its course's grade report: no due date to show.
  const relative = due === null ? (item.task.fromReport ? '' : t.noDue) : finished ? formatShortDate(due, timeZone, m) : taskDueLines(due, now, timeZone, m, locale, dueFormat === 'countdown' ? 'countdown' : 'remaining').primary;
  const tone = due === null || finished ? 'text-muted-foreground' : URGENCY_TEXT[urgencyOf(due, now)];
  return (
    <div className={collapsing ? 'db-collapse' : undefined}>
      <TaskCardView
        course={item.courseName}
        color={courseTint(item.courseColor)}
        title={item.task.name}
        relative={relative}
        tone={tone}
        date={due !== null && !finished ? <span className="font-normal text-muted-foreground">&nbsp;· {formatShortDate(due, timeZone, m)}</span> : undefined}
        done={isDone}
        grade={grade}
        gradeLabels={{ graded: t.gradedBadge, value: t.gradeValueLabel, masked: t.gradedBadge }}
        doneLabel={`${isDone ? t.markUndone : t.markDone}: ${item.task.name}`}
        onDone={onDone}
        onOpen={onOpen}
      />
    </div>
  );
}

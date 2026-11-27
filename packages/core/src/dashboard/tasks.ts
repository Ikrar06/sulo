// The dashboard's task list: every task with its status, course and local
// state, plus filters. Pure; the page only renders.

import { activeCourseIds } from '../courses/active-score';
import { assignCourseColors } from '../courses/colors';
import { courseAlias } from '../courses/display-name';
import type { UserData } from '../storage';
import { getTaskState } from '../tasks/local-state';
import { applyPersonalDue } from '../tasks/personal-due';
import type { CourseId, Task, TaskLocalState } from '../types';
import { followsTask, isOwnTask } from '../tasks/own';
import { gradedCmIds, isGraded } from '../tasks/grade-view';
import type { AssignGrade } from '../tasks/grade';

/**
 * pending: waiting; done: marked done; submitted: gone from the SIKOLA calendar (probably handed in); past: its
 * due date left the calendar window before Sulo saw it handed in (tasks/from-calendar.ts); inactive: course not
 * active.
 */
export type TaskStatus = 'pending' | 'done' | 'submitted' | 'past' | 'inactive';
/** A status, every task, or the ones Sulo knows were graded (tasks/grade-view.ts), whatever their status. */
export type TaskStatusFilter = TaskStatus | 'all' | 'graded';

export interface TaskItem {
  task: Task;
  status: TaskStatus;
  personalDue: boolean;
  state: TaskLocalState;
  courseName: string;
  /** 1..8 course color token. */
  courseColor: number;
  /** SIKOLA sent a grade or feedback notification about it, or "Lihat nilai" found a grade. */
  graded: boolean;
  /** The grade "Lihat nilai" read (it stands in the done circle's place in the lists); null when none was read. */
  gradeRead: Extract<AssignGrade, { kind: 'graded' }> | null;
}

/** `ownLabel`: the name shown for a task the student added without a course ("Tugas sendiri"), from the caller's words. */
export function buildTaskItems(user: Pick<UserData, 'tasks' | 'taskState' | 'courses'> & Partial<Pick<UserData, 'changes' | 'taskGrades'>>, ownLabel = ''): TaskItem[] {
  const active = activeCourseIds(user.courses);
  const graded = gradedCmIds(user.changes ?? [], user.taskGrades ?? {});
  const colors = assignCourseColors(user.courses.filter((c) => active.has(c.id)));
  const byId = new Map(user.courses.map((c) => [c.id, c]));
  const { tasks, personal } = applyPersonalDue(user.tasks, user.taskState);
  return tasks.map((task) => {
    const state = getTaskState(user.taskState, task.eventId);
    // An added task (tasks/own.ts) is never "inactive": the student added it on purpose.
    const status: TaskStatus = state.doneManually ? 'done' : task.missingSince !== null ? (task.pastWindow ? 'past' : 'submitted') : !followsTask(active, task) ? 'inactive' : 'pending';
    const course = byId.get(task.courseId);
    return {
      task,
      status,
      personalDue: personal.has(task.eventId),
      state,
      courseName: course ? courseAlias(course) : isOwnTask(task) ? ownLabel : '',
      courseColor: colors.get(task.courseId) ?? 1,
      graded: isGraded(task, graded),
      gradeRead: readGrade(task, user.taskGrades),
    };
  });
}

function readGrade(task: Task, answers: UserData['taskGrades'] | undefined): TaskItem['gradeRead'] {
  if (task.module !== 'assign' || task.cmId === null) return null;
  const grade = answers?.[String(task.cmId)]?.grade;
  return grade?.kind === 'graded' ? grade : null;
}

/** Whether a task belongs under a status filter: "Sudah dinilai" is any status Sulo knows was graded. */
export function matchesStatus(item: Pick<TaskItem, 'status' | 'graded'>, status: TaskStatusFilter): boolean {
  return status === 'all' || (status === 'graded' ? item.graded : item.status === status);
}

/**
 * A finished task: marked done, handed in on SIKOLA, long past or graded. No countdown, and nothing to add to a
 * calendar any more (owner, 27 Nov 2026).
 */
export const isFinishedItem = (i: Pick<TaskItem, 'status' | 'gradeRead'>): boolean => i.status === 'done' || i.status === 'submitted' || i.status === 'past' || i.gradeRead !== null;

/** The status filters that list finished tasks (in course groups, with "Lihat nilai"). */
export const isHistoryStatus = (status: TaskStatusFilter): boolean => status === 'graded' || status === 'done' || status === 'submitted' || status === 'past';

export interface TaskFilter {
  courseId: CourseId | null;
  status: TaskStatusFilter;
  query: string;
}

export const DEFAULT_TASK_FILTER: TaskFilter = { courseId: null, status: 'pending', query: '' };

const normalize = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Filters, then sorts: dated tasks by due time, undated last, then by name. */
export function filterTasks(items: readonly TaskItem[], filter: TaskFilter): TaskItem[] {
  const q = normalize(filter.query.trim());
  return items
    .filter((i) => matchesStatus(i, filter.status))
    .filter((i) => filter.courseId === null || i.task.courseId === filter.courseId)
    .filter((i) => !q || normalize(`${i.task.name} ${i.courseName} ${i.state.note}`).includes(q))
    .sort((a, b) => (a.task.dueAt ?? Infinity) - (b.task.dueAt ?? Infinity) || a.task.name.localeCompare(b.task.name));
}

export function countByStatus(items: readonly TaskItem[]): Record<TaskStatus | 'graded', number> {
  const out: Record<TaskStatus | 'graded', number> = { pending: 0, done: 0, submitted: 0, past: 0, inactive: 0, graded: 0 };
  for (const i of items) {
    out[i.status] += 1;
    if (i.graded) out.graded += 1;
  }
  return out;
}

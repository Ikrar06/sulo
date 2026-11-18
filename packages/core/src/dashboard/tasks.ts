// The dashboard's task list: every task with its status, course and local
// state, plus filters. Pure; the page only renders.

import { activeCourseIds } from '../courses/active-score';
import { assignCourseColors } from '../courses/colors';
import { courseAlias } from '../courses/display-name';
import type { UserData } from '../storage';
import { getTaskState } from '../tasks/local-state';
import { applyPersonalDue } from '../tasks/personal-due';
import type { CourseId, Task, TaskLocalState } from '../types';

/** pending: waiting; done: marked done; submitted: gone from the SIKOLA calendar (probably handed in); inactive: course not active. */
export type TaskStatus = 'pending' | 'done' | 'submitted' | 'inactive';
export type TaskStatusFilter = TaskStatus | 'all';

export interface TaskItem {
  task: Task;
  status: TaskStatus;
  personalDue: boolean;
  state: TaskLocalState;
  courseName: string;
  /** 1..8 course color token. */
  courseColor: number;
}

export function buildTaskItems(user: Pick<UserData, 'tasks' | 'taskState' | 'courses'>): TaskItem[] {
  const active = activeCourseIds(user.courses);
  const colors = assignCourseColors(user.courses.filter((c) => active.has(c.id)));
  const byId = new Map(user.courses.map((c) => [c.id, c]));
  const { tasks, personal } = applyPersonalDue(user.tasks, user.taskState);
  return tasks.map((task) => {
    const state = getTaskState(user.taskState, task.eventId);
    const status: TaskStatus = state.doneManually ? 'done' : task.missingSince !== null ? 'submitted' : !active.has(task.courseId) ? 'inactive' : 'pending';
    const course = byId.get(task.courseId);
    return { task, status, personalDue: personal.has(task.eventId), state, courseName: course ? courseAlias(course) : '', courseColor: colors.get(task.courseId) ?? 1 };
  });
}

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
    .filter((i) => filter.status === 'all' || i.status === filter.status)
    .filter((i) => filter.courseId === null || i.task.courseId === filter.courseId)
    .filter((i) => !q || normalize(`${i.task.name} ${i.courseName} ${i.state.note}`).includes(q))
    .sort((a, b) => (a.task.dueAt ?? Infinity) - (b.task.dueAt ?? Infinity) || a.task.name.localeCompare(b.task.name));
}

export function countByStatus(items: readonly TaskItem[]): Record<TaskStatus, number> {
  const out: Record<TaskStatus, number> = { pending: 0, done: 0, submitted: 0, inactive: 0 };
  for (const i of items) out[i.status] += 1;
  return out;
}

// New grades from NEOSIA (M7 part E6): after a transcript capture, rows that
// gained a letter grade become "neosia_grade" entries in the current
// account's "Kabar terbaru" log, which the notification planner already
// sends (kind "Nilai", quiet hours, the grades setting). The entry and the
// notification name the course only, never the letter. Pure; the store is
// injected.

import { courseAlias, toDisplayCase } from '../courses/display-name';
import { appendChanges } from '../radar/log';
import { currentUser, readUser, writeUserIfCurrent } from '../storage';
import type { Change, CourseRecord, KeyValueStore, UnixSeconds } from '../types';
import { linkCourse, readCourseMap, type CourseMap } from './course-map';
import type { IngestResult } from './store';
import { newGrades } from './view';

export function gradeChanges(result: IngestResult, courses: readonly CourseRecord[], map: CourseMap): Change[] {
  if (result.kind !== 'stored' || result.endpoint !== 'getTranskripMahasiswa' || result.baseline || !result.changed) return [];
  return newGrades(result.previous?.data ?? null, result.next.data).map((row) => {
    const link = linkCourse({ code: row.code, name: row.name, className: null }, courses, map);
    return { kind: 'neosia_grade', courseId: link?.course.id ?? null, key: row.key, name: link ? courseAlias(link.course) : toDisplayCase(row.name) };
  });
}

/** Appends new-grade entries to the current account's log; nothing without an account. */
export async function recordGrades(store: KeyValueStore, now: UnixSeconds, result: IngestResult): Promise<number> {
  if (result.kind !== 'stored' || result.endpoint !== 'getTranskripMahasiswa') return 0;
  const userId = await currentUser(store);
  if (userId === null) return 0;
  const [courses, map] = await Promise.all([readUser(store, userId, 'courses'), readCourseMap(store)]);
  const changes = gradeChanges(result, courses, map);
  if (changes.length === 0) return 0;
  const log = await readUser(store, userId, 'changes');
  await writeUserIfCurrent(store, userId, 'changes', appendChanges(log, changes, now));
  return changes.length;
}

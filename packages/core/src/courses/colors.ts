import type { CourseId, CourseRecord } from '../types';
import { courseAlias } from './display-name';

/**
 * Number of course dot colors (tokens --course-1 .. --course-8). Twelve were
 * measured too close to tell apart at dot size, so eight colors repeat.
 */
export const COURSE_COLOR_COUNT = 8;

const USER_COLOR = /^course-([1-8])$/;

/**
 * Default color per course: courses sorted by display name get colors in
 * turn, so two courses sharing a color are always eight places apart and
 * never next to each other. A user-chosen color ("course-N", dashboard in
 * M5a) is kept as is.
 */
export function assignCourseColors(courses: readonly Pick<CourseRecord, 'id' | 'alias' | 'parsed' | 'color'>[]): Map<CourseId, number> {
  const sorted = [...courses].sort((a, b) => courseAlias(a).localeCompare(courseAlias(b), 'id') || a.id - b.id);
  return new Map(
    sorted.map((c, i) => {
      const user = c.color ? USER_COLOR.exec(c.color) : null;
      return [c.id, user ? Number(user[1]) : (i % COURSE_COLOR_COUNT) + 1];
    }),
  );
}

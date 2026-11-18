// NEOSIA meetings with their SIKOLA course (M7 part E4): the linked course
// gives the display name and dot color the rest of Sulo uses. Pure.

import { activeCourseIds } from '../courses/active-score';
import { assignCourseColors } from '../courses/colors';
import { courseAlias, toDisplayCase } from '../courses/display-name';
import type { CourseRecord } from '../types';
import { linkCourse, neosiaKey, type CourseMap } from './course-map';
import type { ClassMeeting } from './view';

export interface LinkedMeeting extends ClassMeeting {
  key: string;
  course: CourseRecord | null;
  how: 'code' | 'manual' | null;
  /** The course's display name in Sulo, else NEOSIA's name in display case. */
  displayName: string;
  /** 1..8 like task rows, only for a linked course that is followed. */
  color: number | null;
}

export function linkedMeetings(meetings: readonly ClassMeeting[], courses: readonly CourseRecord[], map: CourseMap): LinkedMeeting[] {
  const active = activeCourseIds(courses);
  const colors = assignCourseColors(courses.filter((c) => active.has(c.id)));
  return meetings.map((m) => {
    const link = linkCourse(m, courses, map);
    return {
      ...m,
      key: neosiaKey(m),
      course: link?.course ?? null,
      how: link?.how ?? null,
      displayName: link ? courseAlias(link.course) : toDisplayCase(m.name),
      color: link ? (colors.get(link.course.id) ?? null) : null,
    };
  });
}

/** One row per NEOSIA course (a course meets more than once a week). */
export function distinctCourses(meetings: readonly LinkedMeeting[]): LinkedMeeting[] {
  const seen = new Set<string>();
  return meetings.filter((m) => (seen.has(m.key) ? false : (seen.add(m.key), true)));
}

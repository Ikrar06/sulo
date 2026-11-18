// NEOSIA meetings with their SIKOLA course (M7 part E4): the linked course
// gives the display name and dot color the rest of Sulo uses. Pure.

import { activeCourseIds } from '../courses/active-score';
import { assignCourseColors } from '../courses/colors';
import { courseAlias, toDisplayCase } from '../courses/display-name';
import type { CourseRecord } from '../types';
import { classSuffix } from './class-name';
import { linkCourse, neosiaKey, type CourseMap } from './course-map';
import type { ClassMeeting } from './view';

export interface LinkedMeeting extends ClassMeeting {
  key: string;
  course: CourseRecord | null;
  how: 'code' | 'manual' | null;
  /** The course's display name in Sulo, else NEOSIA's short (or official) name in display case. */
  displayName: string;
  /** What the NEOSIA class name adds to the course name ("B", "Kls. Informatika"), or null. */
  classLabel: string | null;
  /** The user chose "Tidak ada di SIKOLA": no "not linked" mark. */
  optedOut: boolean;
  /** 1..8 like task rows, only for a linked course that is followed. */
  color: number | null;
}

export function linkedMeetings(meetings: readonly ClassMeeting[], courses: readonly CourseRecord[], map: CourseMap): LinkedMeeting[] {
  const active = activeCourseIds(courses);
  const colors = assignCourseColors(courses.filter((c) => active.has(c.id)));
  return meetings.map((m) => {
    const link = linkCourse(m, courses, map);
    const key = neosiaKey(m);
    const displayName = link ? courseAlias(link.course) : toDisplayCase(m.shortName ?? m.name);
    return {
      ...m,
      key,
      course: link?.course ?? null,
      how: link?.how ?? null,
      displayName,
      classLabel: classSuffix(m.className, [m.name, m.shortName, displayName]),
      optedOut: key in map && map[key] === null,
      color: link ? (colors.get(link.course.id) ?? null) : null,
    };
  });
}

/** One row per NEOSIA course (a course meets more than once a week). */
export function distinctCourses(meetings: readonly LinkedMeeting[]): LinkedMeeting[] {
  const seen = new Set<string>();
  return meetings.filter((m) => (seen.has(m.key) ? false : (seen.add(m.key), true)));
}

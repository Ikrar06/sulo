import type { FunctionData } from '../moodle/schemas';
import type { CourseId, CourseRecord, UnixSeconds } from '../types';
import { scoreCourse } from './active-score';
import { parseCourseName } from './parse-name';

type EnrolledCourse = FunctionData<'core_course_get_enrolled_courses_by_timeline_classification'>['courses'][number];

export interface BuildCoursesInput {
  all: readonly EnrolledCourse[];
  inProgressIds: ReadonlySet<CourseId>;
  /** Courses with a calendar event due now or later. */
  upcomingCourseIds: ReadonlySet<CourseId>;
  previous: readonly CourseRecord[];
  now: UnixSeconds;
}

/**
 * Builds course records from the course list, keeping the user's pins,
 * aliases and colors. "past" is everything that is neither in
 * progress nor in the future: the list is fetched as "all" plus "inprogress"
 * in one batch, and future courses are not expected mid-semester.
 */
export function buildCourses(input: BuildCoursesInput): CourseRecord[] {
  const previousById = new Map(input.previous.map((c) => [c.id, c]));
  return input.all.map((c) => {
    const prev = previousById.get(c.id);
    const inProgress = input.inProgressIds.has(c.id);
    const past = !inProgress && c.enddate > 0 && c.enddate < input.now;
    const { score, reasons } = scoreCourse(
      { inProgress, past, enddate: c.enddate, hasUpcomingEvents: input.upcomingCourseIds.has(c.id) },
      input.now,
    );
    return {
      id: c.id,
      fullname: c.fullname,
      shortname: c.shortname,
      startdate: c.startdate,
      enddate: c.enddate,
      parsed: parseCourseName(c.fullname),
      inProgress,
      past,
      activeScore: score,
      activeReasons: reasons,
      activePin: prev?.activePin ?? null,
      alias: prev?.alias ?? null,
      color: prev?.color ?? null,
    };
  });
}

/** In-progress course ids that the user has not seen at their last confirmation. */
export function newInProgressIds(current: readonly CourseRecord[], confirmed: readonly CourseId[]): CourseId[] {
  const seen = new Set(confirmed);
  return current.filter((c) => c.inProgress && !seen.has(c.id)).map((c) => c.id);
}

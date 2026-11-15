import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTIVE_THRESHOLD, activeCourseIds, isCourseActive, scoreCourse } from '../lib/courses/active-score';
import { buildCourses, newInProgressIds } from '../lib/courses/build';
import { parseCall } from '../lib/moodle/schemas';
import type { CourseRecord } from '../lib/types';

const DAY = 86_400;
const NOW = 1_790_000_000;

const enrolled = () => {
  const data = JSON.parse(readFileSync(new URL('../fixtures/synthetic/enrolled-courses.normal.json', import.meta.url), 'utf8'));
  const parsed = parseCall('core_course_get_enrolled_courses_by_timeline_classification', { ok: true, data });
  if (!parsed.ok) throw new Error('fixture invalid');
  return parsed.data.courses;
};

describe('scoreCourse', () => {
  it('weights in-progress as the main signal', () => {
    expect(scoreCourse({ inProgress: true, past: false, enddate: NOW + 30 * DAY, hasUpcomingEvents: false }, NOW)).toEqual({
      score: 6,
      reasons: ['inprogress', 'enddate_future'],
    });
  });

  it('adds upcoming events as support', () => {
    expect(scoreCourse({ inProgress: false, past: false, enddate: NOW + DAY, hasUpcomingEvents: true }, NOW).score).toBe(4);
  });

  it('penalises past courses and long-ended ones', () => {
    expect(scoreCourse({ inProgress: false, past: true, enddate: NOW - 60 * DAY, hasUpcomingEvents: false }, NOW)).toEqual({
      score: -7,
      reasons: ['past', 'ended_long_ago'],
    });
  });

  it('a course with only a future end date stays below the threshold', () => {
    expect(scoreCourse({ inProgress: false, past: false, enddate: NOW + DAY, hasUpcomingEvents: false }, NOW).score).toBeLessThan(
      ACTIVE_THRESHOLD,
    );
  });

  it('lets a manual pin win over the score', () => {
    expect(isCourseActive({ activePin: false, activeScore: 10 })).toBe(false);
    expect(isCourseActive({ activePin: true, activeScore: -7 })).toBe(true);
    expect(isCourseActive({ activePin: null, activeScore: 4 })).toBe(true);
  });
});

describe('buildCourses', () => {
  it('scores the synthetic list and keeps the user pin, alias and label', () => {
    const courses = enrolled();
    const previous = [{ id: 403, activePin: true, alias: 'Kesehatan', label: 'KS', color: '#123456' } as CourseRecord];
    const result = buildCourses({
      all: courses,
      inProgressIds: new Set([401, 402, 403]),
      upcomingCourseIds: new Set([401]),
      previous,
      now: NOW,
    });
    const byId = new Map(result.map((c) => [c.id, c]));
    expect(byId.get(401)?.activeReasons).toEqual(['inprogress', 'enddate_future', 'upcoming_events']);
    expect(byId.get(404)?.past).toBe(true);
    expect(byId.get(404)?.activeReasons).toContain('ended_long_ago');
    expect(byId.get(403)).toMatchObject({ activePin: true, alias: 'Kesehatan', label: 'KS', color: '#123456' });
    expect(byId.get(401)?.parsed.matched).toBe(true);
    expect(byId.get(401)?.parsed.code).toMatch(/^[0-9A-Z]{11}$/);
    expect([...activeCourseIds(result)].sort()).toEqual([401, 402, 403]);
  });

  it('reports in-progress courses the user has not confirmed yet', () => {
    const result = buildCourses({ all: enrolled(), inProgressIds: new Set([401, 402]), upcomingCourseIds: new Set(), previous: [], now: NOW });
    expect(newInProgressIds(result, [401])).toEqual([402]);
    expect(newInProgressIds(result, [401, 402])).toEqual([]);
  });
});

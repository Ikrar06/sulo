// Linking NEOSIA classes to SIKOLA courses (M7 part E4). Automatic by
// course code: SIKOLA fullnames carry the same 11-character code in square
// brackets (lib/courses/parse-name.ts). Where that fails, the user links a
// class on the Mata kuliah page; that choice wins. Pure; the store is
// injected for the two storage helpers.

import type { CourseId, CourseRecord, KeyValueStore } from '../types';
import { NEOSIA_DATA_PREFIX } from './module';

export const COURSE_MAP_KEY = `${NEOSIA_DATA_PREFIX}courseMap`;

/** NEOSIA key (code, or the name when there is no code) → SIKOLA course id, or null for "not linked". */
export type CourseMap = Readonly<Record<string, CourseId | null>>;

export const neosiaKey = (c: { code: string | null; name: string }) => c.code ?? `name:${c.name}`;

export async function readCourseMap(store: KeyValueStore): Promise<CourseMap> {
  const raw = await store.get<Record<string, unknown>>(COURSE_MAP_KEY);
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v === null || (typeof v === 'number' && Number.isInteger(v)))) as CourseMap;
}

export async function setCourseLink(store: KeyValueStore, key: string, courseId: CourseId | null): Promise<void> {
  await store.set(COURSE_MAP_KEY, { ...(await readCourseMap(store)), [key]: courseId });
}

export type Link = { course: CourseRecord; how: 'code' | 'manual' } | null;

/**
 * The SIKOLA course for a NEOSIA class. A manual choice wins (null means
 * "do not link"). By code, several SIKOLA courses can share one (classes A
 * and B): the one with the same class letter, then one in progress, wins.
 */
export function linkCourse(cls: { code: string | null; name: string; className: string | null }, courses: readonly CourseRecord[], map: CourseMap): Link {
  const key = neosiaKey(cls);
  if (key in map) {
    const id = map[key];
    const course = id === null ? undefined : courses.find((c) => c.id === id);
    return course ? { course, how: 'manual' } : null;
  }
  if (!cls.code) return null;
  const same = courses.filter((c) => c.parsed.code === cls.code);
  if (same.length === 0) return null;
  const letter = cls.className?.trim().toUpperCase() ?? null;
  const pick = same.find((c) => letter !== null && c.parsed.classLetter === letter) ?? same.find((c) => c.inProgress) ?? same[0]!;
  return { course: pick, how: 'code' };
}

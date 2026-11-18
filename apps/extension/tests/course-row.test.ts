import { describe, expect, it } from 'vitest';
import { applyCourseEdit, partitionCourses, sikolaName } from '@sulo/core/courses/row';
import type { CourseRecord } from '@sulo/core/types';

// Made-up course names and codes only (docs/TESTING.md).
const course = (id: number, name: string, extra: Partial<CourseRecord> = {}): CourseRecord => ({
  id,
  fullname: `${name.toUpperCase()} B (CONTOH) [23D0000000${id}]`,
  shortname: name,
  startdate: 0,
  enddate: 0,
  parsed: { name: name.toUpperCase(), classLetter: 'B', program: 'CONTOH', code: `23D0000000${id}`, matched: true },
  inProgress: true,
  past: false,
  activeScore: 5,
  activeReasons: [],
  activePin: null,
  alias: null,
  color: null,
  ...extra,
});

describe('applyCourseEdit', () => {
  const list = [course(1, 'Analisa Struktur I'), course(2, 'Hidrologi Dasar')];

  it('saves a display name, trimmed, without touching the original list', () => {
    const next = applyCourseEdit(list, 1, { kind: 'alias', value: '  Anstruk  1 ' });
    expect(next[0]?.alias).toBe('Anstruk 1');
    expect(next[1]).toBe(list[1]);
    expect(list[0]?.alias).toBeNull();
  });

  it('an empty display name goes back to the cleaned SIKOLA name', () => {
    const named = applyCourseEdit(list, 1, { kind: 'alias', value: 'Anstruk' });
    const cleared = applyCourseEdit(named, 1, { kind: 'alias', value: '   ' });
    expect(cleared[0]?.alias).toBeNull();
  });

  it('changes the color, and null returns to automatic', () => {
    const red = applyCourseEdit(list, 2, { kind: 'color', value: 1 });
    expect(red[1]?.color).toBe('course-1');
    expect(applyCourseEdit(red, 2, { kind: 'color', value: null })[1]?.color).toBeNull();
  });

  it('toggles following, which moves the course between the two lists', () => {
    const off = applyCourseEdit(list, 1, { kind: 'monitor', value: false });
    expect(off[0]?.activePin).toBe(false);
    expect(partitionCourses(off).others.map((c) => c.id)).toEqual([1]);
    const on = applyCourseEdit(off, 1, { kind: 'monitor', value: true });
    expect(partitionCourses(on).followed.map((c) => c.id)).toEqual([1, 2]);
  });
});

describe('sikolaName', () => {
  it('title case with the class letter, never all caps; the code is left out', () => {
    expect(sikolaName(course(1, 'Analisa Struktur I'))).toBe('Analisa Struktur I B');
  });
  it('an unmatched name is the full name in title case', () => {
    expect(sikolaName({ fullname: 'PRAKTIKUM LAPANGAN', parsed: { name: 'PRAKTIKUM LAPANGAN', classLetter: null, program: null, code: null, matched: false } })).toBe('Praktikum Lapangan');
  });
});

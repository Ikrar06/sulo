import { describe, expect, it } from 'vitest';
import { courseAlias, courseNameWithClass, toDisplayCase } from '@sulo/core/courses/display-name';
import { parseCourseName } from '@sulo/core/courses/parse-name';
import { assignCourseColors, COURSE_COLOR_COUNT } from '@sulo/core/courses/colors';
import type { CourseRecord } from '@sulo/core/types';

// Invented course names that follow the real SIKOLA pattern.
describe('parseCourseName', () => {
  it.each([
    ['MEKANIKA TANAH II C (TEKNIK SIPIL) [23D01234567]', 'MEKANIKA TANAH II', 'C', 'TEKNIK SIPIL', '23D01234567'],
    ['GAMBAR REKAYASA A [23D07654321]', 'GAMBAR REKAYASA', 'A', null, '23D07654321'],
    ['PENGANTAR LINGKUNGAN BMI B (TEKNIK SIPIL) [23U01110001]', 'PENGANTAR LINGKUNGAN BMI', 'B', 'TEKNIK SIPIL', '23U01110001'],
    ['STATISTIKA I [23D01111111]', 'STATISTIKA I', null, null, '23D01111111'],
    ['FISIKA DASAR V [23D01111112]', 'FISIKA DASAR V', null, null, '23D01111112'],
    ['KALKULUS (TEKNIK SIPIL) [23D01111113]', 'KALKULUS', null, 'TEKNIK SIPIL', '23D01111113'],
  ])('%s', (fullname, name, cls, program, code) => {
    expect(parseCourseName(fullname)).toEqual({ name, classLetter: cls, program, code, matched: true });
  });

  it.each([
    'Praktikum Hidrolika',
    'KULIAH KERJA NYATA [123]',
    'AA999-Nama A [999999]',
    '',
    '[23D01234567]',
    'DESAIN [23d01234567]',
  ])('returns "%s" unchanged when the pattern does not match', (fullname) => {
    expect(parseCourseName(fullname)).toEqual({ name: fullname.trim(), classLetter: null, program: null, code: null, matched: false });
  });

  it('never truncates very long names', () => {
    const long = `${'SANGAT PANJANG '.repeat(20)}X`;
    expect(parseCourseName(long).name).toBe(long);
  });
});

describe('toDisplayCase', () => {
  it.each([
    ['ANALISA STRUKTUR I', 'Analisa Struktur I'],
    ['WAWASAN BUDAYA DAN IPTEKS BMI', 'Wawasan Budaya dan IPTEKS BMI'],
    ['PENGANTAR TEKNOLOGI YANG TERHADAP LINGKUNGAN SERTA BAGI DALAM', 'Pengantar Teknologi yang terhadap Lingkungan serta bagi dalam'],
    ['DAN SEBAGAINYA', 'Dan Sebagainya'],
    ['MEKANIKA TANAH II', 'Mekanika Tanah II'],
    ['STRUKTUR BETON-BAJA', 'Struktur Beton-Baja'],
    ['KESELAMATAN K3', 'Keselamatan K3'],
  ])('%s -> %s', (input, expected) => {
    expect(toDisplayCase(input)).toBe(expected);
  });

  it('keeps names that already use lower case', () => {
    expect(toDisplayCase('Praktikum Hidrolika')).toBe('Praktikum Hidrolika');
  });
});

describe('course colors', () => {
  const course = (id: number, name: string, color: string | null = null) => ({
    id,
    alias: null,
    color,
    parsed: { name, classLetter: null, program: null, code: null, matched: true },
  });

  it('gives eleven courses colors so that equal colors are never neighbours by name', () => {
    const names = ['GEOLOGI', 'BETON', 'ANALISA', 'DINAMIKA', 'FISIKA', 'HIDROLOGI', 'IRIGASI', 'KALKULUS', 'MEKANIKA', 'STATISTIKA', 'ETIKA'];
    const courses = names.map((n, i) => course(i + 1, n));
    const colors = assignCourseColors(courses);
    const sorted = [...courses].sort((a, b) => a.parsed.name.localeCompare(b.parsed.name, 'id'));
    const sequence = sorted.map((c) => colors.get(c.id));
    for (let i = 1; i < sequence.length; i += 1) expect(sequence[i]).not.toBe(sequence[i - 1]);
    expect(new Set(sequence).size).toBe(COURSE_COLOR_COUNT);
    expect(sequence.every((c) => c! >= 1 && c! <= COURSE_COLOR_COUNT)).toBe(true);
  });

  it('keeps a color the user picked', () => {
    expect(assignCourseColors([course(1, 'A', 'course-5'), course(2, 'B')]).get(1)).toBe(5);
  });
});

describe('aliases', () => {
  const record = (alias: string | null): Pick<CourseRecord, 'alias' | 'parsed'> => ({
    alias,
    parsed: { name: 'ANALISA STRUKTUR I', classLetter: 'B', program: 'TEKNIK SIPIL', code: '23D01234567', matched: true },
  });

  it('derives the default alias from the parsed name only', () => {
    expect(courseAlias(record(null))).toBe('Analisa Struktur I');
    expect(courseNameWithClass(record(null))).toBe('Analisa Struktur I B');
  });

  it('prefers the user alias', () => {
    expect(courseAlias(record('Struktur'))).toBe('Struktur');
  });
});

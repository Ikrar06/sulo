import { describe, expect, it } from 'vitest';
import { courseAlias, courseNameWithClass, toDisplayCase } from '../lib/courses/display-name';
import { parseCourseName } from '../lib/courses/parse-name';
import { assignLabels, baseLabel } from '../lib/courses/short-label';
import type { CourseRecord } from '../lib/types';

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

describe('labels', () => {
  it.each([
    ['ANALISA STRUKTUR I', 'AS1'],
    ['WAWASAN BUDAYA DAN IPTEKS', 'WBI'],
    ['KALKULUS', 'KAL'],
    ['MEKANIKA TANAH II', 'MT2'],
    ['PENGANTAR REKAYASA SISTEM INFRASTRUKTUR WILAYAH PESISIR', 'PRSIW'],
  ])('%s -> %s', (name, label) => {
    expect(baseLabel(name)).toBe(label);
    expect(baseLabel(name).length).toBeLessThanOrEqual(5);
  });

  const course = (id: number, name: string, cls: string | null, label: string | null = null) => ({
    id,
    label,
    parsed: { name, classLetter: cls, program: null, code: null, matched: true },
  });

  it('never gives two courses the same label', () => {
    const labels = assignLabels([
      course(1, 'BAHASA INGGRIS', 'A'),
      course(2, 'BIOLOGI INDUSTRI', 'B'),
      course(3, 'BAHASA INDONESIA', null),
      course(4, 'BAHASA INGGRIS', 'C', 'BING'),
    ]);
    const values = [...labels.values()];
    expect(new Set(values).size).toBe(values.length);
    expect(labels.get(4)).toBe('BING');
    expect(labels.get(1)).toBe('BIA');
    expect(labels.get(2)).toBe('BIB');
    expect(values.every((l) => l.length <= 5)).toBe(true);
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

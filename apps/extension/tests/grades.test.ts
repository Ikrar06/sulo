import { describe, expect, it } from 'vitest';
import type { Projected } from '@sulo/core/neosia/project';
import { GRADE_SCALE, gradeWeight } from '@sulo/core/grades/scale';
import { bySemester, computeIpk, differsFromNeosia, improvable, passedSks, readSemesters, readTranscript, semesterLabeler, simulateIpk, transcriptDiagnostics, type TranscriptRow } from '@sulo/core/grades/transcript';

const row = (key: string, letter: string | null, sks: number, extra: Partial<TranscriptRow> = {}): TranscriptRow => ({ key, code: key, name: key, sks, letter, semester: '20251', used: true, transfer: false, manual: false, ...extra });

describe('grade scale', () => {
  it('A=4 … E=0, letters outside the scale have no weight', () => {
    expect(GRADE_SCALE).toEqual({ A: 4, 'A-': 3.75, 'B+': 3.5, B: 3, 'B-': 2.75, 'C+': 2.5, C: 2, D: 1, E: 0 });
    expect(gradeWeight('b+')).toBe(3.5);
    expect(gradeWeight('T')).toBeNull();
    expect(gradeWeight(null)).toBeNull();
  });
});

describe('IPK from the transcript', () => {
  it('weights by credits and counts only is_used rows', () => {
    const rows = [row('a', 'A', 3), row('b', 'B', 2), row('old', 'E', 3, { used: false })];
    expect(computeIpk(rows)).toBe(3.6);
  });
  it('includes credit transfers and skips letters outside the scale', () => {
    const rows = [row('a', 'A', 3), row('t', 'B', 3, { transfer: true }), row('k', 'T', 2)];
    expect(computeIpk(rows)).toBe(3.5);
  });
  it('is null without counted credits', () => {
    expect(computeIpk([])).toBeNull();
    expect(computeIpk([row('x', 'A', 0)])).toBeNull();
  });
  it('counts passed credits (above E) of counted rows', () => {
    expect(passedSks([row('a', 'A', 3), row('e', 'E', 2), row('o', 'B', 3, { used: false })])).toBe(3);
  });
  it('groups by semester, newest first, with the semester GPA', () => {
    const groups = bySemester([row('a', 'A', 3, { semester: '20251' }), row('b', 'C', 3, { semester: '20252' }), row('c', 'B', 3, { semester: '20252' })]);
    expect(groups.map((g) => [g.semester, g.ips, g.sks])).toEqual([
      ['20252', 2.5, 6],
      ['20251', 4, 3],
    ]);
  });
  it('flags a difference from NEOSIA above 0.01 only', () => {
    expect(differsFromNeosia(3.51, 3.51)).toBe(false);
    expect(differsFromNeosia(3.515, 3.51)).toBe(false);
    expect(differsFromNeosia(3.53, 3.51)).toBe(true);
    expect(differsFromNeosia(null, 3.5)).toBe(false);
  });
});

describe('"Bisa diperbaiki" and the simulation', () => {
  const rows = [row('a', 'A', 3), row('c', 'C', 3), row('d', 'D', 2), row('e', 'E', 2), row('old', 'D', 3, { used: false })];
  it('lists counted D and E; C only when asked', () => {
    expect(improvable(rows).map((r) => r.key)).toEqual(['d', 'e']);
    expect(improvable(rows, true).map((r) => r.key)).toEqual(['c', 'd', 'e']);
  });
  it('simulates new letters without changing the rows', () => {
    const before = computeIpk(rows);
    expect(before).toBe(2);
    expect(simulateIpk(rows, { d: "B", e: "B+" })).toBe(3.1);
    expect(computeIpk(rows)).toBe(before);
  });
});

describe('reading the projected transcript', () => {
  it('maps the observed fields', () => {
    const rows = readTranscript({ transkrip: [{ kode_mata_kuliah: 'K1', nama_mata_kuliah: 'N1', sks: 3, nilai_huruf: 'A', id_semester: 20251, is_used: false, is_alih_kredit: true, is_manual: true, is_locked: true }] });
    expect(rows).toEqual([{ key: 'K1|20251', code: 'K1', name: 'N1', sks: 3, letter: 'A', semester: '20251', used: false, transfer: true, manual: true }]);
  });
});

describe('transcripts with mixed field types (M7.1 fix)', () => {
  // Synthetic: ids as numbers and strings, is_used as 0/1, credits as strings, letters with spaces and lower case.
  const transcript = {
    transkrip: [
      { kode_mata_kuliah: 'K1', nama_mata_kuliah: 'SATU', sks: '3', nilai_huruf: 'A', id_semester: 47, is_used: 1 },
      { kode_mata_kuliah: 'K2', nama_mata_kuliah: 'DUA', sks: 2, nilai_huruf: ' b+ ', id_semester: '47', is_used: '1' },
      { kode_mata_kuliah: 'K3', nama_mata_kuliah: 'TIGA', sks: '3', nilai_huruf: 'E', id_semester: 48, is_used: 0, is_alih_kredit: 1 },
      { kode_mata_kuliah: 'K4', nama_mata_kuliah: 'EMPAT', sks: 'x', nilai_huruf: 'T', id_semester: '49', is_used: 1 },
      { kode_mata_kuliah: 'K5', sks: 3, nilai_huruf: 'c', id_semester: 48 },
    ],
  };
  const semesters = readSemesters({ semesters: [{ id: '47', kode: '20231', jenis: 'Ganjil', tahun_ajaran: '2023/2024' }, { id: 48, kode: '20232', jenis: 'Genap', tahun_ajaran: '2023/2024' }] });
  const rows = readTranscript(transcript as unknown as Projected);

  it('reads ids, 0/1 flags, string credits and messy letters', () => {
    expect(rows.map((r) => [r.semester, r.used, r.transfer, r.sks, r.letter, r.name])).toEqual([
      ['47', true, false, 3, 'A', 'SATU'],
      ['47', true, false, 2, 'B+', 'DUA'],
      ['48', false, true, 3, 'E', 'TIGA'],
      ['49', true, false, 0, 'T', 'EMPAT'],
      ['48', true, false, 3, 'C', 'K5'],
    ]);
    // (4*3 + 3.5*2 + 2*3) / 8
    expect(computeIpk(rows)).toBe(3.13);
  });

  it('maps rows to semesters by id (number or string), labels the rest by their order', () => {
    const label = semesterLabeler(rows, semesters);
    expect(label('47')).toEqual({ jenis: 'Ganjil', tahunAjaran: '2023/2024', index: 1 });
    expect(label('48')).toEqual({ jenis: 'Genap', tahunAjaran: '2023/2024', index: 2 });
    expect(label('49')).toEqual({ jenis: null, tahunAjaran: null, index: 3 });
    expect(bySemester(rows).map((g) => g.semester)).toEqual(['49', '48', '47']);
  });

  it('still groups by id_semester when no semester list is stored', () => {
    expect(bySemester(rows).map((g) => [g.semester, g.rows.length])).toEqual([
      ['49', 1],
      ['48', 2],
      ['47', 2],
    ]);
    expect(semesterLabeler(rows, [])('48').index).toBe(2);
  });

  it('dev diagnostics: counts only', () => {
    expect(transcriptDiagnostics(rows, semesters)).toEqual({ stored: 5, counted: 3, mapped: 4, notUsed: 1, noLetter: 1, noCredits: 1, noSemester: 0 });
  });
});

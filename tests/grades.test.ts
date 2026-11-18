import { describe, expect, it } from 'vitest';
import { GRADE_SCALE, gradeWeight } from '../lib/grades/scale';
import { bySemester, computeIpk, differsFromNeosia, improvable, passedSks, readTranscript, simulateIpk, type TranscriptRow } from '../lib/grades/transcript';

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

import { describe, expect, it } from 'vitest';
import { classSuffix } from '@sulo/core/neosia/class-name';

describe('class label on the schedule', () => {
  it('keeps a class name that adds something', () => {
    expect(classSuffix('Kls. Informatika', ['MEKANIKA FLUIDA'])).toBe('Kls. Informatika');
    expect(classSuffix('B', ['Statistika'])).toBe('B');
  });
  it('drops a leading course name, in any letter case, and the separators after it', () => {
    expect(classSuffix('MEKANIKA FLUIDA - Kls. Informatika', ['Mekanika Fluida'])).toBe('Kls. Informatika');
    expect(classSuffix('Mekanika Fluida B', ['MEKANIKA FLUIDA'])).toBe('B');
    expect(classSuffix('Statistika (Kelas Pagi)', ['STATISTIKA'])).toBe('Kelas Pagi');
  });
  it('uses the longest matching name (official or short)', () => {
    expect(classSuffix('PERENCANAAN WILAYAH DAN KOTA A', ['PERENCANAAN WILAYAH', 'PERENCANAAN WILAYAH DAN KOTA'])).toBe('A');
  });
  it('nothing left, or no class name: null', () => {
    expect(classSuffix('Mekanika Fluida', ['MEKANIKA FLUIDA'])).toBeNull();
    expect(classSuffix(null, ['X'])).toBeNull();
    expect(classSuffix('  ', ['X'])).toBeNull();
  });
});

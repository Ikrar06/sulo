// Letter grade weights (M7.1, the Nilai page's own count and simulation).
// Status: NEEDS VERIFICATION against an official Unhas source
// (docs/ATURAN-AKADEMIK.md). The official GPA always comes from NEOSIA;
// Sulo's count is labelled "perkiraan" in the UI.

export const GRADE_SCALE_STATUS = 'perlu verifikasi' as const;

export const GRADE_SCALE: Readonly<Record<string, number>> = {
  A: 4,
  'A-': 3.75,
  'B+': 3.5,
  B: 3,
  'B-': 2.75,
  'C+': 2.5,
  C: 2,
  D: 1,
  E: 0,
};

/** Letters in the order the simulation offers them. */
export const GRADE_LETTERS = Object.keys(GRADE_SCALE);

/** The weight of a letter, or null for letters outside the scale (T, K, …). */
export function gradeWeight(letter: string | null): number | null {
  if (letter === null) return null;
  const w = GRADE_SCALE[letter.trim().toUpperCase()];
  return w === undefined ? null : w;
}

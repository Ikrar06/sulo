// The MKPK load of a study program: 20 credits for the non-health cluster,
// 10 for the health cluster (https://www.unhas.ac.id/mkpk/, with Peraturan
// Rektor 29/UN4.1/2023). Unhas publishes no list of programs per cluster, so
// Sulo only estimates it from the faculty letter in the student's course
// codes, and the estimate is never used before the student confirms or
// changes it (docs/mkpk/RENCANA.md, F1b). Pure.

export type MkpkLoad = 20 | 10;
/** What the student chose: a load, or "my curriculum has no MKPK" (hides the card). */
export type MkpkLoadChoice = MkpkLoad | 'none';

/** Faculty letters (from the programs' own codes) and the cluster each belongs to. */
const HEALTH = new Set(['C', 'J', 'K', 'N', 'R']); // Kedokteran, Kedokteran Gigi, Kesehatan Masyarakat, Farmasi, Keperawatan
const NON_HEALTH = new Set(['A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'M']); // Ekonomi, Hukum, Teknik, FISIP, Ilmu Budaya, Pertanian, MIPA, Peternakan, Kelautan, Kehutanan
// O (Kedokteran Hewan) and Q (Psikologi) sit in the medical faculty but are not estimated: the student picks.

/** Fewer course codes than this and there is no estimate. */
export const MIN_CODES_FOR_ESTIMATE = 3;

/**
 * The estimated load from faculty letter counts ("U" already left out), or
 * null: too few codes, two letters tied for the most, or a letter whose
 * cluster is not known.
 */
export function estimateLoad(letters: Readonly<Record<string, number>>): MkpkLoad | null {
  const entries = Object.entries(letters).filter(([letter, n]) => letter !== 'U' && n > 0);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (total < MIN_CODES_FOR_ESTIMATE) return null;
  const top = Math.max(...entries.map(([, n]) => n));
  const leaders = entries.filter(([, n]) => n === top);
  if (leaders.length !== 1) return null;
  const letter = leaders[0]![0];
  if (HEALTH.has(letter)) return 10;
  if (NON_HEALTH.has(letter)) return 20;
  return null;
}

/** A stored choice, read defensively: anything else is "not chosen yet". */
export function parseLoadChoice(value: unknown): MkpkLoadChoice | null {
  return value === 20 || value === 10 || value === 'none' ? value : null;
}

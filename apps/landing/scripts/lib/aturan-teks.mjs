// The landing page's text rules (owner, 24 Nov 2026, and brief section 8), as
// pure functions so they are tested on their own (tests/teks.test.ts).
//
// No separator between phrases: a middle dot, a vertical bar, a slash, an
// inline bullet or a dash standing between spaces. A slash or hyphen inside a
// word or an address (chrome://extensions, 2-minute) is not a separator.
export const PEMISAH = /\s(·|\||\/|•|—|–|-)\s/;

/** The separator found in a text, or null. */
export function cariPemisah(teks) {
  const m = PEMISAH.exec(teks);
  return m ? m[1] : null;
}

export const kata = (teks) => teks.trim().split(/\s+/).filter(Boolean).length;

/** The brief's budgets (USULAN, section 8): what each kind of text may hold. */
export const ANGGARAN = {
  /** Section titles: at most 6 words. */
  judulBagian: 6,
  /** A tile's line: about 12 words (14 allowed). */
  keteranganUbin: 14,
  /** The hero's sentence: about 140 characters. */
  pendukung: 140,
  /** A button says its action: at most 6 words. */
  tombol: 6,
};

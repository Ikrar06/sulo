// Sipakamase (sipakamase.unhas.ac.id), the university's MKPK system: the only
// addresses Sulo may ask, as constants. The site changes data with plain
// GETs (deleting an activity, allocating credits, logging out, clearing
// notifications), so nothing here is ever built from a page's own links,
// and a link Sulo reads in a page is never followed (docs/mkpk/RENCANA.md,
// 4c). Pure data.

export const SIPAKAMASE_ORIGIN = 'https://sipakamase.unhas.ac.id';
/** The optional host permission the extension asks for when the module is turned on. */
export const SIPAKAMASE_HOST_PERMISSION = `${SIPAKAMASE_ORIGIN}/*`;

/**
 * The five read-only fragments the site loads into its own pages. The home
 * page and /ckonversimhs/detail are left out on purpose: they carry the
 * student's personal data.
 */
export const READ_PATHS = [
  '/caktifitasmahasiswa/content',
  '/caktifitas/content',
  '/ckonversimhs/matakuliah',
  '/cklaim/content',
  '/ckonversimhs/rekappoin',
] as const;
export type ReadPath = (typeof READ_PATHS)[number];

export const isReadPath = (path: string): path is ReadPath => (READ_PATHS as readonly string[]).includes(path);

/**
 * Addresses known to change data or end the session, seen on the site
 * (26 Nov 2026). Never requested; listed so the tests can prove the client
 * refuses every one of them.
 */
export const KNOWN_MUTATING_PATHS = [
  '/caktifitasmahasiswa/delete/x.y',
  '/ckonversimhs/sksmk/x.y/x.y/x.y',
  '/home/clearnotify',
  '/logout',
  '/caktifitas/final/x.y',
  '/caktifitasmahasiswa/halamanedit/x.y',
  '/caktifitasmahasiswa/pilihbasis',
  '/caktifitasmahasiswa/pilihbasislampau',
  '/home',
  '/ckonversimhs/detail',
] as const;

/** The site's own pages a student opens (passive reading happens there); the login page is never one of them. */
export const SIPAKAMASE_PAGES = {
  home: `${SIPAKAMASE_ORIGIN}/home`,
  kegiatan: `${SIPAKAMASE_ORIGIN}/caktifitasmahasiswa`,
  riwayat: `${SIPAKAMASE_ORIGIN}/caktifitas`,
  konversi: `${SIPAKAMASE_ORIGIN}/ckonversimhs`,
  klaim: `${SIPAKAMASE_ORIGIN}/cklaim`,
} as const;

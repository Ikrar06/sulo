// The NEOSIA checklist's next step (M8d): sign in, then Beranda, Kartu Hasil
// Studi and KRS, each done once one of its own endpoints was captured. Pure,
// used by the B0 trial card now and by the real checklist later.

export type ChecklistPage = 'home' | 'khs' | 'krs';
export type ChecklistStep = 'login' | ChecklistPage | 'done';

/** The pages in order after signing in. */
export const CHECKLIST_PAGES: readonly ChecklistPage[] = ['home', 'khs', 'krs'];

/**
 * The endpoints only that page asks for (allowlist.ts ids). belanja_krs is not
 * KRS's mark: Beranda asks for it too.
 */
export const PAGE_ENDPOINTS: Readonly<Record<ChecklistPage, readonly string[]>> = {
  home: ['dashboard'],
  khs: ['kartu_hasil_studi/semester', 'indeks_prestasi/current'],
  krs: ['max_sks', 'kelas_kuliah_tersedia'],
};

/** The pages done, from the endpoint ids captured so far. */
export function pagesDone(capturedEndpoints: Iterable<string>): Set<ChecklistPage> {
  const got = new Set(capturedEndpoints);
  return new Set(CHECKLIST_PAGES.filter((p) => PAGE_ENDPOINTS[p].some((id) => got.has(id))));
}

/**
 * What to open next. A page that reached NEOSIA's login (needs_login), or no
 * sign-in yet: the login. Otherwise the first page not done; all done: done.
 */
export function nextStep(input: { signedIn: boolean; lastResult: 'signed_in' | 'needs_login' | 'closed' | null; capturedEndpoints: Iterable<string> }): ChecklistStep {
  if (input.lastResult === 'needs_login' || (!input.signedIn && input.lastResult !== 'signed_in')) return 'login';
  const done = pagesDone(input.capturedEndpoints);
  return CHECKLIST_PAGES.find((p) => !done.has(p)) ?? 'done';
}

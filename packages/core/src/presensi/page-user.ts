// The signed-in SIKOLA account of a fetched attendance page, so a page that
// answers for another account is never stored under the active one. Only the
// numeric id is read: names and the rest of the user menu are never looked at.

export type PageUserSource = 'mcfg' | 'data-userid' | 'profile-link';

/** Every source's candidate ids, outside the page's main region (that may show other people). */
export function pageUserCandidates(html: string): Record<PageUserSource, number[]> {
  const main = html.search(/id="region-main"/);
  const outside = main < 0 ? html : html.slice(0, main);
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]!).join('\n');
  const ids = (re: RegExp, text: string) => [...text.matchAll(re)].map((m) => Number(m[1])).filter((n) => Number.isSafeInteger(n) && n > 0);
  return {
    // M.cfg = {..., "userId": 123, ...} (Moodle 4.x page config).
    mcfg: ids(/M\.cfg\s*=\s*\{[^}]*?"userId"\s*:\s*(\d+)/g, scripts),
    // The navbar's notification and message popovers.
    'data-userid': ids(/\bdata-userid="(\d+)"/g, outside),
    // The user menu's own profile link.
    'profile-link': ids(/\/user\/profile\.php\?id=(\d+)/g, outside),
  };
}

/**
 * Sources in order; the first that gives one single id wins. SIKOLA's
 * attendance pages (recap, course, sessions; checked with
 * scripts/sanitize.ts, counts only) carry exactly one data-userid in the
 * navbar and neither of the others, which stay as fallbacks for a theme
 * change.
 */
export const PAGE_USER_ORDER: readonly PageUserSource[] = ['data-userid', 'mcfg', 'profile-link'];

/** The page's account id, or null when no source gives exactly one id. */
export function pageUserId(html: string): number | null {
  const found = pageUserCandidates(html);
  for (const source of PAGE_USER_ORDER) {
    const unique = [...new Set(found[source])];
    if (unique.length === 1) return unique[0]!;
    // Several different ids in a trusted source: do not guess.
    if (unique.length > 1) return null;
  }
  return null;
}

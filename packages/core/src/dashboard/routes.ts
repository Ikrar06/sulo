// Dashboard pages and their URL hashes (dashboard.html#kalender). Pure, so
// the popup, notifications and tests share one list.

export const PAGES = ['ringkasan', 'tugas', 'mata-kuliah', 'presensi', 'kabar', 'kalender', 'jadwal', 'nilai', 'pengaturan', 'bantuan', 'tentang'] as const;
export type Page = (typeof PAGES)[number];

/** Pages that exist only while the NEOSIA module is on (hidden from the sidebar otherwise). */
export const NEOSIA_PAGES: ReadonlySet<Page> = new Set(['jadwal', 'nilai']);

/** Pages with names, grades or credits: only these show the privacy mode button. */
export const SENSITIVE_PAGES: ReadonlySet<Page> = new Set(['ringkasan', 'presensi', 'jadwal', 'nilai']);

export interface Route {
  page: Page;
  /** Optional detail, e.g. a task's event id: #tugas/1234, or a settings section: #pengaturan/kalender. */
  detail: string | null;
}

export function parseRoute(hash: string): Route {
  const [head = '', ...rest] = hash.replace(/^#\/?/, '').split('/');
  const page = (PAGES as readonly string[]).includes(head) ? (head as Page) : 'ringkasan';
  const detail = page === head && rest.length > 0 ? decodeURIComponent(rest.join('/')) : null;
  return { page, detail };
}

export function routeHash(page: Page, detail?: string | number | null): string {
  return detail === undefined || detail === null || detail === '' ? `#${page}` : `#${page}/${encodeURIComponent(String(detail))}`;
}

/** Path for chrome.runtime.getURL / tabs.create. */
export function dashboardPath(page: Page, detail?: string | number | null): `/dashboard.html${string}` {
  return `/dashboard.html${routeHash(page, detail)}`;
}

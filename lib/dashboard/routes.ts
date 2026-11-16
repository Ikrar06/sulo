// Dashboard pages and their URL hashes (dashboard.html#kalender). Pure, so
// the popup, notifications and tests share one list.

export const PAGES = ['ringkasan', 'tugas', 'mata-kuliah', 'kabar', 'kalender', 'pengaturan', 'bantuan', 'tentang'] as const;
export type Page = (typeof PAGES)[number];

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
export function dashboardPath(page: Page, detail?: string | number | null): string {
  return `/dashboard.html${routeHash(page, detail)}`;
}

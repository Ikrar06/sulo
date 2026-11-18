// Sanitizer for saved SIKOLA attendance pages (mod/attendance/view.php),
// so they can become test fixtures (docs/TESTING.md). Text-level only, no
// DOM, so it runs in Node (scripts/sanitize.ts) without dependencies.
//
// It keeps the page's main region (the attendance tables) and drops the rest
// (head, scripts, navigation, user menu, drawers, footer). Before dropping
// the user menu it reads the signed-in user's name from it, then replaces
// that name everywhere. Emails, student numbers, national ids, user ids,
// sesskeys and teachers' remarks are replaced too, and course names become
// "Mata Kuliah Sintetis N". It returns how many of each it replaced, never
// the values. The page's account marker (presensi/page-user.ts) is kept as
// a synthetic data-userid="1", so tests see the page as SIKOLA sends it.

import { pageUserId } from '../presensi/page-user.ts';

export interface HtmlSanitizeReport {
  keptRegion: boolean;
  /** How many forms of the signed-in user's name were found outside the main region (0: the page had no user menu). */
  namesDetected: number;
  removedScripts: number;
  names: number;
  emails: number;
  studentNumbers: number;
  nationalIds: number;
  userIds: number;
  sesskeys: number;
  remarks: number;
  courseNames: number;
  /** userpicture, userinitials, usertext or profile links still in the output (should be 0). */
  personMarkersLeft: number;
}

const SYNTHETIC_NAME = 'Mahasiswa Sintetis';
const SYNTHETIC_EMAIL = 'mahasiswa@example.invalid';
const SYNTHETIC_NIM = 'D000000001';
/** The navbar's account marker, with the synthetic id every sanitized user id gets. */
export const SYNTHETIC_ACCOUNT_MARKER = '<div class="popover-region" data-userid="1"></div>\n';

const stripTags = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The signed-in user's name, from the places Moodle shows it (never from the main region). */
export function signedInNames(html: string): string[] {
  const found = new Set<string>();
  const add = (raw: string | undefined) => {
    const name = stripTags(raw ?? '').replace(/&#0?39;|&apos;/g, "'");
    if (name.length >= 3 && /[A-Za-z]/.test(name) && name.length <= 80) found.add(name);
  };
  for (const m of html.matchAll(/class="[^"]*\busertext\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)) add(m[1]);
  for (const m of html.matchAll(/class="[^"]*\buserinitials\b[^"]*"[^>]*(?:title|aria-label)="([^"]+)"/gi)) add(m[1]);
  for (const m of html.matchAll(/<img[^>]*class="[^"]*\buserpicture\b[^"]*"[^>]*alt="([^"]+)"/gi)) add(m[1]);
  for (const m of html.matchAll(/<img[^>]*alt="([^"]+)"[^>]*class="[^"]*\buserpicture\b/gi)) add(m[1]);
  for (const m of html.matchAll(/(?:logged in as|masuk sebagai)\s*<a[^>]*>([\s\S]*?)<\/a>/gi)) add(m[1]);
  for (const m of html.matchAll(/<a[^>]*href="[^"]*\/user\/(?:profile|view)\.php\?id=\d+[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) add(m[1]);
  // "Picture of NAME" / "Gambar NAME"
  for (const n of [...found]) {
    const m = /^(?:picture of|gambar)\s+(.+)$/i.exec(n);
    if (m) {
      found.delete(n);
      add(m[1]);
    }
  }
  return [...found];
}

/** The main region only: from id="region-main" (or role="main") to the footer. */
function mainRegion(html: string): string | null {
  const at = html.search(/id="region-main"|role="main"/);
  if (at < 0) return null;
  const start = html.lastIndexOf('<', at);
  const endCandidates = [html.indexOf('<footer', at), html.indexOf('id="page-footer"', at), html.indexOf('id="top-footer"', at)].filter((i) => i > 0);
  const end = endCandidates.length > 0 ? Math.min(...endCandidates) : html.length;
  return html.slice(start, html.lastIndexOf('<', end) > start ? html.lastIndexOf('<', end) : end);
}

export function sanitizeAttendanceHtml(html: string): { html: string; report: HtmlSanitizeReport } {
  const report: HtmlSanitizeReport = { keptRegion: false, namesDetected: 0, removedScripts: 0, names: 0, emails: 0, studentNumbers: 0, nationalIds: 0, userIds: 0, sesskeys: 0, remarks: 0, courseNames: 0, personMarkersLeft: 0 };
  const names = signedInNames(html);
  report.namesDetected = names.length;
  const region = mainRegion(html);
  report.keptRegion = region !== null;
  let out = region ?? html.replace(/<head[\s\S]*?<\/head>/i, '');

  const count = (re: RegExp, to: string | ((...m: string[]) => string), key: keyof HtmlSanitizeReport) => {
    out = out.replace(re, (...m: string[]) => {
      (report[key] as number) += 1;
      return typeof to === 'string' ? to : to(...m);
    });
  };

  count(/<script\b[\s\S]*?<\/script>/gi, '', 'removedScripts');
  count(/<style\b[\s\S]*?<\/style>/gi, '', 'removedScripts');
  out = out.replace(/<!--[\s\S]*?-->/g, '');

  // The user's name, whole, then its longer parts on their own.
  const parts = new Set<string>();
  for (const n of names) {
    parts.add(n);
    for (const w of n.split(/\s+/)) if (w.length >= 4) parts.add(w);
  }
  for (const p of [...parts].sort((a, b) => b.length - a.length)) count(new RegExp(`(?<![\\p{L}])${escapeRe(p)}(?![\\p{L}])`, 'giu'), SYNTHETIC_NAME, 'names');

  count(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, SYNTHETIC_EMAIL, 'emails');
  count(/\b[A-Z]\d{8,10}\b/g, SYNTHETIC_NIM, 'studentNumbers');
  count(/\b\d{16}\b|\b\d{18}\b/g, (m) => '0'.repeat(m.length), 'nationalIds');
  count(/(\/user\/(?:profile|view)\.php\?id=)\d+/g, (_m, a) => `${a}1`, 'userIds');
  count(/([?&;](?:amp;)?(?:userid|studentid|user)=)\d+/gi, (_m, a) => `${a}1`, 'userIds');
  count(/(data-user(?:id)?=")\d+"/gi, (_m, a) => `${a}1"`, 'userIds');
  count(/(sesskey=)[A-Za-z0-9]+/g, (_m, a) => `${a}SESSKEY`, 'sesskeys');
  count(/(name="sesskey"[^>]*value=")[^"]*"/gi, (_m, a) => `${a}SESSKEY"`, 'sesskeys');
  count(/("sesskey"\s*:\s*")[^"]*"/g, (_m, a) => `${a}SESSKEY"`, 'sesskeys');

  // Teachers' remarks: free text, so always replaced.
  count(/(<td[^>]*class="[^"]*remarks[^"]*"[^>]*>)([\s\S]*?)(<\/td>)/gi, (_m, open, text, close) => (stripTags(text) ? `${open}Catatan sintetis${close}` : `${open}${text}${close}`), 'remarks');

  // Course names in links, numbered per course id.
  const synthetic = new Map<string, string>();
  const courseName = (id: string) => {
    if (!synthetic.has(id)) synthetic.set(id, `Mata Kuliah Sintetis ${synthetic.size + 1}`);
    return synthetic.get(id)!;
  };
  count(/(<a[^>]*href="[^"]*\/course\/view\.php\?id=(\d+)[^"]*"[^>]*>)([\s\S]*?)(<\/a>)/gi, (_m, open, id, _text, close) => `${open}${courseName(`c${id}`)}${close}`, 'courseNames');

  // Person markers that should never survive: their count, for the report.
  report.personMarkersLeft = (out.match(/userpicture|userinitials|usertext|\/user\/(?:profile|view)\.php/g) ?? []).length;
  return { html: `<!doctype html>\n<!-- Sanitized SIKOLA attendance page (main region only). -->\n<html><body>\n${pageUserId(html) !== null ? SYNTHETIC_ACCOUNT_MARKER : ''}${out.trim()}\n</body></html>\n`, report };
}

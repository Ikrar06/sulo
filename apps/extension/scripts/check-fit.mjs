#!/usr/bin/env node
// pnpm check:fit (extension): every relative time and countdown stays on one
// line at its full size, never cut, in the popup at 380 and the dashboard at
// 1280 (Ringkasan, Tugas), Indonesian and English, in each due-time format.
// The tasks are synthetic, due from a year late to 90 days ahead (minutes,
// hours, days around now), in the tester build with every host but the
// extension unreachable.
// Also the rule that the rightmost items of one list share one right edge:
// the popup's group chevrons, check circles and "kabar baru" chevron; the
// Tugas page's detail chevrons.
// And the dashboard's toast in the sidebar column at 1280: a real one (a task
// marked done, with Urungkan), then every message a dashboard toast can carry
// in that language put in it as it really shows (with Urungkan only for the
// done toast), at most two lines and never cut, inside the column.
// Exit 1 on any failure. Usage: node scripts/check-fit.mjs [--no-build]
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { demoStorage } from './lib/demo-storage.mjs';

const root = new URL('..', import.meta.url).pathname;
if (!process.argv.includes('--no-build')) execFileSync('pnpm', ['exec', 'wxt', 'build', '--mode', 'tester'], { cwd: root, stdio: 'ignore' });
const ext = join(root, '../../.output/chrome-mv3-tester');

const MIN = 60;
const HOUR = 3600;
const DAY = 86400;
const OFFSETS = [-365 * DAY, -40 * DAY, -7 * DAY, -DAY - 1, -5 * HOUR, -30 * MIN, MIN, 59 * MIN, 2 * HOUR, 23 * HOUR + 59 * MIN, 25 * HOUR, 47 * HOUR, 3 * DAY, 6 * DAY, 13 * DAY, 29 * DAY, 60 * DAY, 89 * DAY];
const FORMATS = ['both', 'remaining', 'clock', 'countdown'];

function seed(locale, dueFormat) {
  const now = Math.floor(Date.now() / 1000);
  const s = demoStorage(root);
  const base = s['u:1:tasks'];
  const courses = [...new Set(base.map((t) => t.courseId))];
  s['u:1:tasks'] = OFFSETS.map((off, i) => ({ ...base[i % base.length], eventId: 9000 + i, cmId: 9000 + i, courseId: courses[i % courses.length], name: `Tugas uji ${i + 1}`, dueAt: now + off }));
  s['u:1:sync'] = { lastSyncAt: now, lastCourseListAt: now };
  s['global:prefs'] = { locale, dueFormat };
  return s;
}

/** In the page: every FitLine text, and the right edges of a list's rightmost items. */
const MEASURE = (edges) => {
  const bad = [];
  for (const el of document.querySelectorAll('[data-fit]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    const lh = parseFloat(getComputedStyle(el).lineHeight);
    const text = el.textContent.trim();
    if (r.height > lh * 1.5) bad.push(`dua baris: "${text}"`);
    if (el.scrollWidth > el.clientWidth + 0.5) bad.push(`terpotong: "${text}"`);
    if (el.dataset.fit !== 'full') bad.push(`turun ukuran: "${text}"`);
  }
  const right = {};
  for (const [name, sel] of Object.entries(edges)) right[name] = [...new Set([...document.querySelectorAll(sel)].map((e) => Math.round(e.getBoundingClientRect().right)).filter((x) => x > 0))];
  return { bad, count: document.querySelectorAll('[data-fit]').length, right };
};

// Every message a dashboard toast shows (done-undo with its action; NeosiaArrivals,
// BugReport and Subscribe without one): [text, has action].
const TOAST_TEXTS = {
  id: [['Ditandai selesai', true], ['Data dari NEOSIA masuk', false], ['Nilai diperbarui dari NEOSIA', false], ['Jadwal diperbarui dari NEOSIA', false], ['Info tersalin', false], ['Tersalin', false]],
  en: [['Marked as done', true], ['Data from NEOSIA came in', false], ['Grades updated from NEOSIA', false], ['Schedule updated from NEOSIA', false], ['Info copied', false], ['Copied', false]],
};

/** In the page: the toast with each message, its lines and edges against the sidebar column. */
const MEASURE_TOAST = (texts) => {
  const toast = document.querySelector('.db-toasts .sulo-toast');
  if (!toast) return { missing: true, bad: [] };
  const msg = toast.querySelector(':scope > span');
  const nav = document.querySelector('.db-toasts')?.getBoundingClientRect();
  const bad = [];
  const first = msg.textContent;
  const action = toast.querySelector('button');
  for (const [text, withAction] of [[first, true], ...texts]) {
    msg.textContent = text;
    if (action) action.style.display = withAction ? '' : 'none';
    const lh = parseFloat(getComputedStyle(msg).lineHeight) || 20;
    const lines = Math.round(msg.getBoundingClientRect().height / lh);
    const t = toast.getBoundingClientRect();
    if (lines > 2) bad.push(`${lines} baris: "${text}"`);
    if (msg.scrollWidth > msg.clientWidth + 0.5 || toast.scrollWidth > toast.clientWidth + 0.5) bad.push(`terpotong: "${text}"`);
    for (const b of toast.querySelectorAll('button')) if (b.scrollWidth > b.clientWidth + 0.5) bad.push(`tombol terpotong: "${b.textContent}"`);
    if (nav && (t.left < nav.left - 0.5 || t.right > nav.right + 0.5)) bad.push(`keluar kolom sidebar: "${text}"`);
  }
  msg.textContent = first;
  if (action) action.style.display = '';
  return { missing: false, bad, real: first };
};

const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost'] });
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
let failed = 0;
// A page that throws (a crash renders nothing) is a failure of its own.
const errors = [];
const watch = (page, where) => page.on('pageerror', (e) => errors.push(`${where}: ${e.message}`));
const report = (where, r, edgeGroups) => {
  const lines = [...r.bad];
  for (const group of edgeGroups) {
    const xs = group.flatMap((n) => r.right[n] ?? []);
    for (const n of group) if (!(r.right[n] ?? []).length) lines.push(`tidak ada elemen "${n}" untuk diukur`);
    if (new Set(xs).size > 1) lines.push(`tepi kanan berbeda (${group.join(', ')}): ${[...new Set(xs)].join(', ')}`);
  }
  if (r.count === 0) lines.push('tidak ada teks waktu yang diukur');
  failed += lines.length;
  console.log(`${lines.length ? 'GAGAL' : 'ok   '} ${where}: ${r.count} teks waktu${lines.length ? `\n  ${lines.join('\n  ')}` : ''}`);
};

for (const locale of ['id', 'en']) {
  for (const dueFormat of FORMATS) {
    await sw.evaluate(async (s) => {
      await chrome.storage.local.clear();
      await chrome.storage.local.set(s);
    }, seed(locale, dueFormat));
    const popup = await ctx.newPage();
    watch(popup, `popup ${locale} ${dueFormat}`);
    await popup.setViewportSize({ width: 380, height: 2400 });
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.waitForTimeout(900);
    // Every group open, so every row is measured.
    for (const t of await popup.locator('[data-slot="collapsible-trigger"][data-state="closed"]').all()) await t.click();
    await popup.waitForTimeout(300);
    const edges = { chevron: '[data-slot="collapsible-trigger"] svg', lingkaran: 'li [role="checkbox"]', kabar: 'button:has(> svg):not([data-slot]) > svg:last-child' };
    report(`popup 380 ${locale} ${dueFormat}`, await popup.evaluate(MEASURE, edges), [['chevron', 'lingkaran']]);
    await popup.close();

    const page = await ctx.newPage();
    watch(page, `dashboard ${locale} ${dueFormat}`);
    await page.setViewportSize({ width: 1280, height: 2400 });
    for (const hash of ['ringkasan', 'tugas']) {
      await page.goto(`chrome-extension://${id}/dashboard.html#${hash}`);
      await page.waitForTimeout(900);
      const r = await page.evaluate(MEASURE, { rincian: 'li button[aria-expanded] > svg' });
      report(`dashboard 1280 ${hash} ${locale} ${dueFormat}`, r, hash === 'tugas' ? [['rincian']] : []);
    }
    if (dueFormat === FORMATS[0]) {
      // A real toast: one task marked done on Tugas (the page still open there).
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.locator('li [role="checkbox"][aria-checked="false"]').first().click();
      await page.waitForSelector('.db-toasts .sulo-toast', { timeout: 3000 }).catch(() => null);
      await page.hover('.db-toasts .sulo-toast').catch(() => null); // paused while hovered
      const t = await page.evaluate(MEASURE_TOAST, TOAST_TEXTS[locale]);
      const lines = t.missing ? ['toast tidak muncul setelah tugas ditandai selesai'] : t.bad;
      failed += lines.length;
      console.log(`${lines.length ? 'GAGAL' : 'ok   '} toast sidebar 1280 ${locale}: ${TOAST_TEXTS[locale].length + 1} teks${lines.length ? `\n  ${lines.join('\n  ')}` : ''}`);
    }
    await page.close();
  }
}
await ctx.close();
for (const e of errors) console.log(`GAGAL galat halaman ${e}`);
failed += errors.length;
console.log(failed ? `check-fit: ${failed} temuan` : 'check-fit: semua teks waktu satu baris di ukuran penuh, tepi kanan daftar sejajar, toast sidebar paling dua baris.');
process.exit(failed ? 1 : 0);

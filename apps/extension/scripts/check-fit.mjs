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
    await page.close();
  }
}
await ctx.close();
for (const e of errors) console.log(`GAGAL galat halaman ${e}`);
failed += errors.length;
console.log(failed ? `check-fit: ${failed} temuan` : 'check-fit: semua teks waktu satu baris di ukuran penuh, tepi kanan daftar sejajar.');
process.exit(failed ? 1 : 0);

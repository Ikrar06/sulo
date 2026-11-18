#!/usr/bin/env node
// Render check, part 1: every relative-time and countdown text the hero card can
// show stays on one line in the real card (pnpm mobile:web, the app's own
// CSS and font), in Indonesian and English, at 360 and 384 px wide. The
// texts come from core's own formatters in the page, from a year late to
// 90 days ahead, minute by minute near now. At text zoom 100% every text
// must fit at 22 px; at 130% it may step down to 18 but never be cut.
// Part 2: every greeting line 2 in core's phrase lists (both languages,
// every slot, midnight too; read from core, so new phrases are measured
// too) and a 24-character nickname, through the live GreetingLines: no
// cut, no overflow, nothing under the mascot, no orphan word.
// Exit 1 on any failure. Usage: node scripts/check-countdown-fit.mjs
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE, ROOT } from './env.mjs';

const PORT = 5184;
const CORE = join(ROOT, 'packages/core/src');
const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', String(PORT), '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve()));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const lines = [];
const greetings = [];
const attendance = [];
const events = [];
let failed = 0;

async function check(lang, width, zoom) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === 'en' ? 'en-US' : 'id-ID', timezoneId: 'Asia/Makassar', reducedMotion: 'reduce' });
  if (zoom !== 1) await context.addInitScript((z) => document.addEventListener('DOMContentLoaded', () => document.documentElement.style.setProperty('--m-tz', String(z))), zoom);
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/?lang=${lang}`);
  await page.waitForTimeout(600);
  // Past the onboarding (its own screens: scripts/onboarding-shots.mjs): the demo account, signed in.
  await page.waitForFunction(() => typeof window.__suloEnterDemo === 'function');
  await page.evaluate(() => window.__suloEnterDemo());
  await page.waitForTimeout(600);
  const later = page.getByRole('button', { name: lang === 'en' ? 'Later' : 'Nanti', exact: true });
  if (await later.isVisible()) await later.click();
  await page.waitForTimeout(800);
  // Part 3: the attendance card in "Akademik" with the longest course name: the name in two
  // lines at most (an ellipsis only beyond that), the percent row never overflowing, both cards one height.
  const att = await page.evaluate(() => {
    const el = document.querySelector('[data-fit-attendance]');
    if (!el) return { error: 'kartu presensi tidak ditemukan' };
    const names = window.__suloCourseNames ?? [];
    const longest = [...names].sort((a, b) => b.length - a.length)[0] ?? '';
    const copy = el.cloneNode(false);
    copy.textContent = longest;
    copy.style.display = 'block';
    copy.style.webkitLineClamp = 'unset';
    copy.style.visibility = 'hidden';
    copy.style.position = 'absolute';
    copy.style.width = `${el.getBoundingClientRect().width}px`;
    el.parentElement.appendChild(copy);
    const lh = parseFloat(getComputedStyle(copy).lineHeight);
    const lines = Math.round(copy.getBoundingClientRect().height / lh);
    copy.remove();
    const row = el.previousElementSibling;
    const [a, b] = [...el.closest('.grid').children].map((c) => Math.round(c.getBoundingClientRect().height));
    return { name: longest, lines, rowOverflow: row.scrollWidth > row.clientWidth + 0.5, equal: a === b };
  });
  attendance.push({ ...att, lang, width, zoom });
  // Part 4: Kalender's event cards with the longest event name: the title in two lines at most,
  // the bottom row (dates, then the chips) never pushing a chip out of the card.
  await page.getByRole('tab', { name: lang === 'en' ? /^Calendar/ : /^Kalender/ }).click();
  await page.waitForTimeout(500);
  const ev = await page.evaluate(() => {
    const el = document.querySelector('[data-fit-event]');
    if (!el) return { error: 'kartu acara tidak ditemukan' };
    const longest = [...(window.__suloEventTitles ?? [])].sort((a, b) => b.length - a.length)[0] ?? '';
    const row = el.nextElementSibling;
    const before = el.textContent;
    const copy = el.cloneNode(false);
    copy.textContent = longest;
    copy.style.cssText = 'display:block;-webkit-line-clamp:unset;visibility:hidden;position:absolute';
    copy.style.width = `${el.getBoundingClientRect().width}px`;
    el.parentElement.appendChild(copy);
    const lines = Math.round(copy.getBoundingClientRect().height / parseFloat(getComputedStyle(copy).lineHeight));
    copy.remove();
    const chipsCut = [...row.children].slice(1).some((c) => c.scrollWidth > c.clientWidth + 0.5 || c.getBoundingClientRect().right > row.getBoundingClientRect().right + 0.5);
    return { name: longest, lines, chipsCut, rowOverflow: row.scrollWidth > row.clientWidth + 0.5, before };
  });
  events.push({ ...ev, lang, width, zoom });
  await page.getByRole('tab', { name: lang === 'en' ? /^Home|^Overview|^Ringkasan/ : /^Ringkasan/ }).click().catch(() => undefined);
  await page.waitForTimeout(300);
  // Greetings first, on the untouched page (part 1 swaps the hero's text).
  const g = await page.evaluate(
    async ({ lang }) => {
      // Core's lists as the app holds them (GreetingLines exposes them in the web build).
      const w = window.__suloGreetPhrases.find((x) => x.lang === lang);
      w.greet = { line1: w.line1, phrases: w.phrases };
      const rows = [];
      for (const [slot, list] of Object.entries(w.greet.phrases)) {
        const line1 = w.greet.line1[slot];
        for (const p of list) rows.push({ line1, text: p.text, ...window.__suloFitGreeting(line1, p.text) });
      }
      // The longest nickname allowed (24 characters), then its period.
      const nick = 'Muh. Rizky Akbar Pratama';
      rows.push({ line1: w.greet.line1.pagi, text: `${nick}.`, ...window.__suloFitGreeting(w.greet.line1.pagi, `${nick}.`) });
      return rows;
    },
    { lang },
  );
  greetings.push(...g.map((row) => ({ ...row, lang, width, zoom })));
  const r = await page.evaluate(
    async ({ core, lang }) => {
      const { countdownOrLate, formatLeft } = await import(`/@fs${core}/format/time.ts`);
      const words = lang === 'en' ? (await import(`/@fs${core}/i18n/en.ts`)).en : (await import(`/@fs${core}/i18n/id.ts`)).id;
      const now = Math.floor(Date.now() / 1000);
      const tz = 'Asia/Makassar';
      const texts = new Set();
      const add = (off) => (texts.add(formatLeft(now + off, now, tz, words)), texts.add(countdownOrLate(now + off, now, tz, words)));
      for (let i = -24 * 60; i < 24 * 60; i++) add(i * 60);
      for (let d = -366; d <= 90; d++) (add(d * 86_400 - 1), add(d * 86_400 + 86_399));
      const hero = document.querySelector('main [data-fit]');
      if (!hero) return { error: 'kartu hero tidak ditemukan' };
      // Measured on the hero line itself (its own classes and place), text swapped and restored.
      const original = hero.textContent;
      const room = hero.clientWidth;
      hero.style.width = 'max-content';
      hero.style.maxWidth = 'none';
      const natural = (text, size) => {
        hero.classList.remove('text-m22', 'text-m18');
        hero.classList.add(size);
        hero.textContent = text;
        return hero.getBoundingClientRect().width;
      };
      const fits = (text, size) => natural(text, size) <= room + 0.5;
      const at22 = [...texts].filter((t) => !fits(t, 'text-m22'));
      const at18 = at22.filter((t) => !fits(t, 'text-m18'));
      let widest = '';
      let w = 0;
      for (const t of texts) {
        const n = natural(t, 'text-m22');
        if (n > w) (w = Math.ceil(n)), (widest = t);
      }
      const zoom = `${getComputedStyle(document.documentElement).getPropertyValue('--m-tz').trim() || '1'}, ${getComputedStyle(hero).fontSize}`;
      hero.style.width = '';
      hero.style.maxWidth = '';
      hero.textContent = original;
      return { count: texts.size, at22, at18, widest, w, room, zoom };
    },
    { core: CORE, lang },
  );
  await context.close();
  if (r.error) {
    failed++;
    return lines.push(`${lang} ${width} zoom ${zoom * 100}%: GAGAL, ${r.error}`);
  }
  const bad = zoom === 1 ? r.at22 : r.at18;
  if (bad.length > 0) failed++;
  lines.push(`${lang} ${width} zoom ${zoom * 100}%: ${r.count} teks; terlebar "${r.widest}" ${r.w}/${r.room} px di 22 (--m-tz ${r.zoom}); tidak muat di 22: ${r.at22.length}; tidak muat di 18: ${r.at18.length}${bad.length > 0 ? `  << GAGAL: ${bad.slice(0, 3).join(', ')}` : ''}`);
}

try {
  for (const lang of ['id', 'en']) for (const width of [360, 384]) for (const zoom of [1, 1.3]) await check(lang, width, zoom);
} finally {
  await browser.close();
  // The whole group: pnpm and the vite it started (killing pnpm alone leaves vite running).
  process.kill(-server.pid);
}
console.log(lines.join('\n'));
// Greeting table: one row per phrase, the size and line count at each width and zoom.
const bad = greetings.filter((g) => g.overflow || g.collides || g.orphan);
const byText = new Map();
for (const g of greetings) {
  const key = `${g.lang} | ${g.text}`;
  byText.set(key, [...(byText.get(key) ?? []), `${g.width}@${Math.round(g.zoom * 100)}%: ${g.line2}${g.twoLines ? 'x2' : ''}${g.line1 !== 26 ? ` (baris 1 ${g.line1})` : ''}`]);
}
console.log('\nSapaan baris 2 (ukuran, x2 = dua baris):');
for (const [k, v] of byText) console.log(`  ${k}  ->  ${v.join(' · ')}`);
if (bad.length > 0) {
  failed += bad.length;
  console.error(bad.map((g) => `GAGAL sapaan ${g.lang} ${g.width}@${g.zoom}: "${g.text}" kolom ${g.colWidth} font ${g.fontPx} fit ${g.line1}/${g.line2}${g.twoLines ? 'x2' : ''} ${g.overflow ? 'meluap ' : ''}${g.collides ? 'tabrak maskot ' : ''}${g.orphan ? 'kata yatim' : ''}`).join('\n'));
}
console.log('\nKartu Presensi (nama terpanjang):');
for (const a of attendance) {
  // An ellipsis after two lines is the allowed fallback; at 384 px and 100% the longest name must fit in two.
  const tooLong = a.lines > 2 && a.width === 384 && a.zoom === 1;
  const bad = a.error || a.rowOverflow || !a.equal || tooLong;
  if (bad) failed++;
  console.log(`  ${a.lang} ${a.width}@${Math.round(a.zoom * 100)}%: "${a.name}" ${a.lines} baris${a.lines > 2 ? ' (elipsis di baris 2)' : ''}${a.rowOverflow ? ', baris persen meluap' : ''}${a.equal ? '' : ', tinggi kartu beda'}${a.error ? ` ${a.error}` : ''}${bad ? '  << GAGAL' : ''}`);
}
console.log('\nKartu acara Kalender (nama terpanjang):');
for (const e of events) {
  const bad = e.error || e.chipsCut || e.rowOverflow;
  if (bad) failed++;
  console.log(`  ${e.lang} ${e.width}@${Math.round(e.zoom * 100)}%: "${e.name}" ${e.lines} baris${e.lines > 2 ? ' (elipsis di baris 2)' : ''}${e.chipsCut ? ', chip terpotong' : ''}${e.rowOverflow ? ', baris bawah meluap' : ''}${e.error ? ` ${e.error}` : ''}${bad ? '  << GAGAL' : ''}`);
}
if (failed > 0) {
  console.error(`check-countdown-fit: ${failed} kombinasi gagal`);
  process.exit(1);
}
console.log('check-countdown-fit: semua teks waktu satu baris; semua sapaan muat tanpa elipsis.');

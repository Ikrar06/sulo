#!/usr/bin/env node
// Render check: every relative-time and countdown text the hero card can
// show stays on one line in the real card (pnpm mobile:web, the app's own
// CSS and font), in Indonesian and English, at 360 and 384 px wide. The
// texts come from core's own formatters in the page, from a year late to
// 90 days ahead, minute by minute near now. At text zoom 100% every text
// must fit at 22 px; at 130% it may step down to 18 but never be cut.
// Exit 1 on any failure. Usage: node scripts/check-countdown-fit.mjs
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE, ROOT } from './env.mjs';

const PORT = 5184;
const CORE = join(ROOT, 'packages/core/src');
const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', String(PORT), '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve()));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const lines = [];
let failed = 0;

async function check(lang, width, zoom) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === 'en' ? 'en-US' : 'id-ID', timezoneId: 'Asia/Makassar', reducedMotion: 'reduce' });
  if (zoom !== 1) await context.addInitScript((z) => document.addEventListener('DOMContentLoaded', () => document.documentElement.style.setProperty('--m-tz', String(z))), zoom);
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/?lang=${lang}`);
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: lang === 'en' ? 'Sign in to SIKOLA' : 'Masuk ke SIKOLA' }).click();
  await page.waitForTimeout(600);
  const later = page.getByRole('button', { name: lang === 'en' ? 'Later' : 'Nanti', exact: true });
  if (await later.isVisible()) await later.click();
  await page.waitForTimeout(800);
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
  server.kill();
}
console.log(lines.join('\n'));
if (failed > 0) {
  console.error(`check-countdown-fit: ${failed} kombinasi gagal`);
  process.exit(1);
}
console.log('check-countdown-fit: semua teks waktu satu baris.');

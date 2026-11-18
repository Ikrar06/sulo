#!/usr/bin/env node
// Ringkasan's hero and "Berikutnya" at 384x832 and 360x800, light and dark:
// with a task overdue by the widest time text (?demo=panjang) and with an
// upcoming one (?demo=aman). Reports, per shot: the hero time on one line,
// its size, the carousel's first card at 16 px with nothing cut on the left,
// the chips' width against the card, and each card's room above its footer.
// Usage: node scripts/ringkasan-hero-shots.mjs <outDir>
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE } from './env.mjs';

const out = process.argv[2];
if (!out) throw new Error('outDir missing');
mkdirSync(out, { recursive: true });
const PORT = 5185;
const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', String(PORT), '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve()));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const notes = [];
async function shot(width, height, scheme, demo, name) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Makassar', colorScheme: scheme, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-11-18T10:00:00+08:00'));
  await page.goto(`http://localhost:${PORT}/?demo=${demo}`);
  await page.waitForTimeout(600);
  // Past the onboarding (its own screens: scripts/onboarding-shots.mjs): the demo account, signed in.
  await page.waitForFunction(() => typeof window.__suloEnterDemo === 'function');
  await page.evaluate(() => window.__suloEnterDemo());
  await page.waitForTimeout(600);
  const later = page.getByRole('button', { name: 'Nanti', exact: true });
  if (await later.isVisible()) await later.click();
  await page.waitForTimeout(900);
  const file = `${width}x${height}-${scheme}-${name}.png`;
  await page.screenshot({ path: join(out, file) });
  // The carousel in view too.
  await page.evaluate(() => document.querySelector('main')?.scrollTo({ top: 330 }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, file.replace('.png', '-carousel.png')) });
  const r = await page.evaluate(() => {
    const hero = document.querySelector('main [data-fit]');
    const lh = parseFloat(getComputedStyle(hero).lineHeight);
    const ul = document.querySelector('main ul.m-carousel');
    const first = ul?.querySelector('li')?.getBoundingClientRect();
    const cards = [...(ul?.querySelectorAll('li') ?? [])].map((li) => {
      const card = li.querySelector('section').getBoundingClientRect();
      const chip = li.querySelector('span.inline-flex')?.getBoundingClientRect();
      const title = li.querySelector('p').getBoundingClientRect();
      const foot = li.querySelector('section > div > div:last-child').getBoundingClientRect();
      return { chip: Math.round(chip?.width ?? 0), card: Math.round(card.width), gap: Math.round(foot.top - title.bottom) };
    });
    return { text: hero.textContent, oneLine: hero.getBoundingClientRect().height <= lh + 1, size: getComputedStyle(hero).fontSize, scrollLeft: ul?.scrollLeft ?? null, firstLeft: first ? Math.round(first.left) : null, cards };
  });
  notes.push(`${file}: hero "${r.text}" satu baris: ${r.oneLine}, ${r.size}; carousel scrollLeft ${r.scrollLeft}, kartu pertama di x=${r.firstLeft}; chip/kartu ${r.cards.map((c) => `${c.chip}/${c.card}`).join(' ')}; judul ke kaki ${r.cards.map((c) => c.gap).join('/')} px`);
  await context.close();
}
try {
  for (const [w, h] of [[384, 832], [360, 800]])
    for (const scheme of ['light', 'dark'])
      for (const [demo, name] of [['panjang', 'terlambat'], ['aman', 'mendatang']]) await shot(w, h, scheme, demo, name);
} finally {
  await browser.close();
  // The whole group: pnpm and the vite it started (killing pnpm alone leaves vite running).
  process.kill(-server.pid);
}
console.log(notes.join('\n'));

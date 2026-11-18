#!/usr/bin/env node
// Ringkasan at 384x832, light and dark: the top, mid-scroll (the fade under
// the header) and the bottom (the 7-day card clear of the tab bar). Also
// reports the carousel's card heights, the 7-day card's bottom gap above
// the tab bar, and taps a day column to check the Tugas date chip.
// Usage: node scripts/ringkasan-scroll-shots.mjs <outDir>
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE } from './env.mjs';

const out = process.argv[2];
if (!out) throw new Error('outDir missing');
mkdirSync(out, { recursive: true });
const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', '5181', '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes('5181') && resolve()));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const notes = [];
async function run(scheme) {
  const context = await browser.newContext({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Makassar', colorScheme: scheme });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-11-18T10:00:00+08:00'));
  await page.goto('http://localhost:5181/');
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Masuk ke SIKOLA' }).click();
  await page.waitForTimeout(600);
  const later = page.getByRole('button', { name: 'Nanti' });
  if (await later.isVisible()) await later.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(out, `ringkasan-${scheme}-atas.png`) });
  await page.evaluate(() => document.querySelector('main')?.scrollTo({ top: 420 }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, `ringkasan-${scheme}-tengah.png`) });
  await page.evaluate(() => { const m = document.querySelector('main'); m?.scrollTo({ top: m.scrollHeight }); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, `ringkasan-${scheme}-bawah.png`) });
  const m = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.m-carousel li')].map((li) => Math.round(li.getBoundingClientRect().height));
    const week = document.querySelector('[aria-labelledby="week-title"]')?.getBoundingClientRect();
    const bar = document.querySelector('[role="tablist"]')?.getBoundingClientRect();
    const cols = [...document.querySelectorAll('[aria-labelledby="week-title"] li')].map((l) => Math.round(l.getBoundingClientRect().width));
    const ol = document.querySelector('[aria-labelledby="week-title"] ol');
    return { cards, gap: week && bar ? Math.round(bar.top - week.bottom) : null, cols, scroll: ol ? ol.scrollWidth > ol.clientWidth : null, labels: [...document.querySelectorAll('[aria-labelledby="week-title"] button')].map((b) => b.getAttribute('aria-label')) };
  });
  notes.push(`${scheme}: kartu carousel ${m.cards.join('/')} px; kolom 7 hari ${m.cols.join('/')} px, gulir: ${m.scroll}; jarak kartu 7 hari ke tab bar ${m.gap} px`);
  if (scheme === 'light') {
    notes.push(`label: ${m.labels.slice(0, 3).join(' | ')}`);
    await page.locator('[aria-labelledby="week-title"] button').nth(2).click();
    await page.waitForTimeout(500);
    const chip = await page.locator('main [role="group"] button').first().getAttribute('aria-label');
    notes.push(`ketuk kolom 3 -> Tugas, chip: ${chip}`);
    await page.screenshot({ path: join(out, 'tugas-filter-tanggal.png') });
  }
  await context.close();
}
try {
  await run('light');
  await run('dark');
} finally {
  await browser.close();
  // The whole group: pnpm and the vite it started (killing pnpm alone leaves vite running).
  process.kill(-server.pid);
}
console.log(notes.join('\n'));

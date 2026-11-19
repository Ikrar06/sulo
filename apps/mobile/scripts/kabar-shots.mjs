#!/usr/bin/env node
// Kabar terbaru at 384x832, light and dark: no filter, the kind sheet, the
// course sheet, both filters on, and a filter with no result. Also reports
// whether the filter row fits without scrolling and the card heights.
// Usage: node scripts/kabar-shots.mjs <outDir>
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE } from './env.mjs';

const out = process.argv[2];
if (!out) throw new Error('outDir missing');
mkdirSync(out, { recursive: true });
const PORT = 5183;
const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', String(PORT), '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve()));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const notes = [];
async function run(scheme) {
  const context = await browser.newContext({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Makassar', colorScheme: scheme, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-11-18T10:00:00+08:00'));
  const shot = async (name) => (await page.waitForTimeout(400), page.screenshot({ path: join(out, `kabar-${scheme}-${name}.png`) }));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(600);
  // Past the onboarding (its own screens: scripts/onboarding-shots.mjs): the demo account, signed in.
  await page.waitForFunction(() => typeof window.__suloEnterDemo === 'function');
  await page.evaluate(() => window.__suloEnterDemo());
  await page.waitForTimeout(600);
  const later = page.getByRole('button', { name: 'Nanti', exact: true });
  if (await later.isVisible()) await later.click();
  await page.waitForTimeout(600);
  await page.getByRole('tab', { name: /^Lainnya/ }).click();
  await page.getByRole('main').getByRole('button', { name: /^Kabar/ }).first().click();
  await page.waitForTimeout(500);
  await shot('1-tanpa-filter');
  const m = await page.evaluate(() => {
    const row = document.querySelector('main [aria-haspopup="dialog"]')?.closest('div')?.parentElement;
    const cards = [...document.querySelectorAll('main li > section.m-card')].map((c) => Math.round(c.getBoundingClientRect().height));
    return { fits: row ? row.scrollWidth <= row.clientWidth : null, pills: [...document.querySelectorAll('main [aria-haspopup="dialog"]')].map((b) => Math.round(b.parentElement.getBoundingClientRect().height)), cards };
  });
  notes.push(`${scheme}: baris filter muat tanpa geser: ${m.fits}; tinggi pil ${m.pills.join('/')} px; tinggi kartu ${m.cards.join('/')} px`);
  const pill = (i) => page.locator('main [aria-haspopup="dialog"]').nth(i);
  await pill(0).click();
  await shot('2-sheet-jenis');
  await page.getByRole('dialog').getByRole('option').nth(1).getByRole('button').click();
  await pill(1).click();
  await shot('3-sheet-mata-kuliah');
  const options = page.getByRole('dialog').getByRole('option');
  await options.nth(1).getByRole('button').click();
  await shot('4-dua-filter-aktif');
  // A combination with nothing: try each course with the current kind.
  const count = await (async () => {
    await pill(1).click();
    const n = await page.getByRole('dialog').getByRole('option').count();
    await page.keyboard.press('Escape');
    return n;
  })();
  let empty = false;
  for (let i = 1; i < count && !empty; i++) {
    await pill(1).click();
    await page.getByRole('dialog').getByRole('option').nth(i).getByRole('button').click();
    await page.waitForTimeout(250);
    empty = await page.getByText('Tidak ada kabar untuk filter ini.').isVisible();
  }
  if (empty) await shot('5-hasil-kosong');
  notes.push(`${scheme}: hasil kosong ditemukan: ${empty}`);
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

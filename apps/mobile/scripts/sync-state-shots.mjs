#!/usr/bin/env node
// Frames of the updating state with the demo account (pnpm mobile:web, no
// real data): signing in again with old data on screen, and a first open with
// no data at all (the skeleton). Light and dark. Usage:
//   node scripts/sync-state-shots.mjs <out dir>
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE } from './env.mjs';

const OUT = process.argv[2] ?? join(MOBILE, '../../.output/sync-state-shots');
mkdirSync(OUT, { recursive: true });
const PORT = 5187;
const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', String(PORT), '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve()));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  for (const scheme of ['light', 'dark']) {
    // 1. Signing in again with old data: the demo account, then its session ended.
    {
      const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, locale: 'id-ID' });
      const page = await context.newPage();
      await page.goto(`http://localhost:${PORT}/?lang=id`);
      await page.waitForFunction(() => typeof window.__suloEnterDemo === 'function');
      await page.evaluate(() => window.__suloEnterDemo());
      await sleep(800);
      const later = page.getByRole('button', { name: 'Nanti', exact: true });
      if (await later.isVisible()) await later.click();
      // The session ends (the fake's own switch), the app reopens on Ringkasan with "Masuk lagi".
      await page.goto(`http://localhost:${PORT}/?lang=id&session=ended`);
      await sleep(1500);
      await page.screenshot({ path: join(OUT, `relogin-${scheme}-0-masuk-lagi.png`) });
      await page.locator('button', { hasText: 'Masuk lagi' }).first().click();
      for (let i = 1; i <= 10; i++) {
        await sleep(160);
        await page.screenshot({ path: join(OUT, `relogin-${scheme}-${String(i).padStart(2, '0')}.png`) });
      }
      await sleep(1200);
      await page.screenshot({ path: join(OUT, `relogin-${scheme}-99-sudah-terbaru.png`) });
      await context.close();
    }
    // 2. No data at all: signed in, the onboarding done, nothing stored yet.
    {
      const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, colorScheme: scheme, locale: 'id-ID' });
      await context.addInitScript(() => localStorage.setItem('CapacitorStorage.sulo:mobile:onboarding', JSON.stringify({ step: 'finished', mode: 'first' })));
      const page = await context.newPage();
      await page.goto(`http://localhost:${PORT}/?lang=id&session=connected`);
      await sleep(1500);
      await page.screenshot({ path: join(OUT, `nodata-${scheme}.png`) });
      await context.close();
    }
  }
} finally {
  await browser.close();
  process.kill(-server.pid);
}
console.log(`sync-state-shots: ${OUT}`);

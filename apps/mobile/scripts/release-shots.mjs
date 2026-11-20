#!/usr/bin/env node
// The new-version notice (M8e E3) with synthetic data (pnpm mobile:web,
// ?release=available|required): Ringkasan's card, Tentang's row and the
// required-update screen, 360x800 and 384x832, light and dark, both
// languages. Usage: node scripts/release-shots.mjs [out dir]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE } from './env.mjs';

const OUT = process.argv[2] ?? join(MOBILE, '../../.output/release-shots');
mkdirSync(OUT, { recursive: true });
const PORT = 5189;
const QUICK = process.env.QUICK === '1';
const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', String(PORT), '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve()));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let count = 0;
try {
  for (const [w, h] of QUICK ? [[360, 800]] : [[360, 800], [384, 832]]) {
    for (const scheme of QUICK ? ['light'] : ['light', 'dark']) {
      for (const lang of QUICK ? ['id', 'en'] : ['id', 'en']) {
        for (const mode of ['available', 'required']) {
          const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, locale: lang === 'id' ? 'id-ID' : 'en-US' });
          const page = await context.newPage();
          await page.goto(`http://localhost:${PORT}/?lang=${lang}&release=${mode}`);
          await page.waitForFunction(() => typeof window.__suloEnterDemo === 'function');
          await page.evaluate(() => window.__suloEnterDemo());
          await sleep(2600);
          for (const name of ['Nanti', 'Later']) {
            const b = page.getByRole('button', { name, exact: true }).first();
            if (mode === 'required') break;
            // The notification prompt's "Nanti" comes first; the release card's own "Nanti" stays.
            if ((await b.isVisible().catch(() => false)) && (await page.getByText(lang === 'id' ? 'Izinkan pengingat' : 'Allow reminders').isVisible().catch(() => false))) await b.click();
          }
          if (mode === 'required') await page.reload();
          await sleep(1500);
          const tag = `${w}x${h}-${scheme}-${lang}`;
          await page.screenshot({ path: join(OUT, `${mode}-ringkasan-${tag}.png`) });
          count++;
          if (mode === 'available') {
            await page.evaluate(() => (location.hash = '#tentang'));
            await sleep(700);
            await page.screenshot({ path: join(OUT, `available-tentang-${tag}.png`) });
            count++;
          }
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  process.kill(-server.pid);
}
console.log(`release-shots: ${count} gambar di ${OUT}`);

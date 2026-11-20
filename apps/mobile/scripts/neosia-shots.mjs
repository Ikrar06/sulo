#!/usr/bin/env node
// NEOSIA on Android (M8d B5) with synthetic data only (pnpm mobile:web, the
// extension's demo snapshots; no real name, grade or schedule): Jadwal,
// Nilai hidden and shown, Ringkasan's cards (Kuliah hari ini, Studi,
// Kesiapan KRS), the checklist card at each stage, Pengaturan > NEOSIA.
// 360x800 and 384x832, light and dark, Indonesian and English. Usage:
//   node scripts/neosia-shots.mjs [out dir]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE } from './env.mjs';

const OUT = process.argv[2] ?? join(MOBILE, '../../.output/neosia-shots');
mkdirSync(OUT, { recursive: true });
const PORT = 5188;
// QUICK=1: one size, light, Indonesian (a look while working).
const QUICK = process.env.QUICK === '1';
const SIZES = QUICK ? [[360, 800]] : [
  [360, 800],
  [384, 832],
];
const SCHEMES = QUICK ? ['light'] : ['light', 'dark'];
const LANGS = QUICK ? ['id'] : ['id', 'en'];
const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', String(PORT), '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve()));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let count = 0;

/** A fresh demo account with these query switches; returns the page on Ringkasan. */
async function open(size, scheme, lang, query) {
  const context = await browser.newContext({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, locale: lang === 'id' ? 'id-ID' : 'en-US' });
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/?lang=${lang}&${query}`);
  await page.waitForFunction(() => typeof window.__suloEnterDemo === 'function');
  await page.evaluate(() => window.__suloEnterDemo());
  await sleep(2600);
  for (const name of ['Nanti', 'Later', 'Not now']) {
    const b = page.getByRole('button', { name, exact: true });
    if (await b.isVisible().catch(() => false)) await b.click();
  }
  await sleep(300);
  return { context, page };
}

/** One frame; `full` makes the window as tall as the screen's scrolled content (the app scrolls inside <main>). */
const shot = async (page, name, full = true) => {
  await sleep(450);
  const size = page.viewportSize();
  if (full) {
    const extra = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? main.scrollHeight - main.clientHeight : 0;
    });
    if (extra > 0) await page.setViewportSize({ width: size.width, height: size.height + extra });
    await sleep(250);
  }
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  if (full) await page.setViewportSize(size);
  count++;
};
const go = async (page, hash) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await sleep(600);
};

try {
  for (const size of SIZES) {
    for (const scheme of SCHEMES) {
      for (const lang of LANGS) {
        const tag = `${size[0]}x${size[1]}-${scheme}-${lang}`;
        // Everything in: Ringkasan's cards, Jadwal, Nilai hidden, Lainnya's Akademik pair.
        {
          const { context, page } = await open(size, scheme, lang, 'neosia=all');
          await shot(page, `ringkasan-${tag}`);
          await go(page, '#jadwal');
          await shot(page, `jadwal-${tag}`);
          await go(page, '#nilai');
          await shot(page, `nilai-tersembunyi-${tag}`, false);
          await go(page, '#lainnya');
          await shot(page, `lainnya-${tag}`, false);
          await go(page, '#pengaturan/neosia');
          await shot(page, `pengaturan-neosia-${tag}`, false);
          await context.close();
        }
        // Grades shown.
        {
          const { context, page } = await open(size, scheme, lang, 'neosia=all&grades=1');
          await go(page, '#nilai');
          await shot(page, `nilai-tampil-${tag}`);
          await context.close();
        }
        // The checklist card at each stage (the top of Ringkasan).
        for (const stage of ['invite', 'new', 'beranda', 'unsupported']) {
          const { context, page } = await open(size, scheme, lang, `neosia=${stage}`);
          await shot(page, `checklist-${stage}-${tag}`, false);
          if (stage === 'new') {
            await page.getByRole('button', { name: lang === 'id' ? 'Berikutnya' : 'Next' }).first().click();
            await sleep(500);
            await shot(page, `checklist-masuk-${tag}`, false);
          }
          await context.close();
        }
        // NEOSIA's session ended: the calm line after trying to update.
        {
          const { context, page } = await open(size, scheme, lang, 'neosia=expired');
          await page.getByRole('button', { name: lang === 'id' ? 'Berikutnya' : 'Next' }).first().click();
          await sleep(500);
          await shot(page, `sesi-habis-${tag}`, false);
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  process.kill(-server.pid);
}
console.log(`neosia-shots: ${count} gambar di ${OUT}`);

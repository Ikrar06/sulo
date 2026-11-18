#!/usr/bin/env node
// Ringkasan and Tugas in each state (pnpm mobile:web, the synthetic demo
// account: ?demo= in src/fake/demo.ts), light and dark, at 384x832; one shot
// with reduced motion; density and tab-bar overlap checks; and a short clip
// of the mascot (entering, a tap, the last task done). Nothing is sent out.
// Usage: node scripts/state-shots.mjs <outDir>
import { spawn } from 'node:child_process';
import { mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE } from './env.mjs';

const out = process.argv[2];
if (!out) throw new Error('outDir missing');
mkdirSync(out, { recursive: true });
const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', '5178', '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes('5178') && resolve()));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const report = [];
const view = { width: 384, height: 832 };

async function start(context, demo) {
  const page = await context.newPage();
  await page.goto(`http://localhost:5178/${demo ? `?demo=${demo}` : ''}`);
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Masuk ke SIKOLA' }).click();
  await page.waitForTimeout(600);
  if (await page.getByRole('button', { name: 'Nanti' }).isVisible()) await page.getByRole('button', { name: 'Nanti' }).click();
  await page.waitForTimeout(900);
  return page;
}

/** Text the floating tab bar covers at the bottom of the scroll (should be none). */
const covered = (page) =>
  page.evaluate(async () => {
    const main = document.querySelector('main');
    main.scrollTo({ top: main.scrollHeight });
    await new Promise((r) => setTimeout(r, 300));
    const bar = document.querySelector('nav [role="tablist"]')?.getBoundingClientRect();
    if (!bar) return 0;
    let n = 0;
    for (const el of main.querySelectorAll('p, h2, h3, span')) {
      if (![...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom > bar.top && r.top < bar.bottom && r.height > 0) n++;
    }
    main.scrollTo({ top: 0 });
    return n;
  });
const fullCards = (page) =>
  page.evaluate(() => {
    const main = document.querySelector('main').getBoundingClientRect();
    const bottom = Math.min(main.bottom, document.querySelector('nav [role="tablist"]')?.getBoundingClientRect().top ?? main.bottom);
    return [...document.querySelectorAll('main li section.m-card')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= main.top && r.bottom <= bottom;
    }).length;
  });

try {
  for (const scheme of ['light', 'dark']) {
    for (const demo of ['', 'aman', 'kosong']) {
      const context = await browser.newContext({ viewport: view, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID', colorScheme: scheme });
      const page = await start(context, demo);
      const name = demo || 'terlambat';
      await page.screenshot({ path: join(out, `384x832-${scheme}-ringkasan-${name}.png`) });
      report.push(`${scheme} Ringkasan ${name}: teks tertutup tab bar di dasar gulir: ${await covered(page)}`);
      if (demo !== 'aman') {
        await page.getByRole('tab', { name: /^Tugas/ }).click();
        await page.waitForTimeout(700);
        const label = demo === 'kosong' ? 'kosong' : 'penuh';
        await page.screenshot({ path: join(out, `384x832-${scheme}-tugas-${label}.png`) });
        report.push(`${scheme} Tugas ${label}: ${await fullCards(page)} kartu terlihat penuh; teks tertutup tab bar: ${await covered(page)}`);
      }
      await context.close();
    }
  }
  // Reduced motion: the mascot is still, in its state's expression.
  {
    const context = await browser.newContext({ viewport: view, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID', colorScheme: 'light', reducedMotion: 'reduce' });
    const page = await start(context, '');
    await page.screenshot({ path: join(out, '384x832-light-ringkasan-reduced-motion.png') });
    await context.close();
  }
  // The clip: enter, a tap, the last task done (celebrate), then happy.
  {
    const context = await browser.newContext({ viewport: view, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID', colorScheme: 'light', recordVideo: { dir: out, size: { width: 384, height: 832 } } });
    const page = await context.newPage();
    await page.goto('http://localhost:5178/?demo=satu');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Masuk ke SIKOLA' }).click();
    await page.waitForTimeout(400);
    if (await page.getByRole('button', { name: 'Nanti' }).isVisible()) await page.getByRole('button', { name: 'Nanti' }).click();
    await page.waitForTimeout(2200);
    const mascot = page.locator('main [role="img"]').first();
    await mascot.tap();
    await page.waitForTimeout(2200);
    await mascot.tap();
    await page.waitForTimeout(1500);
    await page.getByRole('checkbox', { name: /^Tandai selesai/ }).first().tap();
    await page.waitForTimeout(6500);
    const video = page.video();
    await context.close();
    renameSync(await video.path(), join(out, 'klip-maskot-ringkasan.webm'));
  }
} finally {
  await browser.close();
  // The whole group: pnpm and the vite it started (killing pnpm alone leaves vite running).
  process.kill(-server.pid);
}
console.log(report.join('\n'));

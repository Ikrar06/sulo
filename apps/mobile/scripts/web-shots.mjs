#!/usr/bin/env node
// Screenshots of pnpm mobile:web at phone size (412x915), light and dark:
// onboarding, the notification question, every main screen and a task's
// details. The data is the synthetic demo account (src/fake/demo.ts).
// Usage: node scripts/web-shots.mjs [outDir] [--sizes=384x832,412x915] [--zoom=1.3]
// (default .output/mobile-shots, 412x915, text zoom 1). --zoom emulates
// Android's text size (WebView textZoom) through the app's --m-tz variable.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE, ROOT } from './env.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const out = args.find((a) => !a.startsWith('--')) ?? join(ROOT, '.output/mobile-shots');
const sizes = flag('sizes', '412x915').split(',').map((s) => s.split('x').map(Number));
const zoom = Number(flag('zoom', '1'));
mkdirSync(out, { recursive: true });
const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', '5175', '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes('5175') && resolve()));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const shots = [];
const report = [];
// The text sizes the app may render (src/tokens.css), times the zoom.
const TOKENS = [22, 18, 15, 13, 12, 11];
const fontCheck = (page) =>
  page.evaluate((allowed) => {
    const bad = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const px = Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10;
      if (!allowed.includes(px)) bad.add(`${px}px ${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 24)}"`);
    }
    return [...bad];
  }, TOKENS.map((t) => Math.round(t * zoom * 10) / 10));
/** Rows fully visible between the app bar and the tab bar. */
const visibleRows = (page, selector) =>
  page.evaluate((sel) => {
    const main = document.querySelector('main').getBoundingClientRect();
    // The floating tab bar covers the bottom: a card under it is not visible.
    const bottom = Math.min(main.bottom, document.querySelector('nav [role="tablist"]')?.getBoundingClientRect().top ?? main.bottom);
    return [...document.querySelectorAll(sel)].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= main.top && r.bottom <= bottom;
    }).length;
  }, selector);
try {
  for (const [width, height] of sizes)
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID' });
    if (zoom !== 1)
      await context.addInitScript((z) => {
        // Before the document exists there is no root to style yet: set it once the DOM is there.
        const apply = () => document.documentElement?.style.setProperty('--m-tz', String(z));
        apply();
        document.addEventListener('DOMContentLoaded', apply);
      }, zoom);
    const page = await context.newPage();
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    const shot = async (name) => {
      await page.waitForTimeout(500);
      const file = `${width}x${height}${zoom !== 1 ? `-zoom${Math.round(zoom * 100)}` : ''}-${scheme}-${name}.png`;
      await page.screenshot({ path: join(out, file) });
      shots.push(file);
      const bad = await fontCheck(page);
      if (bad.length > 0) report.push(`${file}: ukuran di luar token: ${bad.join('; ')}`);
    };
    // Details hide the tab bar: go back first.
    const back = async () => {
      const b = page.getByRole('button', { name: 'Kembali', exact: true });
      while (await b.isVisible().catch(() => false)) {
        await b.click();
        await page.waitForTimeout(250);
      }
    };
    const tab = async (name) => {
      await back();
      await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click();
    };
    const more = async (name) => {
      await tab('Lainnya');
      await page.getByRole('main').getByRole('button', { name }).click();
    };

    await page.goto('http://localhost:5175/');
    await page.waitForTimeout(800);
    await shot('01-onboarding');
    // Past the onboarding (its own screens: scripts/onboarding-shots.mjs): the demo account, signed in.
    await page.waitForFunction(() => typeof window.__suloEnterDemo === 'function');
    await page.evaluate(() => window.__suloEnterDemo());
    await page.waitForTimeout(800);
    if (await page.getByRole('button', { name: 'Nanti' }).isVisible()) {
      await shot('02-izin-notifikasi');
      await page.getByRole('button', { name: 'Nanti' }).click();
    }
    await shot('03-ringkasan');
    report.push(`${width}x${height} ${scheme} Ringkasan: hero+statistik terlihat: ${(await visibleRows(page, 'main .grid.grid-cols-3')) === 1}; awal carousel terlihat: ${await page.evaluate(() => { const c = document.querySelector('main .m-carousel li'); const tb = document.querySelector('nav [role="tablist"]')?.getBoundingClientRect().top ?? innerHeight; return !!c && c.getBoundingClientRect().top < tb; })}`);
    await tab('Tugas');
    await shot('04-tugas');
    report.push(`${width}x${height} ${scheme} Tugas: ${await visibleRows(page, 'main li > div > section.m-card')} kartu tugas terlihat utuh`);
    await page.getByRole('main').getByRole('button').filter({ hasText: /./ }).nth(2).click();
    await shot('05-rincian-tugas');
    await tab('Kalender');
    await shot('06-kalender-daftar');
    await page.getByRole('button', { name: 'Bulan', exact: true }).click();
    await shot('07-kalender-bulan');
    await tab('Presensi');
    await shot('08-presensi');
    await page.getByRole('main').getByRole('button', { name: /Mekanika Fluida/ }).click();
    await shot('09-presensi-rincian');
    await tab('Lainnya');
    await shot('10-lainnya');
    for (const [name, file] of [
      ['Kabar terbaru', '11-kabar'],
      ['Mata kuliah', '12-mata-kuliah'],
      ['Pengaturan', '13-pengaturan'],
      ['Bantuan', '14-bantuan'],
      ['Tentang', '15-tentang'],
      ['Privasi', '16-privasi'],
    ]) {
      await more(name);
      await shot(file);
    }
    await context.close();
  }
} finally {
  await browser.close();
  // The whole group: pnpm and the vite it started (killing pnpm alone leaves vite running).
  process.kill(-server.pid);
}
console.log(report.join('\n'));
console.log(`${shots.length} screenshot di ${out}`);

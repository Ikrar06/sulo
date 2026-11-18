#!/usr/bin/env node
// Screenshots of pnpm mobile:web at phone size (412x915), light and dark:
// onboarding, the notification question, every main screen and a task's
// details. The data is the synthetic demo account (src/fake/demo.ts).
// Usage: node scripts/web-shots.mjs [outDir]   (default .output/mobile-shots)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE, ROOT } from './env.mjs';

const out = process.argv[2] ?? join(ROOT, '.output/mobile-shots');
mkdirSync(out, { recursive: true });
const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', '5175', '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes('5175') && resolve()));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const shots = [];
try {
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID' });
    const page = await context.newPage();
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    const shot = async (name) => {
      await page.waitForTimeout(500);
      const file = `412x915-${scheme}-${name}.png`;
      await page.screenshot({ path: join(out, file) });
      shots.push(file);
    };
    const tab = (name) => page.getByRole('navigation').getByRole('button', { name: new RegExp(`^${name}`) }).click();
    const more = async (name) => {
      await tab('Lainnya');
      await page.getByRole('main').getByRole('button', { name }).click();
    };

    await page.goto('http://localhost:5175/');
    await page.waitForTimeout(800);
    await shot('01-onboarding');
    await page.getByRole('button', { name: 'Masuk ke SIKOLA' }).click();
    await page.waitForTimeout(800);
    if (await page.getByRole('button', { name: 'Nanti' }).isVisible()) {
      await shot('02-izin-notifikasi');
      await page.getByRole('button', { name: 'Nanti' }).click();
    }
    await shot('03-ringkasan');
    await tab('Tugas');
    await shot('04-tugas');
    await page.getByRole('main').getByRole('button').filter({ hasText: /./ }).nth(2).click();
    await shot('05-rincian-tugas');
    await tab('Kalender');
    await shot('06-kalender-daftar');
    await page.getByRole('button', { name: 'Bulan', exact: true }).click();
    await shot('07-kalender-bulan');
    await tab('Presensi');
    await shot('08-presensi');
    await page.getByRole('main').getByRole('link', { name: /Mekanika Fluida/ }).click();
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
  server.kill();
}
console.log(`${shots.length} screenshot di ${out}`);

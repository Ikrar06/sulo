#!/usr/bin/env node
// Ringkasan's greeting in each time slot (pnpm mobile:web, synthetic demo),
// Indonesian and English, at 384x832: the clock is fixed per shot, timers run.
// Usage: node scripts/greeting-shots.mjs <outDir>
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE } from './env.mjs';

const out = process.argv[2];
if (!out) throw new Error('outDir missing');
mkdirSync(out, { recursive: true });
const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', '5180', '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes('5180') && resolve()));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const SLOTS = [['pagi', '07:00'], ['siang', '12:00'], ['sore', '16:00'], ['malam', '20:00'], ['tengah-malam', '01:00']];
const shots = [];
async function shot(name, { time, lang, demo = 'aman', nick = '', scheme = 'light' }) {
  const context = await browser.newContext({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === 'en' ? 'en-US' : 'id-ID', timezoneId: 'Asia/Makassar', colorScheme: scheme });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(`2026-11-18T${time}:00+08:00`));
  await page.goto(`http://localhost:5180/?demo=${demo}&lang=${lang}${nick ? `&nick=${encodeURIComponent(nick)}` : ''}`);
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: lang === 'en' ? 'Sign in to SIKOLA' : 'Masuk ke SIKOLA' }).click();
  await page.waitForTimeout(600);
  const later = page.getByRole('button', { name: lang === 'en' ? 'Later' : 'Nanti' });
  if (await later.isVisible()) await later.click();
  await page.waitForTimeout(900);
  const text = await page.locator('main h2').first().innerText();
  const cut = await page.evaluate(() => { const l = document.querySelector('main h2')?.lastElementChild; return l ? l.scrollWidth > l.clientWidth + 1 : false; });
  const state = await page.locator('main h2 + p').first().innerText();
  await page.screenshot({ path: join(out, `${name}.png`) });
  shots.push(`${name}: ${text.replace('\n', ' / ')} | ${state}${cut ? '  << BARIS 2 TERPOTONG' : ''}`);
  await context.close();
}
try {
  for (const lang of ['id', 'en']) for (const [slot, time] of SLOTS) await shot(`384x832-${lang}-${slot}`, { time, lang });
  await shot('384x832-id-pagi-gelap', { time: '07:00', lang: 'id', scheme: 'dark' });
  await shot('384x832-en-malam-gelap', { time: '20:00', lang: 'en', scheme: 'dark' });
  await shot('384x832-id-dengan-nama', { time: '07:00', lang: 'id', nick: 'Ikrar' });
  await shot('384x832-id-malam-ada-terlambat', { time: '20:00', lang: 'id', demo: '' });
  await shot('384x832-en-siang-ada-terlambat', { time: '12:00', lang: 'en', demo: '' });
} finally {
  await browser.close();
  // The whole group: pnpm and the vite it started (killing pnpm alone leaves vite running).
  process.kill(-server.pid);
}
console.log(shots.join('\n'));

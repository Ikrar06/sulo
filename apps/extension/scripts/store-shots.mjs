#!/usr/bin/env node
// pnpm store:shots: five 1280x800 PNG screenshots for the Chrome Web Store
// and Edge Add-ons, light theme, Indonesian, from the synthetic demo data
// (scripts/lib/demo-storage.mjs; never a real name, student number or email).
// Uses the tester build, which has no development panels. Output (local,
// not committed): docs/rilis/store-shots/.
// Usage: pnpm store:shots [--no-build]

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { demoStorage } from './lib/demo-storage.mjs';

const root = new URL('..', import.meta.url).pathname;
const ext = join(root, '../../.output/chrome-mv3-tester');
const out = join(root, 'docs/rilis/store-shots');
if (!process.argv.includes('--no-build')) execFileSync('pnpm', ['zip:tester'], { cwd: root, stdio: 'inherit' });
mkdirSync(out, { recursive: true });

const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
const storage = demoStorage(root);
storage['global:prefs'] = { ...(storage['global:prefs'] ?? {}), locale: 'id', theme: 'light', nickname: 'Ayu' };
await sw.evaluate(async (s) => chrome.storage.local.set(s), storage);
await new Promise((r) => setTimeout(r, 1200));

const page = await ctx.newPage();
await page.setViewportSize({ width: 1280, height: 800 });
await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
const go = async (hash) => {
  await page.goto(`chrome-extension://${id}/dashboard.html#${hash}`);
  await page.waitForTimeout(1000);
};
const shot = async (name) => {
  await page.screenshot({ path: join(out, name) });
  console.log(name);
};

await go('ringkasan');
await shot('1-ringkasan.png');
await go('tugas');
await page.getByRole('button', { name: 'Rincian' }).first().click();
await page.waitForTimeout(400);
await shot('2-tugas-rincian.png');
await go('kabar');
await shot('3-kabar-terbaru.png');
await go('kalender');
await page.getByRole('button', { name: 'Bulan berikutnya' }).click();
await page.waitForTimeout(500);
await shot('4-kalender-desember.png');

// The popup next to a plain placeholder page (no real site is imitated).
const popup = await ctx.newPage();
await popup.setViewportSize({ width: 380, height: 540 });
await popup.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
await popup.goto(`chrome-extension://${id}/popup.html`);
await popup.waitForTimeout(1000);
const png = (await popup.screenshot()).toString('base64');
await page.setContent(`<!doctype html><html><body style="margin:0;background:#e9e9ee;font:14px system-ui">
  <div style="height:44px;background:#dcdce3;display:flex;align-items:center;padding:0 16px;gap:8px">
    <span style="width:12px;height:12px;border-radius:50%;background:#c4c4cc"></span><span style="width:12px;height:12px;border-radius:50%;background:#c4c4cc"></span><span style="width:12px;height:12px;border-radius:50%;background:#c4c4cc"></span>
    <div style="margin-left:16px;flex:1;height:26px;border-radius:13px;background:#f4f4f7"></div>
  </div>
  <div style="padding:48px 64px;display:grid;gap:16px;max-width:640px">
    ${'<div style="height:20px;border-radius:6px;background:#d6d6de"></div>'.repeat(1)}
    ${'<div style="height:12px;border-radius:6px;background:#dedee5"></div>'.repeat(6)}
  </div>
  <img src="data:image/png;base64,${png}" style="position:absolute;top:56px;right:24px;width:380px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.18)">
</body></html>`);
await page.waitForTimeout(300);
await shot('5-popup.png');

await ctx.close();
console.log(`Ditulis ke ${out}`);

#!/usr/bin/env node
// pnpm design:shots: the design inventory of the extension, for before and
// after comparisons (Tahap 2). Synthetic demo data only
// (scripts/lib/demo-*.mjs; no real name, student number or email). Every
// host other than the extension itself is unreachable (host resolver rules),
// so nothing reaches SIKOLA, NEOSIA or the data repository.
//   dashboard: every page, light and dark, Indonesian and English at 1280,
//              Indonesian at 1440; special states (empty, sync failed,
//              session ended, another account, saver, privacy)
//   popup:     every preview state at 380 wide, light and dark
//   onboarding: every step, light and dark, 1280x800 and 1440x900
// The dashboard and the real popup come from the tester build (no
// development panels); the preview states from the development build.
// Usage: node scripts/design-shots.mjs --out=<dir> [--no-build] [--only=dashboard,popup,onboarding,special]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { demoStorage } from './lib/demo-storage.mjs';
import { demoNeosia } from './lib/demo-neosia.mjs';
import { demoPresensi } from './lib/demo-presensi.mjs';

const root = new URL('..', import.meta.url).pathname;
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const out = arg('out', null);
if (!out) throw new Error('--out=<dir> is required');
const only = arg('only', null)?.split(',') ?? null;
const want = (k) => !only || only.includes(k);
const log = (m) => process.stderr.write(`design-shots: ${m}\n`);

if (!process.argv.includes('--no-build')) {
  execFileSync('pnpm', ['exec', 'wxt', 'build', '--mode', 'tester'], { cwd: root, stdio: 'ignore' });
  execFileSync('pnpm', ['exec', 'wxt', 'build', '--mode', 'development'], { cwd: root, stdio: 'ignore' });
}

const PAGES = ['ringkasan', 'tugas', 'mata-kuliah', 'presensi', 'kabar', 'kalender', 'jadwal', 'nilai', 'pengaturan', 'bantuan', 'tentang'];
const THEMES = ['light', 'dark'];
const OFFLINE = '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost';

async function open(build) {
  const ext = join(root, `../../.output/${build}`);
  const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, OFFLINE] });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  return { ctx, sw, id: new URL(sw.url()).host };
}

/** The demo account, fresh (so no sync starts), with attendance and NEOSIA. */
function seed(extra = {}) {
  const now = Math.floor(Date.now() / 1000);
  const s = { ...demoStorage(root), ...demoPresensi(), ...demoNeosia() };
  s['u:1:sync'] = { ...(s['u:1:sync'] ?? {}), lastSyncAt: now, lastCourseListAt: now };
  return { ...s, ...extra };
}

async function reset(sw, storage) {
  await sw.evaluate(async (s) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set(s);
  }, storage);
  await new Promise((r) => setTimeout(r, 400));
}

async function shoot(page, file, full = true) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: file, fullPage: full });
  log(file.replace(`${out}/`, ''));
}

// ---- Dashboard -----------------------------------------------------------------------
if (want('dashboard') || want('special')) {
  const { ctx, sw, id } = await open('chrome-mv3-tester');
  const page = await ctx.newPage();
  const go = async (hash, theme, width, height) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto(`chrome-extension://${id}/dashboard.html#${hash}`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
  };
  if (want('dashboard')) {
    for (const [locale, width, height] of [['id', 1280, 800], ['en', 1280, 800], ['id', 1440, 900]]) {
      for (const theme of THEMES) {
        await reset(sw, seed({ 'global:prefs': { locale, theme, nickname: 'Ayu' } }));
        const dir = join(out, 'dashboard', `${width}-${locale}-${theme}`);
        mkdirSync(dir, { recursive: true });
        for (const [i, p] of PAGES.entries()) {
          await go(p, theme, width, height);
          await shoot(page, join(dir, `${String(i + 1).padStart(2, '0')}-${p}.png`));
        }
      }
    }
  }
  if (want('special')) {
    const now = Math.floor(Date.now() / 1000);
    const STATES = [
      ['kosong', { 'u:1:tasks': [], 'u:1:changes': [] }, ['ringkasan', 'tugas', 'kabar']],
      ['gagal', { 'global:syncStatus': { lastOutcome: { status: 'parser_broken', at: now } } }, ['ringkasan']],
      ['sesi-habis', { 'global:session': { state: 'EXPIRED', userId: 1, checkedAt: now } }, ['ringkasan']],
      ['akun-berbeda', { 'global:accountPending': { userId: 2, detectedAt: now, lastCheckAt: now } }, ['ringkasan']],
      ['saver', { 'global:budget': { date: new Date().toLocaleDateString('sv-SE'), used: 90 } }, ['ringkasan']],
      ['privasi', {}, ['ringkasan', 'presensi', 'nilai']],
    ];
    for (const theme of THEMES) {
      for (const [name, extra, pages] of STATES) {
        await reset(sw, seed({ ...extra, 'global:prefs': { locale: 'id', theme, nickname: 'Ayu', privacyMode: name === 'privasi' } }));
        const dir = join(out, 'khusus', theme);
        mkdirSync(dir, { recursive: true });
        for (const p of pages) {
          await go(p, theme, 1280, 800);
          await shoot(page, join(dir, `${name}-${p}.png`), false);
        }
      }
    }
  }
  await ctx.close();
}

// ---- The real popup at 380, its settings menu closed and open ----------------------------
if (want('dashboard') || want('menu')) {
  const { ctx, sw, id } = await open('chrome-mv3-tester');
  mkdirSync(join(out, 'popup'), { recursive: true });
  for (const locale of ['id', 'en']) {
    for (const theme of THEMES) {
      await reset(sw, seed({ 'global:prefs': { locale, theme, nickname: 'Ayu' } }));
      const popup = await ctx.newPage();
      await popup.setViewportSize({ width: 380, height: 600 });
      await popup.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await popup.goto(`chrome-extension://${id}/popup.html`);
      await shoot(popup, join(out, 'popup', `asli-${locale}-${theme}.png`), false);
      await popup.getByRole('button', { name: locale === 'id' ? 'Pengaturan' : 'Settings', exact: true }).click();
      await shoot(popup, join(out, 'popup', `menu-${locale}-${theme}.png`), false);
      await popup.close();
    }
  }
  await ctx.close();
}

// ---- Preview: popup states and onboarding steps ------------------------------------------
if (want('popup') || want('onboarding')) {
  const { ctx, id } = await open('chrome-mv3-dev');
  const page = await ctx.newPage();
  const preview = async (query, theme, width, height) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto(`chrome-extension://${id}/preview.html?${query}&theme=${theme}`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
  };
  if (want('popup')) {
    const count = 15; // entrypoints/preview/fixtures.ts POPUP_STATES
    for (const theme of THEMES) {
      const dir = join(out, 'popup', theme);
      mkdirSync(dir, { recursive: true });
      for (let n = 0; n < count; n++) {
        await preview(`popup=${n}&lang=id`, theme, 380, 600);
        await shoot(page, join(dir, `${String(n).padStart(2, '0')}.png`));
      }
    }
  }
  if (want('onboarding')) {
    for (const [width, height] of [[1280, 800], [1440, 900]]) {
      for (const theme of THEMES) {
        for (const locale of ['id', 'en']) {
          const dir = join(out, 'onboarding', `${width}-${locale}-${theme}`);
          mkdirSync(dir, { recursive: true });
          for (let step = 1; step <= 4; step++) {
            await preview(`onboarding=${step}&lang=${locale}`, theme, width, height);
            await shoot(page, join(dir, `${step}.png`), false);
          }
        }
      }
    }
  }
  await ctx.close();
}
log(`selesai: ${out}`);

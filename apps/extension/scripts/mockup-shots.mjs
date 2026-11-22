#!/usr/bin/env node
// pnpm shots:mockup (the extension's half): the screens that go into device
// mockups and the README, as plain PNGs without a frame. Same ground as
// audit-shots.mjs (production build, seeded synthetic demo account, fixed
// clock, no network), with livelier task titles and nothing overdue
// (scripts/lib/mockup-data.mjs). Grades and the Nilai page are never shot.
//
//   <out>/popup/<tema>/<bahasa>/popup.png                    380x600, scale 2
//   <out>/desktop/<tema>/<bahasa>/dashboard-<layar>.png      1440x900, scale 2
//   <out>/desktop/<tema>/<bahasa>/onboarding-<langkah>.png   1440x900, scale 2
//
// Usage: node scripts/mockup-shots.mjs --out=<dir> [--no-build] [--themes=light,dark] [--langs=id,en]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { livelyTasks } from '../../../scripts/lib/mockup-data.mjs';
import { demoNeosia } from './lib/demo-neosia.mjs';
import { demoPresensi } from './lib/demo-presensi.mjs';

const root = new URL('..', import.meta.url).pathname;
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const outArg = arg('out', null);
if (!outArg) throw new Error('--out=<dir> is required');
const out = resolve(process.env.INIT_CWD ?? process.cwd(), outArg);
const themes = arg('themes', 'light,dark').split(',');
const langs = arg('langs', 'id,en').split(',');
const THEME_DIR = { light: 'terang', dark: 'gelap' };
const SCALE = 2;
const DESKTOP = { width: 1440, height: 900 };
const POPUP = { width: 380, height: 600 };
// A Wednesday morning in Makassar, as in audit-shots.mjs.
const NOW_MS = Date.parse('2026-11-18T10:00:00+08:00');
const NOW = Math.floor(NOW_MS / 1000);
const OFFLINE = '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost';
const log = (m) => process.stderr.write(`mockup-shots (ekstensi): ${m}\n`);
/** Dashboard pages a mockup shows, on SIKOLA data alone. Jadwal follows with the NEOSIA demo (placeholder lecturers, grades hidden). */
const PAGES = ['ringkasan', 'tugas', 'kalender', 'presensi', 'kabar'];
/** The onboarding's clearest steps (the development build's preview page plays them without SIKOLA). */
const ONBOARDING = [
  ['intro-tenggat', 'onboarding=1&page=0'],
  ['intro-pengingat', 'onboarding=1&page=1'],
  ['mata-kuliah', 'onboarding=3'],
];

if (!process.argv.includes('--no-build')) {
  log('build production dan development');
  execFileSync('pnpm', ['exec', 'wxt', 'build'], { cwd: root, stdio: 'ignore' });
  execFileSync('pnpm', ['exec', 'wxt', 'build', '--mode', 'development'], { cwd: root, stdio: 'ignore' });
}

/** The demo account around NOW with mockup tasks and attendance, NEOSIA only when asked; fresh, so no sync starts. */
function seed(prefs, { neosia = false } = {}) {
  const { generatedAt, storage } = JSON.parse(readFileSync(join(root, 'fixtures/guide/demo-seed.json'), 'utf8'));
  const shift = NOW - generatedAt;
  const walk = (v, key = '') => {
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    return typeof v === 'number' && /At$|^at$|^dueAt$/.test(key) && v > 1e9 ? v + shift : v;
  };
  const s = { ...walk(storage), ...demoPresensi(NOW), ...(neosia ? demoNeosia(NOW) : {}) };
  return {
    ...s,
    'u:1:tasks': livelyTasks(s['u:1:tasks'], NOW),
    'u:1:sync': { ...(s['u:1:sync'] ?? {}), lastSyncAt: NOW, lastCourseListAt: NOW },
    // No nickname: a mockup greets nobody by name.
    'global:prefs': { ...(s['global:prefs'] ?? {}), ...prefs, nickname: '' },
  };
}

const fixClock = (fixed) => {
  const Real = Date;
  globalThis.Date = class extends Real {
    constructor(...a) {
      if (a.length === 0) super(fixed);
      else super(...a);
    }
    static now() {
      return fixed;
    }
  };
};

async function open(build) {
  const ext = join(root, `../../.output/${build}`);
  const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, timezoneId: 'Asia/Makassar', deviceScaleFactor: SCALE, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, OFFLINE] });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  await sw.evaluate(fixClock, NOW_MS);
  await ctx.addInitScript(fixClock, NOW_MS);
  // A fresh install opens the onboarding in a tab of its own; the run opens its own pages.
  await new Promise((r) => setTimeout(r, 800));
  for (const p of ctx.pages()) if (p.url().startsWith('chrome-extension://')) await p.close().catch(() => undefined);
  return { ctx, sw, id: new URL(sw.url()).host };
}

const done = [];
const failed = [];
function target(device, theme, lang) {
  const d = join(out, device, THEME_DIR[theme], lang);
  mkdirSync(d, { recursive: true });
  return d;
}
/** The window as it is (no full-page stitching: a mockup frame shows one screen). */
async function shoot(page, file) {
  await page.mouse.move(0, 0);
  // Two frames, so nothing is caught between two layouts.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(600);
  await page.screenshot({ path: file });
  done.push(file);
}
const guarded = async (label, run) => {
  try {
    await run();
  } catch (e) {
    failed.push(`${label}: ${String(e.message ?? e).split('\n')[0]}`);
  }
};

{
  const { ctx, sw, id } = await open('chrome-mv3');
  const url = (path) => `chrome-extension://${id}/${path}`;
  for (const theme of themes)
    for (const lang of langs) {
      log(`${theme} ${lang}`);
      const reset = async (storage) => {
        await sw.evaluate(async (s) => {
          await chrome.storage.local.clear();
          await chrome.storage.local.set(s);
        }, storage);
        await new Promise((r) => setTimeout(r, 400));
      };
      await reset(seed({ locale: lang, theme }));

      const popup = await ctx.newPage();
      await guarded(`popup ${theme} ${lang}`, async () => {
        await popup.setViewportSize(POPUP);
        await popup.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await popup.goto(url('popup.html'));
        await popup.waitForLoadState('networkidle').catch(() => undefined);
        await shoot(popup, join(target('popup', theme, lang), 'popup.png'));
      });
      await popup.close();

      const page = await ctx.newPage();
      await page.setViewportSize(DESKTOP);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      for (const p of PAGES)
        await guarded(`dashboard ${p} ${theme} ${lang}`, async () => {
          await page.goto(url(`dashboard.html#${p}`));
          await page.waitForLoadState('networkidle').catch(() => undefined);
          await shoot(page, join(target('desktop', theme, lang), `dashboard-${p}.png`));
        });
      await reset(seed({ locale: lang, theme }, { neosia: true }));
      await guarded(`dashboard jadwal ${theme} ${lang}`, async () => {
        await page.goto(url('dashboard.html#jadwal'));
        await page.waitForLoadState('networkidle').catch(() => undefined);
        await shoot(page, join(target('desktop', theme, lang), 'dashboard-jadwal.png'));
      });
      await page.close();
    }
  await ctx.close();
}

{
  const { ctx, id } = await open('chrome-mv3-dev');
  const page = await ctx.newPage();
  await page.setViewportSize(DESKTOP);
  for (const theme of themes)
    for (const lang of langs) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      for (const [name, query] of ONBOARDING)
        await guarded(`onboarding ${name} ${theme} ${lang}`, async () => {
          await page.goto(`chrome-extension://${id}/preview.html?${query}&lang=${lang}&theme=${theme}`);
          await page.waitForLoadState('networkidle').catch(() => undefined);
          await shoot(page, join(target('desktop', theme, lang), `onboarding-${name}.png`));
        });
    }
  await ctx.close();
}

log(`${done.length} gambar di ${out}`);
if (failed.length > 0) {
  console.log(`Langkah gagal (${failed.length}):\n${failed.join('\n')}`);
  process.exitCode = 1;
}

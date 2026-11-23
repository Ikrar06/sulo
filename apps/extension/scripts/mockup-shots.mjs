#!/usr/bin/env node
// pnpm shots:mockup (the extension's half): the screens that go into device
// mockups and the README, as plain PNGs without a frame. Same ground as
// audit-shots.mjs (production build, seeded synthetic demo account, fixed
// clock, no network), with livelier task titles and nothing overdue
// (scripts/lib/mockup-data.mjs). Grades and the Nilai page are never shot.
//
// The owner sets the mockups in MacBook Pro frames (23 Nov 2026), so the
// pages are shot at those screens, at scale 2:
//   macbook-14   1512 x 982 points (3024 x 1964 pixels)
//   macbook-16   1728 x 1117 points (3456 x 2234 pixels)
//
//   <out>/popup/<tema>/<bahasa>/popup.png                         380x600, scale 2
//   <out>/macbook-<n>/<tema>/<bahasa>/halaman-<layar>.png         the page alone, filling the screen
//   <out>/macbook-<n>/<tema>/<bahasa>/jendela-<layar>.png         the page in a plain browser window drawn here
//                                                                 (no real browser's logo or name), under a strip
//                                                                 of 37 pt left empty for the frame's menu bar
//                                                                 and notch
//   <out>/macbook-<n>/<tema>/<bahasa>/jendela-ringkasan-popup.png the same, with the extension's popup open
//                                                                 from the toolbar
// <layar>: dashboard-ringkasan, -tugas, -kalender, -presensi, -kabar, -jadwal;
// onboarding-intro-tenggat, -intro-pengingat, -mata-kuliah.
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
/** [folder, the screen in points]. */
const SCREENS = [
  ['macbook-14', { width: 1512, height: 982 }],
  ['macbook-16', { width: 1728, height: 1117 }],
];
const POPUP = { width: 380, height: 600 };
/** The strip a notched MacBook Pro keeps for its menu bar: 74 of the screen's pixels, 37 pt. Left empty for the frame's template. */
const MENU_BAR = 37;
/** The drawn browser window's own height above the page: a row of tabs and a toolbar. */
const TABS = 40;
const TOOLBAR = 44;
/** What is left for the page inside the window. */
const inWindow = (screen) => ({ width: screen.width, height: screen.height - MENU_BAR - TABS - TOOLBAR });
const MARK = `data:image/svg+xml;base64,${readFileSync(join(root, 'assets/brand/flame-full.svg')).toString('base64')}`;
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
/** A mascot caught mid-blink would spoil a mockup: wait until every mascot's lids are open and its change of expression is over. */
const lidsOpen = (page) =>
  page
    .waitForFunction(() => [...document.querySelectorAll('.sm-blink')].every((el) => {
      const m = getComputedStyle(el).transform;
      return m === 'none' || Number(m.split(',')[3]) > 0.97;
    }), null, { timeout: 4000, polling: 50 })
    .catch(() => undefined);

/** Still, with nothing caught between two layouts. */
async function settle(page) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(600);
  await lidsOpen(page);
}
/** The window as it is (no full-page stitching: a mockup frame shows one screen). */
async function shoot(page, file) {
  await settle(page);
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

/**
 * A plain browser window around a page, as one screen-sized picture: an
 * empty strip for the menu bar and the notch, a row with one tab, a toolbar
 * with an address field and the extension's button, then the page. Drawn
 * with neutral greys and simple strokes: it is nobody's browser. With
 * `popup`, the extension's popup hangs from its button.
 */
function windowHtml({ screen, theme, shot, popup }) {
  const dark = theme === 'dark';
  const c = dark
    ? { strip: '#1a1a1e', tabs: '#1a1a1e', tab: '#2a2a30', bar: '#2a2a30', field: '#1c1c21', line: '#3a3a42', ink: '#e6e6ea', dim: '#9a9aa6', dot: '#4a4a54' }
    : { strip: '#dfdfe5', tabs: '#dfdfe5', tab: '#f5f5f7', bar: '#f5f5f7', field: '#ffffff', line: '#d2d2da', ink: '#1d1d22', dim: '#6c6c78', dot: '#b9b9c4' };
  const stroke = (d) => `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="${c.dim}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const img = (png) => `data:image/png;base64,${png.toString('base64')}`;
  return `<!doctype html><html><body style="margin:0;width:${screen.width}px;height:${screen.height}px;overflow:hidden;background:${c.strip};font:13px/1 system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;color:${c.ink}">
<div style="height:${MENU_BAR}px"></div>
<div style="height:${TABS}px;background:${c.tabs};display:flex;align-items:flex-end;padding:0 12px;gap:10px;box-sizing:border-box">
  <div style="display:flex;gap:8px;align-self:center;padding:0 4px">${[0, 1, 2].map(() => `<span style="width:12px;height:12px;border-radius:50%;background:${c.dot}"></span>`).join('')}</div>
  <div style="height:32px;width:220px;background:${c.tab};border-radius:10px 10px 0 0;display:flex;align-items:center;gap:8px;padding:0 12px;box-sizing:border-box">
    <img src="${MARK}" width="16" height="16" alt=""><span style="flex:1;white-space:nowrap;overflow:hidden">Sulo</span>${stroke('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>')}
  </div>
  <div style="align-self:center;padding-bottom:2px">${stroke('<path d="M8 3v10M3 8h10"/>')}</div>
</div>
<div style="height:${TOOLBAR}px;background:${c.bar};display:flex;align-items:center;gap:14px;padding:0 14px;box-sizing:border-box;border-bottom:1px solid ${c.line}">
  ${stroke('<path d="M10 3L5 8l5 5"/>')}${stroke('<path d="M6 3l5 5-5 5"/>')}${stroke('<path d="M13 8a5 5 0 1 1-1.5-3.5M13 3v2.5h-2.5"/>')}
  <div style="flex:1;height:28px;border-radius:14px;background:${c.field};border:1px solid ${c.line};display:flex;align-items:center;gap:8px;padding:0 12px;box-sizing:border-box;color:${c.dim}">
    <img src="${MARK}" width="14" height="14" alt=""><span style="color:${c.ink}">Sulo</span>
  </div>
  <div id="button" style="width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:${popup ? c.field : 'transparent'};border:1px solid ${popup ? c.line : 'transparent'}"><img src="${MARK}" width="18" height="18" alt=""></div>
  ${stroke('<circle cx="8" cy="3.5" r="0.6"/><circle cx="8" cy="8" r="0.6"/><circle cx="8" cy="12.5" r="0.6"/>')}
</div>
<img src="${img(shot)}" width="${screen.width}" height="${screen.height - MENU_BAR - TABS - TOOLBAR}" style="display:block" alt="">
${popup ? `<img src="${img(popup)}" width="${POPUP.width}" height="${POPUP.height}" alt="" style="position:absolute;top:${MENU_BAR + TABS + TOOLBAR - 4}px;right:14px;border-radius:12px;border:1px solid ${c.line};box-shadow:0 12px 32px rgba(0,0,0,${dark ? 0.5 : 0.18})">` : ''}
</body></html>`;
}

/** Shoots the page twice at one screen: alone, and inside the drawn window (returns the window's page shot for a popup version). */
async function both(ctx, page, device, screen, theme, lang, name, { popup = null } = {}) {
  const dir = target(device, theme, lang);
  await page.setViewportSize(screen);
  await shoot(page, join(dir, `halaman-${name}.png`));
  await page.setViewportSize(inWindow(screen));
  await settle(page);
  const shot = await page.screenshot();
  const frame = await ctx.newPage();
  await frame.setViewportSize(screen);
  const draw = async (file, withPopup) => {
    await frame.setContent(windowHtml({ screen, theme, shot, popup: withPopup }));
    await frame.waitForTimeout(200);
    await frame.screenshot({ path: file });
    done.push(file);
  };
  await draw(join(dir, `jendela-${name}.png`), null);
  if (popup) await draw(join(dir, `jendela-${name}-popup.png`), popup);
  await frame.close();
}

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
      let popupShot = null;
      await guarded(`popup ${theme} ${lang}`, async () => {
        await popup.setViewportSize(POPUP);
        await popup.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await popup.goto(url('popup.html'));
        await popup.waitForLoadState('networkidle').catch(() => undefined);
        await shoot(popup, join(target('popup', theme, lang), 'popup.png'));
        popupShot = await popup.screenshot();
      });
      await popup.close();

      const page = await ctx.newPage();
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      for (const [device, screen] of SCREENS)
        for (const p of PAGES)
          await guarded(`${device} dashboard ${p} ${theme} ${lang}`, async () => {
            await page.setViewportSize(screen);
            await page.goto(url(`dashboard.html#${p}`));
            await page.waitForLoadState('networkidle').catch(() => undefined);
            await both(ctx, page, device, screen, theme, lang, `dashboard-${p}`, { popup: p === 'ringkasan' ? popupShot : null });
          });
      await reset(seed({ locale: lang, theme }, { neosia: true }));
      for (const [device, screen] of SCREENS)
        await guarded(`${device} dashboard jadwal ${theme} ${lang}`, async () => {
          await page.setViewportSize(screen);
          await page.goto(url('dashboard.html#jadwal'));
          await page.waitForLoadState('networkidle').catch(() => undefined);
          await both(ctx, page, device, screen, theme, lang, 'dashboard-jadwal');
        });
      await page.close();
    }
  await ctx.close();
}

{
  const { ctx, id } = await open('chrome-mv3-dev');
  const page = await ctx.newPage();
  for (const theme of themes)
    for (const lang of langs) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      for (const [device, screen] of SCREENS)
        for (const [name, query] of ONBOARDING)
          await guarded(`${device} onboarding ${name} ${theme} ${lang}`, async () => {
            await page.setViewportSize(screen);
            await page.goto(`chrome-extension://${id}/preview.html?${query}&lang=${lang}&theme=${theme}`);
            await page.waitForLoadState('networkidle').catch(() => undefined);
            await both(ctx, page, device, screen, theme, lang, `onboarding-${name}`);
          });
    }
  await ctx.close();
}

log(`${done.length} gambar di ${out}`);
if (failed.length > 0) {
  console.log(`Langkah gagal (${failed.length}):\n${failed.join('\n')}`);
  process.exitCode = 1;
}

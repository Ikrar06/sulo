#!/usr/bin/env node
// pnpm shots:audit (the extension's half): every page and state of the
// extension, for before and after comparisons. Synthetic demo data only
// (scripts/lib/demo-*.mjs; no real name, student number or email). Every
// host other than the extension itself is unreachable (host resolver rules),
// so nothing reaches SIKOLA, NEOSIA or the data repository. The clock is
// fixed (pages and service worker) and motion is reduced, so two runs of the
// same code give the same pixels.
//
//   <out>/ekstensi-popup/<tema>/<bahasa>/<nn-layar>--<keadaan>.png            380 wide, its own height
//   <out>/ekstensi-dashboard/<tema>/<bahasa>/<nn-layar>--<keadaan>.png        1280x800, whole page
//   <out>/ekstensi-dashboard-1920/<tema>/<bahasa>/<nn-layar>--<keadaan>.png   1920x1080, whole page
//   <out>/ekstensi-onboarding/<tema>/<bahasa>/<nn-layar>--<keadaan>.png       1280x800
//
// The popup, the dashboard and the privacy page come from the production
// build with storage seeded. The onboarding's later steps need a SIKOLA tab
// and a sync, which a screenshot run must never have, so they come from the
// development build's preview page (the same components with synthetic
// props), as do the popup's two panels.
// Grades are only ever shot hidden.
//
// Usage: node scripts/audit-shots.mjs --out=<dir> [--no-build] [--themes=light,dark]
//   [--langs=id,en] [--only=popup,dashboard,wide,onboarding] [--scale=1]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { chromium } from 'playwright';
import { clipLog, staticTexts } from '../../mobile/scripts/lib/clipped.mjs';
import { loadWords } from '../../mobile/scripts/lib/words.mjs';
import { demoNeosia } from './lib/demo-neosia.mjs';
import { demoPresensi } from './lib/demo-presensi.mjs';

const root = new URL('..', import.meta.url).pathname;
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const outArg = arg('out', null);
if (!outArg) throw new Error('--out=<dir> is required');
const out = resolve(process.env.INIT_CWD ?? process.cwd(), outArg);
const themes = arg('themes', 'light,dark').split(',');
const langs = arg('langs', 'id,en').split(',');
const only = arg('only', null)?.split(',') ?? null;
const want = (k) => !only || only.includes(k);
const scale = Number(arg('scale', '1'));
const log = (m) => process.stderr.write(`audit-shots (ekstensi): ${m}\n`);
const THEME_DIR = { light: 'terang', dark: 'gelap' };
// A Wednesday morning in Makassar; the demo account's times are laid out around it.
const NOW_MS = Date.parse('2026-11-18T10:00:00+08:00');
const NOW = Math.floor(NOW_MS / 1000);
const OFFLINE = '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost';
const PAGES = ['ringkasan', 'tugas', 'mata-kuliah', 'presensi', 'kabar', 'kalender', 'jadwal', 'nilai', 'pengaturan', 'bantuan', 'tentang'];
const nn = (page) => String(PAGES.indexOf(page) + 2).padStart(2, '0');

if (!process.argv.includes('--no-build')) {
  log('build production dan development');
  execFileSync('pnpm', ['exec', 'wxt', 'build'], { cwd: root, stdio: 'ignore' });
  execFileSync('pnpm', ['exec', 'wxt', 'build', '--mode', 'development'], { cwd: root, stdio: 'ignore' });
}
const WORDS = await loadWords();
const done = [];
const failed = [];
const clips = clipLog();
const TEXTS = { id: staticTexts(WORDS.id), en: staticTexts(WORDS.en) };
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const starts = (text) => new RegExp(`^${escapeRe(text)}`);

/** The demo account with every time moved so "now" is NOW (the rule of scripts/lib/demo-storage.mjs, on a fixed clock). */
function demoStorage() {
  const { generatedAt, storage } = JSON.parse(readFileSync(join(root, 'fixtures/guide/demo-seed.json'), 'utf8'));
  const shift = NOW - generatedAt;
  const walk = (v, key = '') => {
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    return typeof v === 'number' && /At$|^at$|^dueAt$/.test(key) && v > 1e9 ? v + shift : v;
  };
  return walk(storage);
}

/** Fresh data (so no sync starts), with attendance and NEOSIA unless `neosia` is false. */
function seed(prefs, extra = {}, { neosia = true } = {}) {
  const s = { ...demoStorage(), ...demoPresensi(NOW), ...(neosia ? demoNeosia(NOW) : {}) };
  s['u:1:sync'] = { ...(s['u:1:sync'] ?? {}), lastSyncAt: NOW, lastCourseListAt: NOW };
  s['global:prefs'] = { ...(s['global:prefs'] ?? {}), ...prefs };
  return { ...s, ...extra };
}

async function open(build) {
  const ext = join(root, `../../.output/${build}`);
  const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, timezoneId: 'Asia/Makassar', deviceScaleFactor: scale, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, OFFLINE] });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  // The service worker's clock, fixed like the pages' (context.clock covers pages only): seeded data stays "fresh" for it too.
  await sw.evaluate((fixed) => {
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
  }, NOW_MS);
  // The same for every page of the context, before its own scripts run (timers keep running; only "now" is fixed).
  await ctx.addInitScript((fixed) => {
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
  }, NOW_MS);
  // A fresh install opens the onboarding in a tab of its own; the run opens its own pages.
  await new Promise((r) => setTimeout(r, 800));
  for (const p of ctx.pages()) if (p.url().startsWith('chrome-extension://')) await p.close().catch(() => undefined);
  return { ctx, sw, id: new URL(sw.url()).host };
}

async function reset(sw, storage) {
  await sw.evaluate(async (s) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set(s);
  }, storage);
  await new Promise((r) => setTimeout(r, 400));
}

function target(dir, theme, lang) {
  const d = join(out, dir, THEME_DIR[theme], lang);
  mkdirSync(d, { recursive: true });
  return d;
}

async function shoot(page, dir, name, full = true, { keepPointer = false } = {}) {
  // The pointer rests outside the page unless the shot is about a hover: no row is left highlighted.
  if (!keepPointer) await page.mouse.move(0, 0);
  await page.waitForTimeout(600);
  const file = join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: full });
  await clips.note(page, relative(out, file), TEXTS[file.includes('/en/') ? 'en' : 'id']);
  done.push(file);
}

/** Runs guarded steps: one that cannot run is listed at the end, the rest go on. */
async function steps(label, page, list) {
  for (const [name, run] of list) {
    try {
      await run();
    } catch (e) {
      failed.push(`${label} ${name}: ${String(e.message ?? e).split('\n')[0]}`);
      await page.keyboard.press('Escape').catch(() => undefined);
    }
  }
}

// ---- Production build: popup, dashboard, privacy page, the onboarding's first screen -----
if (want('popup') || want('dashboard') || want('wide') || want('onboarding')) {
  const { ctx, sw, id } = await open('chrome-mv3');
  const url = (path) => `chrome-extension://${id}/${path}`;

  for (const theme of themes)
    for (const lang of langs) {
      const t = WORDS[lang];
      const prefs = { locale: lang, theme };
      const label = `${theme} ${lang}`;
      log(label);

      if (want('popup')) {
        const dir = target('ekstensi-popup', theme, lang);
        const today = new Date(NOW_MS).toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' });
        const STATES = [
          ['ada-tugas', seed(prefs)],
          ['kosong', seed(prefs, { 'u:1:tasks': [] })],
          ['belum-siap', { 'global:prefs': prefs }],
          ['memperbarui', seed(prefs, { 'global:syncLock': { cycleId: 'audit', expiresAt: NOW + 120 } })],
          ['sesi-habis', seed(prefs, { 'global:session': { state: 'EXPIRED', userId: 1, checkedAt: NOW } })],
          ['gagal', seed(prefs, { 'global:syncStatus': { lastOutcome: { status: 'parser_broken', at: NOW, where: 'core_calendar_get_action_events_by_timesort' } } })],
          ['tanpa-koneksi', seed(prefs, { 'global:syncStatus': { lastOutcome: { status: 'offline', at: NOW } } })],
          ['batas-harian', seed(prefs, { 'global:budget': { date: today, used: 999 } })],
          ['dijeda-pengelola', seed(prefs, { 'global:remoteConfig': { enabled: false, minIntervalMinutes: 30, message: '', fetchedAt: NOW, okAt: NOW } })],
          ['data-lama', seed(prefs, { 'u:1:sync': { lastSyncAt: NOW - 9 * 3600, lastCourseListAt: NOW - 9 * 3600 } })],
          ['akun-berbeda', seed(prefs, { 'global:accountPending': { userId: 2, detectedAt: NOW, lastCheckAt: NOW, deferredAt: null } })],
          ['akun-berbeda-nanti', seed(prefs, { 'global:accountPending': { userId: 2, detectedAt: NOW, lastCheckAt: NOW, deferredAt: NOW } })],
        ];
        const popup = await ctx.newPage();
        await popup.setViewportSize({ width: 380, height: 600 });
        await popup.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        for (const [name, storage] of STATES) {
          await reset(sw, storage);
          await steps(`popup ${label}`, popup, [[name, async () => {
            await popup.goto(url('popup.html'));
            await shoot(popup, dir, `01-popup--${name}`, false);
          }]]);
        }
        await reset(sw, seed(prefs));
        await popup.goto(url('popup.html'));
        await steps(`popup ${label}`, popup, [
          ['baris disorot', async () => {
            await popup.locator('li.group').first().hover();
            await shoot(popup, dir, '01-popup--baris-disorot', false, { keepPointer: true });
            await popup.mouse.move(0, 0);
          }],
          ['menu baris', async () => {
            await popup.locator('li.group').first().hover();
            await popup.locator('li.group').first().getByRole('button', { name: starts(t.base.popup.row.menu('').trim()) }).click();
            await shoot(popup, dir, '01-popup--menu-baris', false, { keepPointer: true });
            await popup.keyboard.press('Escape');
            await popup.mouse.move(0, 0);
          }],
          ['menu pengaturan', async () => {
            await popup.getByRole('button', { name: t.base.popup.settings.button, exact: true }).click();
            await shoot(popup, dir, '01-popup--menu-pengaturan', false);
            await popup.keyboard.press('Escape');
          }],
          ['panel pengingat', async () => {
            await popup.goto(url('popup.html'));
            await popup.getByRole('button', { name: t.base.popup.settings.button, exact: true }).click();
            await popup.getByRole('menuitem', { name: t.base.popup.settings.reminders }).click();
            await shoot(popup, dir, '01-popup--panel-pengingat', false);
          }],
          ['panel kabar', async () => {
            await popup.goto(url('popup.html'));
            await popup.getByRole('button', { name: new RegExp(`${escapeRe(t.base.popup.updates.lineNone)}|${escapeRe(t.base.popup.updates.line(1).replace(/\d+/, '')).trim().split(' ').slice(-2).join(' ')}`) }).first().click();
            await shoot(popup, dir, '01-popup--panel-kabar', false);
          }],
        ]);
        await popup.close();
      }

      if (want('dashboard') || want('wide')) {
        const page = await ctx.newPage();
        const go = async (hash, width, height) => {
          await page.setViewportSize({ width, height });
          await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
          await page.goto(url(`dashboard.html#${hash}`));
          await page.waitForLoadState('networkidle').catch(() => undefined);
        };
        await reset(sw, seed(prefs));
        if (want('wide')) {
          const dir = target('ekstensi-dashboard-1920', theme, lang);
          for (const p of PAGES) await steps(`dashboard-1920 ${label}`, page, [[p, async () => (await go(p, 1920, 1080), shoot(page, dir, `${nn(p)}-${p}--utama`))]]);
        }
        if (want('dashboard')) {
          const dir = target('ekstensi-dashboard', theme, lang);
          for (const p of PAGES) await steps(`dashboard ${label}`, page, [[p, async () => (await go(p, 1280, 800), shoot(page, dir, `${nn(p)}-${p}--utama`))]]);

          // In-page states and dialogs, on the same data.
          await steps(`dashboard ${label}`, page, [
            ['tugas rincian', async () => {
              await go('tugas', 1280, 800);
              await page.getByRole('button', { name: starts(t.dash.tugas.details) }).first().click();
              await shoot(page, dir, '03-tugas--rincian-terbuka');
            }],
            ['tugas selesai dan urungkan', async () => {
              await go('tugas', 1280, 800);
              await page.getByRole('checkbox', { name: starts(t.dash.tugas.markDone) }).first().click();
              await shoot(page, dir, '03-tugas--ditandai-selesai', false);
              // Undone again, so the toast is gone and the data is as it was for the next shots.
              await page.getByRole('button', { name: t.dash.tugas.undo, exact: true }).click();
              await page.waitForTimeout(400);
            }],
            ['kalender tampilan lain', async () => {
              await reset(sw, seed(prefs));
              await go('kalender', 1280, 800);
              const list = page.getByRole('radio', { name: t.dash.kalender.list, exact: true }).or(page.getByRole('button', { name: t.dash.kalender.list, exact: true })).or(page.getByRole('tab', { name: t.dash.kalender.list, exact: true }));
              await list.first().click();
              await shoot(page, dir, '07-kalender--daftar');
            }],
            ['mata kuliah warna', async () => {
              await go('mata-kuliah', 1280, 800);
              await page.locator('button[aria-haspopup="dialog"]').first().click();
              await shoot(page, dir, '04-mata-kuliah--pilih-warna', false);
              await page.keyboard.press('Escape');
            }],
            ['pengaturan laporan', async () => {
              await go('pengaturan', 1280, 800);
              await page.getByRole('button', { name: t.dash.pengaturan.bugReport.button }).click();
              await shoot(page, dir, '10-pengaturan--dialog-laporan', false);
              await page.keyboard.press('Escape');
            }],
            ['pengaturan hapus', async () => {
              await page.getByRole('button', { name: t.base.popup.settings.wipe, exact: true }).click();
              await shoot(page, dir, '10-pengaturan--dialog-hapus', false);
              await page.keyboard.press('Escape');
            }],
            ['bantuan jawaban', async () => {
              await go('bantuan', 1280, 800);
              const faq = page.locator('details > summary').first();
              await faq.scrollIntoViewIfNeeded();
              await faq.click();
              await shoot(page, dir, '11-bantuan--jawaban-terbuka', false);
            }],
          ]);

          // Whole-account states.
          const today = new Date(NOW_MS).toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' });
          const STATES = [
            ['kosong', { 'u:1:tasks': [], 'u:1:changes': [] }, {}, ['ringkasan', 'tugas', 'kabar']],
            ['gagal', { 'global:syncStatus': { lastOutcome: { status: 'parser_broken', at: NOW } } }, {}, ['ringkasan']],
            ['sesi-habis', { 'global:session': { state: 'EXPIRED', userId: 1, checkedAt: NOW } }, {}, ['ringkasan']],
            ['akun-berbeda', { 'global:accountPending': { userId: 2, detectedAt: NOW, lastCheckAt: NOW, deferredAt: null } }, {}, ['ringkasan']],
            ['batas-harian', { 'global:budget': { date: today, used: 999 } }, {}, ['ringkasan']],
            ['mode-privasi', { 'global:prefs': { ...prefs, privacyMode: true } }, {}, ['ringkasan', 'presensi', 'nilai']],
            ['tanpa-neosia', {}, { neosia: false }, ['ringkasan', 'pengaturan']],
            ['belum-siap', null, {}, ['ringkasan']],
          ];
          for (const [name, extra, opts, pages] of STATES) {
            await reset(sw, extra === null ? { 'global:prefs': prefs } : seed(prefs, extra, opts));
            for (const p of pages) await steps(`dashboard ${label}`, page, [[`${name} ${p}`, async () => (await go(p, 1280, 800), shoot(page, dir, `${nn(p)}-${p}--${name}`))]]);
          }
          await steps(`dashboard ${label}`, page, [['privasi', async () => {
            await reset(sw, seed(prefs));
            await page.setViewportSize({ width: 1280, height: 800 });
            await page.goto(url('privacy.html'));
            await shoot(page, dir, '13-privasi--halaman');
          }]]);
        }
        await page.close();
      }

      if (want('onboarding')) {
        // The real page on an empty browser: the intro's first screen.
        const dir = target('ekstensi-onboarding', theme, lang);
        await reset(sw, { 'global:prefs': prefs });
        const page = await ctx.newPage();
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await steps(`onboarding ${label}`, page, [['halaman asli', async () => {
          await page.goto(url('onboarding.html'));
          await page.waitForLoadState('networkidle').catch(() => undefined);
          await shoot(page, dir, '00-onboarding--asli-pembuka', false);
        }]]);
        await page.close();
      }
    }
  await ctx.close();
}

// ---- Development build's preview page: onboarding steps that need SIKOLA ------------------------
if (want('onboarding')) {
  const { ctx, id } = await open('chrome-mv3-dev');
  const page = await ctx.newPage();
  const STEPS = [
    ['1-intro-a', 'onboarding=1&page=0'],
    ['1-intro-b', 'onboarding=1&page=1'],
    ['1-intro-c', 'onboarding=1&page=2'],
    ['1-intro-kenapa-aman', 'onboarding=1&page=0&why'],
    ['2-sambung-memeriksa', 'onboarding=2&connect=checking'],
    ['2-sambung-menunggu', 'onboarding=2&connect=waiting'],
    ['2-sambung-perlu-masuk', 'onboarding=2&connect=need_login'],
    ['2-sambung-gagal', 'onboarding=2&connect=failed'],
    ['2-menyiapkan-awal', 'onboarding=2&prep=0'],
    ['2-menyiapkan-tengah', 'onboarding=2&prep=2'],
    ['2-menyiapkan-selesai', 'onboarding=2&prep=3'],
    ['2-menyiapkan-gagal', 'onboarding=2&prep=1&fail'],
    ['3-mata-kuliah', 'onboarding=3'],
    ['3-mata-kuliah-banyak', 'onboarding=3&many'],
    ['3-mata-kuliah-nol', 'onboarding=3&none'],
    ['4-selesai', 'onboarding=4'],
    ['4-selesai-tanpa-tugas', 'onboarding=4&notasks'],
    ['5-yang-baru', 'onboarding=whats-new'],
  ];
  for (const theme of themes)
    for (const lang of langs) {
      const dir = target('ekstensi-onboarding', theme, lang);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      for (const [name, query] of STEPS)
        await steps(`onboarding ${theme} ${lang}`, page, [[name, async () => {
          await page.goto(`chrome-extension://${id}/preview.html?${query}&lang=${lang}&theme=${theme}`);
          await page.waitForLoadState('networkidle').catch(() => undefined);
          await shoot(page, dir, `00-onboarding--${name}`, false);
        }]]);
    }
  await ctx.close();
}

if (!only) writeFileSync(join(out, 'terpotong-ekstensi.json'), `${JSON.stringify(clips.rows, null, 1)}\n`);
console.log(`Teks terpotong: ${JSON.stringify(clips.summary())} (rincian di terpotong-ekstensi.json)`);
if (failed.length > 0) console.log(`Langkah gagal (${failed.length}):\n${failed.join('\n')}`);
console.log(`audit-shots ekstensi: ${done.length} gambar, ${failed.length} langkah gagal`);

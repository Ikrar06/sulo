#!/usr/bin/env node
// pnpm shots:mockup (the Android app's half): the screens that go into device
// mockups and the README, as plain PNGs without a status bar or a frame.
// Same ground as audit-shots.mjs (production build of the web mode, the
// synthetic demo account, fixed clock, no network), with livelier task
// titles and nothing overdue (scripts/lib/mockup-data.mjs). Grades and the
// Nilai screen are never shot.
//
//   <out>/mobile/<tema>/<bahasa>/<layar>.png   360x800 at scale 3 (1080x2400)
//
// Usage: node scripts/mockup-shots.mjs --out=<dir> [--no-build] [--themes=light,dark] [--langs=id,en]
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { livelyTasks } from '../../../scripts/lib/mockup-data.mjs';
import { MOBILE, ROOT } from './env.mjs';
import { loadWords } from './lib/words.mjs';
import { walk } from './onboarding-walk.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const outArg = arg('out', null);
if (!outArg) throw new Error('--out=<dir> is required');
const out = resolve(process.env.INIT_CWD ?? process.cwd(), outArg);
const themes = arg('themes', 'light,dark').split(',');
const langs = arg('langs', 'id,en').split(',');
const THEME_DIR = { light: 'terang', dark: 'gelap' };
const DIST = join(ROOT, '.output/audit-mobile-web');
const PORT = 5198;
const SIZE = { width: 360, height: 800 };
const SCALE = 3;
// A Wednesday morning in Makassar, as in audit-shots.mjs.
const NOW = new Date('2026-11-18T10:00:00+08:00');
const OFFLINE = '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost';
const TASKS_KEY = 'CapacitorStorage.sulo:u:1:tasks';
const log = (m) => process.stderr.write(`mockup-shots (mobile): ${m}\n`);
/** [file name, hash]; Jadwal is shot apart, with the NEOSIA demo connected. */
const SCREENS = [
  ['ringkasan', '#ringkasan'],
  ['tugas', '#tugas'],
  ['kalender', '#kalender'],
  ['presensi', '#presensi'],
  ['kabar', '#kabar'],
];
/** The onboarding screens kept: [name in onboarding-walk.mjs, file name]. */
const ONBOARDING = new Map([
  ['1-tenggat', 'onboarding-1-tenggat'],
  ['2-pengingat', 'onboarding-2-pengingat'],
  ['3-privasi', 'onboarding-3-privasi'],
]);

if (!process.argv.includes('--no-build')) {
  log('build web mode (production)');
  execFileSync('pnpm', ['exec', 'vite', 'build', '--mode', 'web', '--outDir', DIST, '--emptyOutDir', '--logLevel', 'warn'], { cwd: MOBILE, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, GITHUB_SHA: 'audit00' } });
}
const WORDS = await loadWords();
const server = spawn('pnpm', ['exec', 'vite', 'preview', '--mode', 'web', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
await new Promise((ok) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && ok()));
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: [OFFLINE] });
const done = [];
const failed = [];

async function phone(theme, lang) {
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true, locale: lang === 'en' ? 'en-US' : 'id-ID', timezoneId: 'Asia/Makassar', colorScheme: theme, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  const dir = join(out, 'mobile', THEME_DIR[theme], lang);
  mkdirSync(dir, { recursive: true });
  const shot = async (name) => {
    await page.waitForTimeout(500);
    const file = join(dir, `${name}.png`);
    await page.screenshot({ path: file });
    done.push(file);
  };
  return { context, page, shot };
}

/** The demo account signed in, its tasks swapped for the mockup's, the app reopened on them. */
async function enter(page, lang, query) {
  await page.goto(`http://localhost:${PORT}/?lang=${lang}${query}`);
  await page.waitForFunction(() => typeof window.__suloEnterDemo === 'function');
  await page.evaluate(() => window.__suloEnterDemo());
  await page.waitForTimeout(900);
  const later = page.getByRole('button', { name: WORDS[lang].mobile.notify.later, exact: true }).first();
  if (await later.isVisible().catch(() => false)) await later.click();
  await page.waitForTimeout(600);
  const raw = await page.evaluate((key) => localStorage.getItem(key), TASKS_KEY);
  if (raw === null) throw new Error('demo tasks not found in storage');
  const lively = livelyTasks(JSON.parse(raw), Math.floor(NOW.getTime() / 1000));
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [TASKS_KEY, JSON.stringify(lively)]);
  await page.reload();
  // Past the launch screen and any "updated" line of the reopened app.
  await page.waitForTimeout(3400);
}

const guarded = async (label, run) => {
  try {
    await run();
  } catch (e) {
    failed.push(`${label}: ${String(e.message ?? e).split('\n')[0]}`);
  }
};

for (const theme of themes)
  for (const lang of langs) {
    log(`${theme} ${lang}`);
    await guarded(`layar utama ${theme} ${lang}`, async () => {
      const { context, page, shot } = await phone(theme, lang);
      await enter(page, lang, '');
      for (const [name, hash] of SCREENS) {
        await page.evaluate((h) => (location.hash = h), hash);
        await page.waitForTimeout(700);
        await page.evaluate(() => document.querySelector('main')?.scrollTo({ top: 0 }));
        await shot(name);
      }
      await context.close();
    });
    await guarded(`jadwal ${theme} ${lang}`, async () => {
      const { context, page, shot } = await phone(theme, lang);
      await enter(page, lang, '&neosia=all');
      await page.evaluate(() => (location.hash = '#jadwal'));
      await page.waitForTimeout(900);
      await shot('jadwal');
      await context.close();
    });
    await guarded(`onboarding ${theme} ${lang}`, async () => {
      const { context, page, shot } = await phone(theme, lang);
      await page.goto(`http://localhost:${PORT}/?lang=${lang}`);
      let left = ONBOARDING.size;
      await walk(
        page,
        async (name) => {
          const file = ONBOARDING.get(name);
          if (!file) return;
          await shot(file);
          left -= 1;
          // The screens after the intro need a sign-in walk the mockups do not use.
          if (left === 0) throw new Error('mockup: cukup');
        },
        { lang, slow: 0.6 },
      ).catch((e) => {
        if (!String(e.message).includes('mockup: cukup')) throw e;
      });
      await context.close();
    });
    // A notification as a plain card (the morning summary, in the app's own words and colors); the
    // system's own notification chrome is left to the mockup.
    await guarded(`notifikasi ${theme} ${lang}`, async () => {
      const { context, page } = await phone(theme, lang);
      await page.goto(`http://localhost:${PORT}/?lang=${lang}`);
      await page.waitForTimeout(1500);
      const n = WORDS[lang].base.notify;
      const classes = [{ name: 'Mekanika Fluida', start: lang === 'en' ? '07:30' : '07.30' }];
      await page.evaluate(
        ([title, body, when]) => {
          const el = (tag, css, text) => {
            const x = document.createElement(tag);
            x.style.cssText = css;
            if (text) x.textContent = text;
            return x;
          };
          const card = el('div', 'width:328px;margin:16px;padding:14px 16px;border-radius:20px;background:var(--surface);color:var(--text);border:1px solid var(--border);font-size:14px;line-height:20px');
          card.id = 'mockup-card';
          const head = el('div', 'display:flex;align-items:center;gap:8px;font-size:12px;line-height:16px;color:var(--muted)');
          head.append(el('span', 'width:16px;height:16px;border-radius:9999px;background:var(--brand-orange)'), el('span', '', 'Sulo'), el('span', '', '·'), el('span', '', when));
          card.append(head, el('div', 'margin-top:6px;font-weight:600', title), el('div', 'margin-top:2px;color:var(--muted)', body));
          document.body.replaceChildren(card);
          document.body.style.background = 'var(--bg)';
        },
        [n.morningFullTitle, n.morningFullBody(0, 2, 1, [], classes), lang === 'en' ? '06:30' : '06.30'],
      );
      await page.waitForTimeout(300);
      const dir = join(out, 'mobile', THEME_DIR[theme], lang);
      const box = await page.locator('#mockup-card').boundingBox();
      const file = join(dir, 'notifikasi.png');
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width: SIZE.width, height: Math.ceil(box.y + box.height + 16) } });
      done.push(file);
      await context.close();
    });
  }

await browser.close();
try {
  process.kill(-server.pid);
} catch {
  server.kill();
}
log(`${done.length} gambar di ${out}`);
if (failed.length > 0) {
  console.log(`Langkah gagal (${failed.length}):\n${failed.join('\n')}`);
  process.exitCode = 1;
}

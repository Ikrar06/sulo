#!/usr/bin/env node
// pnpm shots:mockup (the Android app's half): the screens that go into device
// mockups and the README, as plain PNGs without a status bar or a frame.
// Same ground as audit-shots.mjs (production build of the web mode, the
// synthetic demo account, fixed clock, no network), with livelier task
// titles and nothing overdue (scripts/lib/mockup-data.mjs). Grades and the
// Nilai screen are never shot.
//
// The owner sets the mockups in an iPhone 18 Pro frame (23 Nov 2026), so the
// screens are shot at that phone's screen: 402 x 874 points at scale 3
// (2622 x 1206 pixels is Apple's figure; the points follow from the scale).
// Each screen comes twice:
//
//   <out>/iphone/<tema>/<bahasa>/<layar>.png         with safe areas: the app is laid out with 62 pt kept
//                                                    clear at the top (the island) and 34 pt at the bottom
//                                                    (the home indicator), as on the phone. Both bands are
//                                                    the screen's own background. No status bar, clock or
//                                                    signal icons are drawn, and the corners stay square:
//                                                    the frame's template brings those.
//   <out>/mobile-bebas/<tema>/<bahasa>/<layar>.png   without safe areas: the same screen edge to edge,
//                                                    for free crops outside a phone frame
//
// Both are 1206 x 2622 pixels. The notification card is only in mobile-bebas.
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
const SIZE = { width: 402, height: 874 };
const SCALE = 3;
/** Kept clear for the frame's island and home indicator, in points (the iPhone 17 Pro's portrait safe area; match it to the template). */
const SAFE = { top: 62, bottom: 34 };
/** [folder, laid out with the safe areas]. */
const VARIANTS = [
  ['iphone', true],
  ['mobile-bebas', false],
];
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

/** A mascot caught mid-blink would spoil a mockup: wait until every mascot's lids are open and its change of expression is over. */
const lidsOpen = (page) =>
  page
    .waitForFunction(() => [...document.querySelectorAll('.sm-blink')].every((el) => {
      const m = getComputedStyle(el).transform;
      return m === 'none' || Number(m.split(',')[3]) > 0.97;
    }), null, { timeout: 4000, polling: 50 })
    .catch(() => undefined);

async function phone(theme, lang, [folder, safe]) {
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true, locale: lang === 'en' ? 'en-US' : 'id-ID', timezoneId: 'Asia/Makassar', colorScheme: theme, reducedMotion: 'reduce' });
  const page = await context.newPage();
  // The app already keeps env(safe-area-inset-*) clear (the header, the tab bar, the sheets): give it the phone's insets.
  if (safe) await (await context.newCDPSession(page)).send('Emulation.setSafeAreaInsetsOverride', { insets: SAFE });
  await page.clock.setFixedTime(NOW);
  const dir = join(out, folder, THEME_DIR[theme], lang);
  mkdirSync(dir, { recursive: true });
  const shot = async (name) => {
    await page.waitForTimeout(500);
    await lidsOpen(page);
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
    for (const variant of VARIANTS) {
      const tag = `${variant[0]} ${theme} ${lang}`;
      log(tag);
      await guarded(`layar utama ${tag}`, async () => {
        const { context, page, shot } = await phone(theme, lang, variant);
        await enter(page, lang, '');
        for (const [name, hash] of SCREENS) {
          await page.evaluate((h) => (location.hash = h), hash);
          await page.waitForTimeout(700);
          await page.evaluate(() => document.querySelector('main')?.scrollTo({ top: 0 }));
          await shot(name);
        }
        await context.close();
      });
      await guarded(`jadwal ${tag}`, async () => {
        const { context, page, shot } = await phone(theme, lang, variant);
        await enter(page, lang, '&neosia=all');
        await page.evaluate(() => (location.hash = '#jadwal'));
        await page.waitForTimeout(900);
        await shot('jadwal');
        await context.close();
      });
      await guarded(`onboarding ${tag}`, async () => {
        const { context, page, shot } = await phone(theme, lang, variant);
        await page.goto(`http://localhost:${PORT}/?lang=${lang}`);
        let left = ONBOARDING.size;
        await walk(
          page,
          async (name) => {
            const file = ONBOARDING.get(name);
            if (!file) return;
            // The scene's last change of expression goes through a blink: let it finish.
            await page.waitForTimeout(900);
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
    }
    // A notification as a plain card (the morning summary, in the app's own words and colors); the
    // system's own notification chrome is left to the mockup.
    await guarded(`notifikasi ${theme} ${lang}`, async () => {
      const { context, page } = await phone(theme, lang, ['mobile-bebas', false]);
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
          const card = el('div', 'width:370px;margin:16px;padding:14px 16px;border-radius:20px;background:var(--surface);color:var(--text);border:1px solid var(--border);font-size:14px;line-height:20px');
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
      const dir = join(out, 'mobile-bebas', THEME_DIR[theme], lang);
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

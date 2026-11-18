#!/usr/bin/env node
// Screenshots of the phone's onboarding (M8c.2) in pnpm mobile:web: every
// screen at the end of its animations, then Ringkasan after the landing,
// light and dark. The data is the synthetic demo account (src/fake/demo.ts);
// nothing leaves the browser.
// Usage: node scripts/onboarding-shots.mjs [outDir] [--sizes=360x800,384x832]
//   [--special] (also: sign-in closed, no connection, sync failed, partial,
//   no course ticked, text zoom 130 %, reduced motion)
//   [--time] (seconds per screen and frame drops for screens 1, 2 and the landing)
//   [--cpu=4] (CPU throttle while walking)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE, ROOT } from './env.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const out = args.find((a) => !a.startsWith('--')) ?? join(ROOT, '.output/onboarding-shots');
const sizes = flag('sizes', '360x800,384x832').split(',').map((s) => s.split('x').map(Number));
const special = args.includes('--special');
const timing = args.includes('--time');
/** --cpu=4: Chrome's CPU throttle while walking (frame drops on a slow phone). */
const cpu = Number(flag('cpu', '1'));
/** --video: one recording of the whole flow (and one under reduced motion) instead of screenshots. */
const video = args.includes('--video');
mkdirSync(out, { recursive: true });
const PORT = 5177;
const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', String(PORT), '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve()));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const notes = [];

/** Long frames (over 33 ms) since the last call, from a rAF loop in the page. */
const FRAME_PROBE = () => {
  window.__frames = [];
  let last = performance.now();
  const tick = (t) => {
    window.__frames.push(t - last);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
const takeFrames = (page) => page.evaluate(() => {
  const f = window.__frames.splice(0);
  return { frames: f.length, over33: f.filter((g) => g > 33.4).length, max: Math.round(Math.max(0, ...f)) };
});

async function open(width, height, scheme, query = '', extra = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID', colorScheme: scheme, reducedMotion: extra.reduced ? 'reduce' : 'no-preference', ...(extra.video ? { recordVideo: { dir: extra.video, size: { width, height } } } : {}) });
  if (extra.zoom) await context.addInitScript((z) => document.addEventListener('DOMContentLoaded', () => document.documentElement.style.setProperty('--m-tz', String(z))), extra.zoom);
  if (timing) await context.addInitScript(FRAME_PROBE);
  const page = await context.newPage();
  if (cpu > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.goto(`http://localhost:${PORT}/${query}`);
  return { context, page };
}

const button = (page, name) => page.getByRole('button', { name, exact: true });
/** Mascots drawn and visible (opacity above 0 up the tree): there must never be two. */
const MASCOTS = () =>
  [...document.querySelectorAll('svg[viewBox="-40 -60 590 600"]')].filter((svg) => {
    for (let n = svg; n; n = n.parentElement) if (getComputedStyle(n).opacity === '0' || getComputedStyle(n).display === 'none') return false;
    return svg.getBoundingClientRect().width > 0;
  }).length;

/** Walks the whole flow; `shot(name)` at each screen's resting state. */
async function walk(page, shot, opts = {}) {
  const t0 = Date.now();
  const marks = [];
  const mark = (name) => marks.push({ name, at: Date.now() - t0 });
  await page.waitForTimeout(1000);
  await shot('0-pembuka');
  mark('splash');
  await page.getByRole('heading', { name: 'Semua tenggat di satu tempat' }).waitFor();
  if (timing) await takeFrames(page);
  mark('intro1');
  await page.waitForTimeout(2300);
  await shot('1-tenggat');
  if (timing) notes.push(`frame layar 1: ${JSON.stringify(await takeFrames(page))}`);
  if (timing) await takeFrames(page);
  await button(page, 'Lanjut').click();
  mark('intro2');
  await page.waitForTimeout(1500);
  await shot('2-pengingat');
  if (timing) notes.push(`frame layar 2: ${JSON.stringify(await takeFrames(page))}`);
  await button(page, 'Lanjut').click();
  mark('intro3');
  await page.waitForTimeout(1400);
  await shot('3-privasi');
  await button(page, 'Mulai').click();
  mark('signin');
  await page.waitForTimeout(700);
  await shot('4-masuk');
  if (opts.stopAt === 'signin') return marks;
  await button(page, 'Buka halaman SIKOLA').click();
  mark('preparing');
  await page.waitForTimeout(opts.prep === 'fail' ? 1200 : 800);
  await shot('5-menyiapkan');
  if (opts.stopAt === 'preparing') return marks;
  await page.getByRole('heading', { name: 'Mata kuliah mana yang dipantau?' }).waitFor({ timeout: 8000 });
  mark('courses');
  await page.waitForTimeout(500);
  await shot('6-mata-kuliah');
  if (opts.noneTicked) {
    // Untick one by one (the list of ticked ones shrinks as it goes).
    const ticked = page.getByRole('checkbox', { checked: true });
    while ((await ticked.count()) > 0) await ticked.first().click();
    await page.waitForTimeout(300);
    await shot('6b-nol-dipilih');
    return marks;
  }
  await page.getByRole('button', { name: /^Lanjut \(/ }).click();
  mark('nickname');
  await page.waitForTimeout(500);
  await page.getByRole('textbox').fill('Andi');
  await page.waitForTimeout(500);
  await shot('7-nama');
  await button(page, 'Lanjut').click();
  mark('reminders');
  await page.waitForTimeout(1100);
  await shot('8-pengingat');
  await button(page, opts.denied ? 'Nanti saja' : 'Izinkan pengingat').click();
  await page.getByRole('heading', { name: 'Semua siap.' }).waitFor({ timeout: 8000 });
  mark('done');
  // Before the two seconds run out: the celebration has started.
  await page.waitForTimeout(900);
  await shot('9-selesai');
  await page.locator('[data-mascot-spot="hero"]').waitFor({ timeout: 8000 });
  if (timing) await takeFrames(page);
  mark('landing');
  await page.waitForTimeout(1400);
  if (timing) notes.push(`frame transisi 9 ke Ringkasan: ${JSON.stringify(await takeFrames(page))}`);
  mark('ringkasan');
  await shot('10-ringkasan');
  return marks;
}

try {
  if (video) {
    const [width, height] = sizes.at(-1);
    for (const [name, reduced] of [['alur-penuh', false], ['alur-gerak-dikurangi', true]]) {
      const dir = join(out, name);
      const { context, page } = await open(width, height, 'light', '', { reduced, video: dir });
      await walk(page, () => null);
      await page.waitForTimeout(600);
      await context.close();
      notes.push(`klip ${name}: ${dir}`);
    }
  } else
  for (const [width, height] of sizes)
    for (const scheme of ['light', 'dark']) {
      const { context, page } = await open(width, height, scheme);
      const tag = `${width}x${height}-${scheme === 'light' ? 'terang' : 'gelap'}`;
      const counts = [];
      const marks = await walk(page, async (name) => {
        counts.push(`${name.split('-')[0]}:${await page.evaluate(MASCOTS)}`);
        await page.screenshot({ path: join(out, `${tag}-${name}.png`) });
      });
      notes.push(`${tag}: maskot terlihat per layar ${counts.join(' ')}`);
      const mascots = await page.evaluate(MASCOTS);
      notes.push(`${tag}: maskot terlihat setelah mendarat ${mascots}; waktu: ${marks.map((m, i) => (i === 0 ? '' : `${marks[i - 1].name} ${((m.at - marks[i - 1].at) / 1000).toFixed(1)} s`)).filter(Boolean).join(', ')}`);
      await context.close();
    }
  if (special && !video) {
    const [width, height] = sizes.at(-1);
    const cases = [
      ['masuk-ditutup', '?signin=cancel', { stopAt: 'signin', click: true }],
      ['masuk-offline', '?signin=offline', { stopAt: 'signin', click: true }],
      ['sync-gagal', '?prep=fail', { stopAt: 'preparing', prep: 'fail' }],
      ['sync-sebagian', '?prep=partial', { stopAt: 'preparing' }],
      ['nol-mata-kuliah', '', { noneTicked: true }],
      ['izin-ditolak', '', { denied: true }],
    ];
    for (const [name, query, opts] of cases) {
      const { context, page } = await open(width, height, 'light', query);
      await walk(page, (n) => (n.startsWith('4') || n.startsWith('5') || n.startsWith('6b') || n.startsWith('9') ? page.screenshot({ path: join(out, `khusus-${name}-${n}.png`) }) : null), opts);
      if (opts.click) {
        await button(page, 'Buka halaman SIKOLA').click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(out, `khusus-${name}.png`) });
      }
      await context.close();
    }
    for (const [name, extra] of [['zoom-130', { zoom: 1.3 }], ['gerak-dikurangi', { reduced: true }]]) {
      const { context, page } = await open(width, height, 'light', '', extra);
      await walk(page, (n) => page.screenshot({ path: join(out, `khusus-${name}-${n}.png`) }));
      await context.close();
    }
  }
} finally {
  await browser.close();
  process.kill(-server.pid);
}
writeFileSync(join(out, 'catatan.txt'), `${notes.join('\n')}\n`);
console.log(notes.join('\n'));

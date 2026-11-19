#!/usr/bin/env node
// Performance on a slow phone (M8c): the app's own web build with the
// synthetic demo account (50 tasks, ?demo=banyak), never SIKOLA. Measures
//   - cold open until Ringkasan shows (performance mark "sulo:ringkasan")
//   - the longest frame while scrolling Tugas (50 cards), switching tabs,
//     opening and closing a sheet, and on onboarding screens 1, 5 and 9
//   - JS heap and DOM nodes after N minutes of switching tabs
// for one tier (?perf=full|lite). Two targets:
//   --target=web (default): vite preview of `vite build --mode web` in
//     headless Chromium at 360x800, CPU slowed --cpu times (default 6).
// The emulator half is scripts/perf-cdp.mjs (driven by perf-emulator.sh).
// Usage: node scripts/perf-measure.mjs --tier=lite [--cpu=6] [--minutes=5] [--only=...] [--out=file.json]
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { MOBILE } from './env.mjs';
import { walk } from './onboarding-walk.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const tier = arg('tier', 'full');
const cpu = Number(arg('cpu', '6'));
const minutes = Number(arg('minutes', '5'));
const target = arg('target', 'web');
const out = arg('out', null);
const only = arg('only', null)?.split(',') ?? null;
const want = (k) => !only || only.includes(k);
const PORT = 5186;
const log = (m) => process.stderr.write(`perf-measure: ${m}\n`);

/** A rAF loop in the page: every frame's gap since the last. */
const PROBE = () => {
  if (window.__probe) return;
  window.__probe = true;
  window.__frames = [];
  let last = performance.now();
  const tick = (t) => {
    window.__frames.push(t - last);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
const startFrames = async (page) => {
  await page.evaluate(PROBE);
  await page.evaluate(() => (window.__frames = []));
};
const takeFrames = (page) =>
  page.evaluate(() => {
    const f = window.__frames.splice(0);
    const sorted = [...f].sort((a, b) => a - b);
    return { frames: f.length, max: Math.round(sorted.at(-1) ?? 0), p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] ?? 0), over50: f.filter((g) => g > 50).length };
  });

let server = null;
let browser;
let origin;
if (target !== 'web') throw new Error('perf-measure.mjs measures the web build; the emulator uses perf-cdp.mjs');
{
  execFileSync('pnpm', ['exec', 'vite', 'build', '--mode', 'web', '--outDir', 'dist-perf'], { cwd: MOBILE, stdio: 'ignore' });
  server = spawn('pnpm', ['exec', 'vite', 'preview', '--mode', 'web', '--outDir', 'dist-perf', '--port', String(PORT), '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
  await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve()));
  browser = await chromium.launch({ channel: 'chromium', headless: true });
  origin = `http://localhost:${PORT}`;
}

async function newPage() {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Makassar' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const cdp = await context.newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  return { context, page, cdp, close: () => context.close() };
}

const q = (extra = '') => `?demo=banyak&perf=${tier}${extra}`;
const result = { tier, target, cpu: target === 'web' ? cpu : null, viewport: '360x800' };

// ---- Ringkasan, Tugas, tabs, sheet, memory --------------------------------------
{
  const { page, cdp, close } = await newPage();
  // First: the demo account signed in and synced, so the next open is a cold open with data.
  log('membuka');
  await page.goto(`${origin}/${q()}`);
  await page.waitForFunction(() => typeof window.__suloEnterDemo === 'function', null, { timeout: 30000 });
  await page.evaluate(() => window.__suloEnterDemo());
  await page.locator('[data-mascot-spot="hero"]').waitFor({ timeout: 30000 });
  log('ringkasan tampil');
  result.tierInPage = await page.evaluate(() => document.documentElement.dataset.perf);

  if (want('cold')) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      await page.goto(`${origin}/${q('&session=connected')}`);
      await page.waitForFunction(() => performance.getEntriesByName('sulo:ringkasan').length > 0, null, { timeout: 30000 });
      runs.push(Math.round(await page.evaluate(() => performance.getEntriesByName('sulo:ringkasan')[0].startTime)));
    }
    log(`buka dingin ${runs}`);
    result.coldOpenMs = { runs, median: [...runs].sort((a, b) => a - b)[1] };
  }

  // Either language (the emulator follows its own locale).
  const NAMES = { Ringkasan: 'Ringkasan|Overview', Tugas: 'Tugas|Tasks', Kalender: 'Kalender|Calendar', Presensi: 'Presensi|Attendance', Lainnya: 'Lainnya|More' };
  const tab = async (name) => {
    const back = page.getByRole('button', { name: /^(Kembali|Back)$/ });
    while (await back.isVisible().catch(() => false)) await back.click();
    await page.getByRole('tab', { name: new RegExp(`^(${NAMES[name]})`) }).click();
  };

  if (want('scroll')) {
    await tab('Tugas');
    await page.waitForTimeout(1200);
    const box = await page.locator('main').boundingBox();
    await startFrames(page);
    for (const dir of [-1, 1, -1, 1]) {
      await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), yDistance: dir * 2400, speed: 2400, gestureSourceType: 'touch', repeatCount: 1 });
    }
    result.scrollTugas = await takeFrames(page);
    log('gulir selesai');
    result.tugasCards = await page.locator('main li').count();
  }

  const TABS = ['Ringkasan', 'Tugas', 'Kalender', 'Presensi', 'Lainnya'];
  if (want('tabs')) {
    await tab('Ringkasan');
    await page.waitForTimeout(800);
    await startFrames(page);
    for (let r = 0; r < 2; r++)
      for (const name of TABS) {
        await tab(name);
        await page.waitForTimeout(450);
      }
    result.switchTabs = await takeFrames(page);
    log('tab selesai');
  }

  if (want('sheet')) {
    await tab('Lainnya');
    await page.getByRole('main').getByRole('button', { name: /^(Pengaturan|Settings)/ }).first().click();
    await page.waitForTimeout(800);
    const row = page.getByRole('button', { name: /^(Animasi|Animation)/ });
    await row.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await startFrames(page);
    for (let r = 0; r < 3; r++) {
      await row.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    result.sheet = await takeFrames(page);
  }

  if (want('memory') && minutes > 0) {
    const metrics = async () => {
      await cdp.send('HeapProfiler.collectGarbage').catch(() => undefined);
      const { metrics: m } = await cdp.send('Performance.getMetrics');
      const get = (n) => m.find((x) => x.name === n)?.value ?? 0;
      return { heapMB: +(get('JSHeapUsedSize') / 1048576).toFixed(1), nodes: get('Nodes'), listeners: get('JSEventListeners') };
    };
    await cdp.send('Performance.enable');
    await tab('Ringkasan');
    const before = await metrics();
    const end = Date.now() + minutes * 60_000;
    let switches = 0;
    while (Date.now() < end) {
      await tab(TABS[switches % TABS.length]);
      switches += 1;
      await page.waitForTimeout(700);
    }
    await tab('Ringkasan');
    await page.waitForTimeout(1500);
    result.memory = { minutes, switches, before, after: await metrics() };
  }
  await close();
}

// ---- Onboarding screens 1, 5, 9 ----
if (want('onboarding')) {
  const { page, close } = await newPage();
  await page.goto(`${origin}/${q()}`);
  const lang = await page.evaluate(() => (navigator.language.toLowerCase().startsWith('id') ? 'id' : 'en'));
  await page.evaluate(PROBE);
  const frames = {};
  const at = async (name) => {
    const key = name.split('-')[0];
    if (['1', '5', '9'].includes(key)) frames[key] = await takeFrames(page);
    // 10: from "Buka Sulo" to Ringkasan settled (the landing).
    if (key === '10') frames.landing = await takeFrames(page);
  };
  await walk(page, at, { lang, slow: Math.max(1, cpu / 3), onEnter: async (name) => ['1', '5', '9'].includes(name) && (await page.evaluate(() => (window.__frames = []))) });
  result.onboarding = frames;
  await close();
}

// ---- "Buka Sulo" tapped as soon as the done screen shows (before Ringkasan's idle mount) ----
if (want('early')) {
  const { page, close } = await newPage();
  await page.goto(`${origin}/${q()}`);
  await page.evaluate(PROBE);
  const lang = await page.evaluate(() => (navigator.language.toLowerCase().startsWith('id') ? 'id' : 'en'));
  let done = false;
  await walk(page, async (name) => {
    if (!name.startsWith('8-') || done) return;
    done = true;
  }, { lang, slow: Math.max(1, cpu / 3), onEnter: async (name) => {
    if (name !== '9') return;
    await page.evaluate(() => (window.__frames = []));
    // At once, before the celebration ends.
    await page.getByRole('button', { name: /^(Buka Sulo|Open Sulo)$/ }).click();
    const t0 = Date.now();
    await page.locator('[data-mascot-spot="hero"]').waitFor({ timeout: 15000 });
    await page.waitForFunction(() => !document.querySelector('.onb-frame'), null, { timeout: 15000 });
    result.earlyTap = { ...(await takeFrames(page)), landedMs: Date.now() - t0, heroVisible: await page.locator('[data-mascot-spot="hero"]').isVisible() };
    throw new Error('early-tap-done');
  } }).catch((e) => { if (!String(e).includes('early-tap-done')) throw e; });
  await close();
}

await browser.close().catch(() => undefined);
if (server) process.kill(-server.pid);
const text = JSON.stringify(result, null, 2);
if (out) writeFileSync(out, text);
console.log(text);

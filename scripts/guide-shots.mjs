#!/usr/bin/env node
// pnpm guide:shots: short screen recordings for "Mulai pakai" in Bantuan,
// from the synthetic demo data in fixtures/guide/demo-seed.json (never a
// real account). Each step is played by a script, with a drawn cursor,
// click ripples and key badges laid over the page (only while recording;
// none of it is in the extension). Light and dark, Indonesian and English.
//
// Frames come from the Chrome DevTools screencast at device pixel ratio 2
// (sharp text), then Playwright's own ffmpeg crops them to the step's area
// and encodes WebM (VP9, 1200 px wide, 24 fps). A still WebP of the last frame is
// the poster, also shown with reduced motion. Output: public/guide/.
// Run by hand, not in CI; commit the files.
//
// Usage: pnpm guide:shots [--no-build] [--only=<step>]

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { demoStorage } from './lib/demo-storage.mjs';
import { demoNeosia } from './lib/demo-neosia.mjs';

const root = new URL('..', import.meta.url).pathname;
const ext = join(root, '.output/chrome-mv3-dev');
const outDir = join(root, 'public/guide');
const WIDTH = 1200;
const FPS = 24;
const CRF = 40;
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

if (!process.argv.includes('--no-build')) execFileSync('pnpm', ['build:dev'], { cwd: root, stdio: 'inherit' });
mkdirSync(outDir, { recursive: true });
const ffmpeg = findFfmpeg();

/** Playwright's ffmpeg (has crop, scale and VP9); FFMPEG overrides it. */
function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  for (const base of [join(homedir(), 'Library/Caches/ms-playwright'), join(homedir(), '.cache/ms-playwright')]) {
    if (!existsSync(base)) continue;
    for (const dir of readdirSync(base).filter((d) => d.startsWith('ffmpeg-')).sort().reverse()) {
      for (const bin of ['ffmpeg-mac', 'ffmpeg-linux', 'ffmpeg-win64.exe']) if (existsSync(join(base, dir, bin))) return join(base, dir, bin);
    }
  }
  throw new Error('ffmpeg not found: run `npx playwright install ffmpeg` or set FFMPEG');
}

// ---- The overlay: cursor, click ripple, key badges (recording only) --------

const OVERLAY = `(() => {
  if (window.__guide) return;
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  root.innerHTML = '<svg id="g-cursor" width="22" height="22" viewBox="0 0 24 24" style="position:absolute;left:0;top:0;transform:translate(-3px,-2px);filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))"><path d="M4 2l15 10.5-6.6 1.3 3.9 7.4-2.9 1.5-3.9-7.4L4 20z" fill="#111114" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><div id="g-keys" style="position:absolute;right:16px;bottom:16px;display:flex;gap:6px"></div>';
  document.body.appendChild(root);
  const cursor = root.querySelector('#g-cursor');
  const keys = root.querySelector('#g-keys');
  let x = innerWidth * 0.6, y = innerHeight * 0.7;
  cursor.style.left = x + 'px'; cursor.style.top = y + 'px';
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  window.__guide = {
    move: (tx, ty, ms) => new Promise((done) => {
      const sx = x, sy = y, t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms), k = ease(t);
        x = sx + (tx - sx) * k; y = sy + (ty - sy) * k;
        cursor.style.left = x + 'px'; cursor.style.top = y + 'px';
        t < 1 ? requestAnimationFrame(step) : done();
      };
      requestAnimationFrame(step);
    }),
    ripple: () => {
      const r = document.createElement('div');
      r.style.cssText = 'position:absolute;width:28px;height:28px;border-radius:50%;border:3px solid #ff5a2a;transform:translate(-50%,-50%) scale(.4);opacity:1;transition:transform .45s ease-out,opacity .45s ease-out';
      r.style.left = x + 'px'; r.style.top = y + 'px';
      root.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'translate(-50%,-50%) scale(1.6)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 600);
    },
    key: (label) => {
      const k = document.createElement('kbd');
      k.textContent = label;
      k.style.cssText = 'font:600 15px/1 system-ui,sans-serif;padding:8px 12px;border-radius:8px;background:#111114;color:#fff;border:1px solid #3a3a44;box-shadow:0 2px 0 #3a3a44;transition:opacity .3s';
      keys.appendChild(k);
      setTimeout(() => { k.style.opacity = '0'; setTimeout(() => k.remove(), 320); }, 900);
    },
  };
})()`;

/** Moves the drawn cursor (and the real mouse, for hover states) to an element's centre. */
async function moveTo(page, target, ms = 650) {
  const b = await target.boundingBox();
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  await Promise.all([page.evaluate(([x, y, d]) => window.__guide.move(x, y, d), [cx, cy, ms]), page.mouse.move(cx, cy, { steps: 8 })]);
}

async function click(page, target, pause = 450) {
  await moveTo(page, target);
  await page.evaluate(() => window.__guide.ripple());
  await target.click();
  await page.waitForTimeout(pause);
}

async function press(page, key, label = key) {
  await page.evaluate((l) => window.__guide.key(l), label);
  await page.keyboard.press(key);
  await page.waitForTimeout(450);
}

async function type(page, text) {
  await page.keyboard.type(text, { delay: 55 });
  await page.waitForTimeout(300);
}

const re = (id, en) => new RegExp(`^(${id}|${en})`);

/** An element's box in CSS px, cut at `maxBottom` from the top of the window. */
async function box(locator, maxBottom) {
  const b = await locator.boundingBox();
  const height = maxBottom ? Math.min(b.height, maxBottom - b.y) : b.height;
  return { x: Math.max(0, b.x - 16), y: Math.max(0, b.y - 16), width: b.width + 32, height: height + 16 };
}

// ---- The steps -----------------------------------------------------------

const STEPS = [
  {
    id: 'popup',
    url: '/popup.html',
    viewport: { width: 380, height: 520 },
    area: async () => ({ x: 0, y: 0, width: 380, height: 520 }),
    play: async (p) => {
      await moveTo(p, p.locator('li').first(), 800);
      await p.waitForTimeout(700);
      await click(p, p.getByRole('button', { name: re('Perbarui sekarang', 'Update now') }), 1200);
      await click(p, p.getByRole('button', { name: re('Pengaturan', 'Settings') }), 500);
      await moveTo(p, p.getByRole('menuitem', { name: re('Buka dashboard', 'Open dashboard') }));
      await p.waitForTimeout(900);
    },
  },
  {
    id: 'tugas',
    url: '/dashboard.html#tugas',
    viewport: { width: 1280, height: 760 },
    area: async (p) => box(p.locator('.db-content'), 760),
    play: async (p, locale) => {
      const row = p.locator('li[id^="task-"]').first();
      await click(p, row.getByRole('button', { name: re('Rincian', 'Details') }), 600);
      await click(p, row.getByRole('textbox', { name: re('Tambah langkah', 'Add step') }), 200);
      await type(p, locale === 'id' ? 'Kerjakan bab 2' : 'Draft chapter 2');
      await press(p, 'Enter');
      await click(p, row.locator('textarea'), 200);
      await type(p, locale === 'id' ? 'Tanya asisten soal format' : 'Ask the assistant about the format');
      await click(p, row.getByRole('combobox', { name: re('Tunda pengingat', 'Snooze reminder') }), 500);
      await click(p, p.getByRole('option').first(), 700);
      await click(p, row.getByRole('checkbox').first(), 1200);
    },
  },
  {
    id: 'mata-kuliah',
    url: '/dashboard.html#mata-kuliah',
    viewport: { width: 1280, height: 640 },
    area: async (p) => box(p.locator('.db-content'), 640),
    play: async (p, locale) => {
      await click(p, p.getByRole('button', { name: re('Ubah nama tampilan', 'Edit display name') }).first(), 300);
      await p.keyboard.press('ControlOrMeta+a');
      await type(p, locale === 'id' ? 'Etika Profesi' : 'Professional Ethics');
      await press(p, 'Enter');
      await click(p, p.getByRole('button', { name: re('Warna ', 'Color of ') }).first(), 500);
      await press(p, 'ArrowRight', '→');
      await press(p, 'ArrowRight', '→');
      await press(p, 'Enter');
      await p.waitForTimeout(400);
      await click(p, p.getByRole('switch').nth(3), 1200);
    },
  },
  {
    id: 'kalender',
    url: '/dashboard.html#kalender',
    viewport: { width: 1280, height: 900 },
    area: async (p) => box(p.locator('.db-content'), 900),
    play: async (p) => {
      await click(p, p.getByRole('button', { name: re('Tugas', 'Tasks') }).last(), 900);
      await click(p, p.getByRole('button', { name: re('Tugas', 'Tasks') }).last(), 700);
      const days = p.locator('[data-day]');
      await click(p, days.nth(Math.min(24, (await days.count()) - 1)), 1000);
      await p.mouse.wheel(0, 1400);
      await p.waitForTimeout(700);
      await moveTo(p, p.getByRole('link', { name: re('Google Kalender', 'Google Calendar') }).first());
      await p.waitForTimeout(500);
      await click(p, p.getByRole('button', { name: /^(Pilihan lain untuk|More options for)/ }).first(), 1200);
    },
  },
  {
    id: 'kabar',
    url: '/dashboard.html#kabar',
    viewport: { width: 1280, height: 640 },
    area: async (p) => box(p.locator('.db-content'), 640),
    play: async (p) => {
      await click(p, p.getByRole('combobox', { name: re('Jenis kabar', 'Kind of update') }), 500);
      await click(p, p.getByRole('option').nth(2), 900);
      await click(p, p.getByRole('button', { name: re('Atur notifikasi', 'Notification settings') }), 600);
      await click(p, p.getByRole('checkbox').nth(3), 1200);
    },
  },
  {
    // Chrome's own permission prompt cannot be recorded (it is browser UI):
    // the clip shows the consent screen, the click on "Hubungkan", then the
    // connected state from the synthetic NEOSIA demo data.
    id: 'neosia',
    url: '/dashboard.html#pengaturan/neosia',
    viewport: { width: 1280, height: 720 },
    // The main column under the header (sidebar 232 px, header 64 px).
    area: async () => ({ x: 232, y: 64, width: 1048, height: 656 }),
    play: async (p) => {
      // The NEOSIA card's title just under the sticky header.
      const toCard = () => p.evaluate(() => {
        const card = document.getElementById('set-neosia')?.closest('section');
        if (card) window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 88 });
      });
      await toCard();
      await p.waitForTimeout(500);
      await click(p, p.getByRole('switch', { name: re('Hubungkan NEOSIA', 'Connect NEOSIA') }), 900);
      const dialog = p.getByRole('alertdialog');
      await moveTo(p, dialog.getByRole('heading').first(), 600);
      await p.mouse.wheel(0, 300);
      await p.waitForTimeout(900);
      const connect = dialog.getByRole('button', { name: re('Hubungkan', 'Connect') });
      await moveTo(p, connect);
      await p.evaluate(() => window.__guide.ripple());
      await p.waitForTimeout(400);
      await p.keyboard.press('Escape');
      await p.evaluate(async (s) => chrome.storage.local.set(s), demoNeosia());
      await p.waitForTimeout(900);
      await toCard();
      await p.waitForTimeout(300);
      await moveTo(p, p.getByRole('link', { name: re('Buka NEOSIA', 'Open NEOSIA') }), 700);
      await p.waitForTimeout(1200);
    },
  },
];

// ---- Recording ------------------------------------------------------------

async function record(page, play) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    frames.push({ data: f.data, t: f.metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  await page.waitForTimeout(600);
  await play();
  await page.waitForTimeout(400);
  await cdp.send('Page.stopScreencast');
  return frames;
}

/**
 * Encodes the frames (cropped to `area`) as WebM. Playwright's ffmpeg reads
 * JPEGs from a pipe only, at a constant rate, so each frame is repeated for
 * as long as it was on screen (the screencast only sends changed frames).
 */
function encode(frames, area, viewport, file) {
  const step = 1 / FPS;
  const end = frames[frames.length - 1].t + 1.2;
  const sequence = [];
  let k = 0;
  for (let t = frames[0].t; t <= end; t += step) {
    while (k + 1 < frames.length && frames[k + 1].t <= t) k += 1;
    sequence.push(Buffer.from(frames[k].data, 'base64'));
  }
  // Crop in proportion to the frame size (the screencast is in device pixels).
  const crop = `crop=iw*${area.width / viewport.width}:ih*${area.height / viewport.height}:iw*${area.x / viewport.width}:ih*${area.y / viewport.height}`;
  const vf = `${crop},scale=${WIDTH}:-2:flags=lanczos`;
  execFileSync(
    ffmpeg,
    ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', 'pipe:0', '-vf', vf, '-c:v', 'libvpx-vp9', '-crf', String(CRF), '-b:v', '0', '-pix_fmt', 'yuv420p', '-an', file],
    { input: Buffer.concat(sequence), maxBuffer: 1 << 30 },
  );
}

/** The poster: the last frame, cropped and scaled to WIDTH, encoded as WebP (quality 80) by Chromium. */
async function poster(page, frame, area, viewport) {
  const data = await page.evaluate(
    async ({ b64, area, viewport, width }) => {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${b64}`;
      await img.decode();
      const sx = img.width / viewport.width;
      const sy = img.height / viewport.height;
      const c = document.createElement('canvas');
      c.width = width;
      c.height = Math.round(((area.height / area.width) * width) / 2) * 2;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, area.x * sx, area.y * sy, area.width * sx, area.height * sy, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', 0.8).split(',')[1];
    },
    { b64: frame.data, area, viewport, width: WIDTH },
  );
  return Buffer.from(data, 'base64');
}

async function run() {
  const sizes = {};
  for (const locale of ['id', 'en']) {
    for (const theme of ['light', 'dark']) {
      for (const step of STEPS.filter((s) => !only || s.id === only)) {
        // A fresh profile per clip, so every recording starts from the same demo state.
        const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, deviceScaleFactor: 2, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
        let [sw] = ctx.serviceWorkers();
        if (!sw) sw = await ctx.waitForEvent('serviceworker');
        const extId = new URL(sw.url()).host;
        const storage = demoStorage(root);
        storage['global:prefs'] = { ...(storage['global:prefs'] ?? {}), locale, theme };
        await sw.evaluate(async (s) => chrome.storage.local.set(s), storage);
        await new Promise((r) => setTimeout(r, 1000));
        const page = await ctx.newPage();
        await page.setViewportSize(step.viewport);
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(`chrome-extension://${extId}${step.url}`);
        await page.waitForTimeout(900);
        await page.evaluate(OVERLAY);
        const area = await step.area(page);
        const frames = await record(page, () => step.play(page, locale));
        const stem = `${step.id}-${theme}-${locale}`;
        encode(frames, area, step.viewport, join(outDir, `${stem}.webm`));
        writeFileSync(join(outDir, `${stem}.webp`), await poster(page, frames[frames.length - 1], area, step.viewport));
        sizes[step.id] ??= { width: WIDTH, height: Math.round(((area.height / area.width) * WIDTH) / 2) * 2 };
        const kb = (f) => (statSync(join(outDir, f)).size / 1024).toFixed(0);
        console.log(`${stem}: ${frames.length} frames, video ${kb(`${stem}.webm`)} KB, poster ${kb(`${stem}.webp`)} KB`);
        await ctx.close();
      }
    }
  }
  mkdirSync(join(root, 'scripts/guide'), { recursive: true });
  // --only keeps the other steps' sizes.
  const sizesFile = join(root, 'scripts/guide/sizes.json');
  const kept = existsSync(sizesFile) ? JSON.parse(readFileSync(sizesFile, 'utf8')) : {};
  writeFileSync(sizesFile, `${JSON.stringify({ ...kept, ...sizes }, null, 2)}\n`);
  const files = readdirSync(outDir);
  const total = (suffix) => files.filter((f) => f.endsWith(suffix)).reduce((s, f) => s + statSync(join(outDir, f)).size, 0) / 1024;
  console.log(`total: videos ${total('.webm').toFixed(0)} KB, posters ${total('.webp').toFixed(0)} KB`);
}

await run();

#!/usr/bin/env node
// pnpm guide:shots: screenshots for "Mulai pakai" in Bantuan, from the
// synthetic demo data in fixtures/guide/demo-seed.json (never a real
// account). Light and dark, Indonesian and English, cropped to the part each
// step talks about, saved as WebP (about 1200 px wide, quality 80) in
// public/guide/. Marker positions (percent of the image) are measured from
// the real elements and written to scripts/guide/markers.json, to copy into
// lib/help/guide.ts. Run by hand, not in CI; commit the images.
//
// Usage: pnpm guide:shots [--no-build]

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const ext = join(root, '.output/chrome-mv3-dev');
const outDir = join(root, 'public/guide');
const WIDTH = 1200;
const QUALITY = 0.8;
/** CSS px: marker centre this far left of its element, and at least this far inside the picture. */
const MARKER_GAP = 14;
const MARKER_EDGE = 14;

if (!process.argv.includes('--no-build')) execFileSync('pnpm', ['build:dev'], { cwd: root, stdio: 'inherit' });
mkdirSync(outDir, { recursive: true });
mkdirSync(join(root, 'scripts/guide'), { recursive: true });

/** The demo storage with every timestamp moved so "now" is the moment this runs. */
function demoStorage() {
  const { generatedAt, storage } = JSON.parse(readFileSync(join(root, 'fixtures/guide/demo-seed.json'), 'utf8'));
  const shift = Math.floor(Date.now() / 1000) - generatedAt;
  const walk = (v, key = '') => {
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    return typeof v === 'number' && /At$|^at$|^dueAt$/.test(key) && v > 1e9 ? v + shift : v;
  };
  return walk(storage);
}

const re = (id, en) => new RegExp(`^(${id}|${en})`);

/** Each step: where to go, what to do first, the area to keep, and the elements its markers point at. */
const STEPS = [
  {
    id: 'popup',
    url: '/popup.html',
    viewport: { width: 380, height: 600 },
    clip: (p) => p.locator('body'),
    maxHeight: 440,
    markers: (p) => [p.locator('li').first(), p.getByRole('button', { name: re('Perbarui sekarang', 'Update now') }), p.getByRole('button', { name: re('Pengaturan', 'Settings') })],
  },
  {
    id: 'tugas',
    url: '/dashboard.html#tugas',
    viewport: { width: 1280, height: 900 },
    prepare: async (p) => p.getByRole('button', { name: re('Rincian', 'Details') }).first().click(),
    clip: (p) => p.locator('li[id^="task-"]').first(),
    markers: (p) => {
      const row = p.locator('li[id^="task-"]').first();
      return [row.getByRole('textbox', { name: re('Tambah langkah', 'Add step') }), row.locator('textarea'), row.getByRole('combobox', { name: re('Tunda pengingat', 'Snooze reminder') }), row.getByRole('checkbox').first()];
    },
  },
  {
    id: 'mata-kuliah',
    url: '/dashboard.html#mata-kuliah',
    viewport: { width: 1280, height: 900 },
    clip: (p) => p.locator('.db-content section').first(),
    markers: (p) => [p.getByRole('switch').first(), p.getByRole('button', { name: re('Ubah nama tampilan', 'Edit display name') }).first(), p.getByRole('button', { name: re('Warna ', 'Color of ') }).first()],
  },
  {
    id: 'kalender',
    url: '/dashboard.html#kalender',
    viewport: { width: 1280, height: 1700 },
    clip: (p) => p.locator('.db-content'),
    markers: (p) => [p.getByRole('group', { name: re('Kategori yang ditampilkan', 'Categories shown') }), p.locator('[aria-current="date"]').first(), p.getByRole('link', { name: re('Google Kalender', 'Google Calendar') }).first()],
  },
  {
    id: 'kabar',
    url: '/dashboard.html#kabar',
    viewport: { width: 1280, height: 900 },
    prepare: async (p) => p.getByRole('button', { name: re('Atur notifikasi', 'Notification settings') }).click(),
    clip: (p) => p.locator('.db-content'),
    // The popover is portalled outside the content; the crop grows to include it.
    extra: (p) => p.locator('[data-slot="popover-content"]'),
    markers: (p) => [p.getByRole('combobox', { name: re('Jenis kabar', 'Kind of update') }), p.locator('.db-content li').first(), p.getByRole('button', { name: re('Atur notifikasi', 'Notification settings') })],
  },
];

async function run() {
  const markers = {};
  for (const locale of ['id', 'en']) {
    for (const theme of ['light', 'dark']) {
      const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, deviceScaleFactor: 2, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
      let [sw] = ctx.serviceWorkers();
      if (!sw) sw = await ctx.waitForEvent('serviceworker');
      const extId = new URL(sw.url()).host;
      const storage = demoStorage();
      storage['global:prefs'] = { ...(storage['global:prefs'] ?? {}), locale, theme };
      await sw.evaluate(async (s) => chrome.storage.local.set(s), storage);
      await new Promise((r) => setTimeout(r, 1200));
      for (const step of STEPS) {
        const page = await ctx.newPage();
        await page.setViewportSize(step.viewport);
        await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
        await page.goto(`chrome-extension://${extId}${step.url}`);
        await page.waitForTimeout(900);
        if (step.prepare) {
          await step.prepare(page);
          await page.waitForTimeout(400);
        }
        let box = await step.clip(page).boundingBox();
        if (step.extra) {
          const e = await step.extra(page).boundingBox();
          if (e) box = union(box, e);
        }
        if (step.maxHeight) box = { ...box, height: Math.min(box.height, step.maxHeight) };
        const png = await page.screenshot({ clip: box });
        const webp = await toWebp(page, png);
        const file = `${step.id}-${theme}-${locale}.webp`;
        writeFileSync(join(outDir, file), webp);
        if (theme === 'light') {
          const points = [];
          for (const m of step.markers(page)) {
            const b = await m.first().boundingBox();
            const [x, y] = b ? markerSpot(b, box) : [0, 0];
            points.push(b ? [round((x / box.width) * 100), round((y / box.height) * 100)] : null);
          }
          markers[step.id] ??= { width: WIDTH, height: Math.round((box.height / box.width) * WIDTH) };
          markers[step.id][locale] = points;
        }
        console.log(file, `${(webp.length / 1024).toFixed(0)} KB`);
        await page.close();
      }
      await ctx.close();
    }
  }
  writeFileSync(join(root, 'scripts/guide/markers.json'), `${JSON.stringify(markers, null, 2)}\n`);
  const total = readdirSync(outDir).reduce((sum, f) => sum + statSync(join(outDir, f)).size, 0);
  console.log(`total ${(total / 1024).toFixed(0)} KB in public/guide`);
}

const round = (n) => Math.round(n * 10) / 10;

/**
 * Where a marker goes so it never covers what it points at: just left of
 * the element (centred on its height), else just above its left end, else
 * just right of it. Coordinates relative to the crop, in CSS px.
 */
function markerSpot(b, box) {
  const left = b.x - box.x;
  const top = b.y - box.y;
  const midY = top + b.height / 2;
  if (left >= MARKER_GAP + MARKER_EDGE) return [left - MARKER_GAP, midY];
  if (top >= MARKER_GAP + MARKER_EDGE) return [left + MARKER_EDGE, top - MARKER_GAP];
  return [Math.min(box.width - MARKER_EDGE, left + b.width + MARKER_GAP), midY];
}
const union = (a, b) => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
};

/** Chromium encodes WebP itself (canvas), resized to WIDTH: no image library needed. */
async function toWebp(page, png) {
  const data = await page.evaluate(
    async ({ b64, width, quality }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.round((img.height / img.width) * width);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/webp', quality).split(',')[1];
    },
    { b64: png.toString('base64'), width: WIDTH, quality: QUALITY },
  );
  return Buffer.from(data, 'base64');
}

await run();

#!/usr/bin/env node
// The tilted iPhones (turned left and right) as finished pictures: the
// Android app's screen rendered from the built page at 402 x 874 pt (3 px a
// point), bent onto the frame's screen by the homography of its four measured
// corners (src/data/bingkai.json), cut to the screen's exact shape (the
// frame's mask), and laid under the frame. One picture per tilt, theme and
// language, light UI in the light frame and dark in the dark one. Sharp, light,
// no script on the page. Runs after `astro build` (it reads dist/) and writes
// next to the pages: dist/miring/.
//
//   node apps/landing/scripts/layar-miring.mjs [--dist=<folder>] [--salin=<folder for a copy>]
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { readPng, writePng } from './lib/png.mjs';
import { resize } from './lib/resize.mjs';
import { serve } from './lib/server.mjs';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const DIST = resolve(arg('dist', join(ROOT, 'apps/landing/dist')));
const COPY = arg('salin', null);
const ASSETS = join(ROOT, 'apps/landing/src/assets/bingkai');
const OUT = join(DIST, 'miring');
const data = JSON.parse(readFileSync(join(ROOT, 'apps/landing/src/data/bingkai.json'), 'utf8')).bingkai;

/** Pixels per point the screen is rendered at before it is bent. */
const K = 3;
/** Sub-samples per output pixel, per axis. */
const SS = 4;

/** The homography taking `from` (4 points) to `to`: the 3x3 matrix as 9 numbers. */
function homography(from, to) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i];
    const [X, Y] = to[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  // Gaussian elimination with partial pivoting.
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return [...b.map((v, i) => v / A[i][i]), 1];
}
const apply = (h, x, y) => {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
};

/** Bilinear sample of an RGBA image, clamped at the edges, into `out` (r, g, b). */
function sample(img, u, v, out) {
  const x = Math.min(img.width - 1.001, Math.max(0, u - 0.5));
  const y = Math.min(img.height - 1.001, Math.max(0, v - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const d = img.data;
  const i00 = (y0 * img.width + x0) * 4;
  const i10 = i00 + 4;
  const i01 = i00 + img.width * 4;
  const i11 = i01 + 4;
  for (let k = 0; k < 3; k++) out[k] = (d[i00 + k] * (1 - fx) + d[i10 + k] * fx) * (1 - fy) + (d[i01 + k] * (1 - fx) + d[i11 + k] * fx) * fy;
}

/** The screen bent into the frame: the frame over the UI, the UI only where the screen shows. */
function compose(ui, frame, mask, corners) {
  const { width, height } = frame;
  const src = [[0, 0], [ui.width, 0], [ui.width, ui.height], [0, ui.height]];
  const dst = [corners.kiriAtas, corners.kananAtas, corners.kananBawah, corners.kiriBawah];
  const back = homography(dst, src);
  const out = { width, height, data: new Uint8Array(frame.data) };
  const acc = [0, 0, 0];
  const s = [0, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      if (mask.data[p + 3] === 0) continue;
      acc[0] = acc[1] = acc[2] = 0;
      for (let j = 0; j < SS; j++) {
        for (let i = 0; i < SS; i++) {
          const [u, v] = apply(back, x + (i + 0.5) / SS, y + (j + 0.5) / SS);
          sample(ui, u, v, s);
          acc[0] += s[0];
          acc[1] += s[1];
          acc[2] += s[2];
        }
      }
      const a = frame.data[p + 3] / 255;
      for (let k = 0; k < 3; k++) out.data[p + k] = Math.round(frame.data[p + k] * a + (acc[k] / (SS * SS)) * (1 - a));
      out.data[p + 3] = 255;
    }
  }
  return out;
}

/** The phone's whole screen at K px a point: the status bar's strip, the app, the home indicator's strip. */
async function screen(browser, base, bahasa, tema) {
  const g = data['iphone-terang'];
  const top = g.safeArea.top;
  const bottom = g.safeArea.bottom;
  const page = await browser.newPage({ viewport: { width: 402, height: Math.round(874 - top - bottom) }, deviceScaleFactor: K, reducedMotion: 'reduce' });
  await page.goto(`${base}/layar/${bahasa}/hp/${tema}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const app = readPng(await page.screenshot());
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number));
  await page.close();
  const W = 402 * K;
  const H = 874 * K;
  const out = { width: W, height: H, data: new Uint8Array(W * H * 4) };
  for (let i = 0; i < W * H; i++) out.data.set([bg[0], bg[1], bg[2], 255], i * 4);
  const y0 = Math.round(top * K);
  for (let y = 0; y < app.height && y0 + y < H; y++) out.data.set(app.data.subarray(y * app.width * 4, (y + 1) * app.width * 4), (y0 + y) * W * 4);
  return out;
}

mkdirSync(OUT, { recursive: true });
if (COPY) mkdirSync(COPY, { recursive: true });
const site = await serve(DIST);
const browser = await chromium.launch();
const made = [];
for (const bahasa of ['id', 'en']) {
  for (const tema of ['terang', 'gelap']) {
    const ui = await screen(browser, site.url, bahasa, tema);
    for (const arah of ['kiri', 'kanan']) {
      const id = `iphone-${arah}-${tema}`;
      const g = data[id];
      const frame = readPng(readFileSync(join(ASSETS, `${id}-${g.gambar.width}.png`)));
      const mask = readPng(readFileSync(join(ASSETS, `iphone-${arah}-${tema}-mask.png`)));
      const full = compose(ui, frame, mask, g.sudutLayar.px);
      for (const w of [full.width, 400]) {
        const img = w === full.width ? full : resize(full, w, Math.round((full.height * w) / full.width));
        const name = `${id}-${bahasa}-${img.width}`;
        writeFileSync(join(OUT, `${name}.png`), writePng(img));
        execFileSync('cwebp', ['-quiet', '-q', '86', '-alpha_q', '100', '-m', '6', '-sharp_yuv', join(OUT, `${name}.png`), '-o', join(OUT, `${name}.webp`)]);
        made.push(name);
        if (COPY) for (const ext of ['png', 'webp']) copyFileSync(join(OUT, `${name}.${ext}`), join(COPY, `${name}.${ext}`));
      }
    }
  }
}
await browser.close();
await site.stop();
console.log(`layar-miring: ${made.length} gambar di ${OUT}`);

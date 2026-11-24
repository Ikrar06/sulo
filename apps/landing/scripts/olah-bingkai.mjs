#!/usr/bin/env node
// The owner's device frames (Figma: MacBook Pro 14, iPhone 18 Pro straight and
// turned left or right, each phone in a light and a dark version) arrive with
// the screen filled with green. This turns them into frames with a see-through
// screen for the landing page, without a chroma key.
//
// - The key colour is measured from the middle of each screen, never assumed.
// - The screen's mask is its whole shape with every hole filled: the area the
//   green reaches (a flood fill through every pixel that carries any green),
//   plus everything enclosed in it: the Dynamic Island, the status bar's time
//   and icons, the home indicator, and the green inside them (the counters of
//   a 9 or a 4 are islands of green the flood fill never reaches). Every pixel
//   in the mask that carries green is unmixed; pixels outside it (the body,
//   the side buttons, the shadow) are never touched. The MacBook's notch
//   belongs to the bezel, so it lies outside the mask.
// - Every pixel there that carries green is a mix C = a·F + (1 - a)·K of the
//   key K and a foreground F. Everything that meets the screen is neutral: the
//   bezel and the Dynamic Island are black, the status bar and the home
//   indicator black in the light frame and white in the dark one. With a
//   neutral F = (c, c, c) the mix has one exact solution per pixel:
//     a = 1 - ((g - r) + (g - b)) / ((Kg - Kr) + (Kg - Kb))
//     c = ((r - (1 - a)·Kr) + (b - (1 - a)·Kb)) / 2a
//   so a thin white stroke with no solid core comes out white, never black.
//   Where the alpha is tiny (c is then imprecise), F is the known colour of
//   that place: the nearest solid pixel, or the status bar's colour.
//   Each pixel's reconstruction error is recorded per zone as the proof, and
//   no frame is written while any pixel that shows is still near the key or
//   clearly green (lib/periksa-hijau.mjs; check-bingkai.mjs does the same in CI).
// - The screen's four outer corners (where its straight edges meet, outside
//   the rounded corners) come from a line fitted to each edge, placed to a
//   fraction of a pixel by the edge pixels' coverage. The screen's exact shape
//   is kept as a mask: how much of a UI laid under the frame shows through
//   each pixel.
//
// Also: the straight iPhone frames without the status bar (the Dynamic Island
// stays) for "Sehari bareng Sulo", which draws its own; every frame cropped to
// the device and resized on premultiplied colours; WebP (cwebp) with a PNG
// fallback; one data file with the measurements; and, with --periksa, check
// sheets at 4x of the corners, edges, Dynamic Island, status bar and notch on
// light and dark backgrounds.
//
// The owner's PNGs with the green screen stay out of the repository.
//
//   node apps/landing/scripts/olah-bingkai.mjs [--src=<folder with the PNGs>]
//        [--out=<asset folder>] [--data=<json>] [--periksa=<folder for the check sheets>]

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { GREEN_LEAD, greenPixels, NEAR_KEY } from './lib/periksa-hijau.mjs';
import { readPng, writePng } from './lib/png.mjs';
import { resize } from './lib/resize.mjs';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const SRC = resolve(arg('src', join(ROOT, 'docs/landing/bingkai')));
const OUT = resolve(arg('out', join(ROOT, 'apps/landing/src/assets/bingkai')));
const DATA = resolve(arg('data', join(ROOT, 'apps/landing/src/data/bingkai.json')));
const CHECK = arg('periksa', null);

const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];
/** Below this alpha the neutral solution's colour is imprecise; the place's known colour is used. */
const FAINT = 0.15;
/** How far (px) to look for the nearest solid pixel. */
const REACH = 4;
/** Pixels this close (px) to the bezel are the screen's edge, not the status bar. */
const EDGE = 5;

const PHONE = { width: 402, height: 874 };
const SOURCES = [
  { id: 'macbook', file: 'macbook-pro-14.png', kind: 'laptop', pt: { width: 1512, height: 982 }, widths: [2400, 1200] },
  { id: 'iphone-terang', file: 'iphone-18-pro-terang.png', kind: 'phone', pt: PHONE, widths: [0, 600], glyph: BLACK },
  { id: 'iphone-gelap', file: 'iphone-18-pro-gelap.png', kind: 'phone', pt: PHONE, widths: [0, 600], glyph: WHITE },
  // Tilted: laid over a finished picture of the UI (scripts/layar-miring.mjs), never over the live UI.
  { id: 'iphone-kiri-terang', file: 'iphone-18-pro-kiri-terang.png', kind: 'phone', tilt: 'kiri', pt: PHONE, widths: [0], glyph: BLACK },
  { id: 'iphone-kiri-gelap', file: 'iphone-18-pro-kiri-gelap.png', kind: 'phone', tilt: 'kiri', pt: PHONE, widths: [0], glyph: WHITE },
  { id: 'iphone-kanan-terang', file: 'iphone-18-pro-kanan-terang.png', kind: 'phone', tilt: 'kanan', pt: PHONE, widths: [0], glyph: BLACK },
  { id: 'iphone-kanan-gelap', file: 'iphone-18-pro-kanan-gelap.png', kind: 'phone', tilt: 'kanan', pt: PHONE, widths: [0], glyph: WHITE },
];
const PAIRS = [
  ['iphone-terang', 'iphone-gelap'],
  ['iphone-kiri-terang', 'iphone-kiri-gelap'],
  ['iphone-kanan-terang', 'iphone-kanan-gelap'],
];

function fail(what, pixels) {
  console.error(`olah-bingkai: ${what}, misalnya ${pixels.slice(0, 10).map((f) => `(${f.x},${f.y}) rgba(${f.rgba.join(',')})`).join(' ')}`);
  process.exit(1);
}

function need(cmd) {
  try {
    execFileSync(cmd, ['-version'], { stdio: 'ignore' });
  } catch {
    console.error(`olah-bingkai: ${cmd} tidak ditemukan. Di Mac: brew install webp`);
    process.exit(1);
  }
}

const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
/** How much a pixel's green exceeds its red and blue. */
const excess = (d, p) => d[p + 1] - Math.max(d[p], d[p + 2]);
const isKey = (d, p, key) => Math.abs(d[p] - key[0]) < 8 && Math.abs(d[p + 1] - key[1]) < 8 && Math.abs(d[p + 2] - key[2]) < 8 && d[p + 3] > 250;
const inBox = (b, x, y, pad = 0) => x >= b.x0 - pad && x <= b.x1 + pad && y >= b.y0 - pad && y <= b.y1 + pad;

/** The key colour: the median of a 9x9 patch around (x, y). */
function keyColour(img, x, y) {
  const ch = [[], [], []];
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) for (let k = 0; k < 3; k++) ch[k].push(img.data[((y + dy) * img.width + x + dx) * 4 + k]);
  return ch.map((v) => v.sort((a, b) => a - b)[40]);
}

/** Flood fill (4-neighbours) from `seeds` through pixels where `admit(i)` holds; marks `mask` with 1. */
function flood(width, height, seeds, admit, mask) {
  const stack = new Int32Array(width * height);
  let top = 0;
  for (const s of seeds) {
    if (!mask[s] && admit(s)) {
      mask[s] = 1;
      stack[top++] = s;
    }
  }
  while (top > 0) {
    const i = stack[--top];
    const x = i % width;
    if (x > 0 && !mask[i - 1] && admit(i - 1)) ((mask[i - 1] = 1), (stack[top++] = i - 1));
    if (x < width - 1 && !mask[i + 1] && admit(i + 1)) ((mask[i + 1] = 1), (stack[top++] = i + 1));
    if (i >= width && !mask[i - width] && admit(i - width)) ((mask[i - width] = 1), (stack[top++] = i - width));
    if (i < width * (height - 1) && !mask[i + width] && admit(i + width)) ((mask[i + width] = 1), (stack[top++] = i + width));
  }
}

/** Connected components (4-neighbours) of `mask`, each with its box, pixels and size. */
function components(width, height, mask) {
  const label = new Int32Array(width * height);
  const out = [];
  const stack = new Int32Array(width * height);
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || label[s]) continue;
    const id = out.length + 1;
    const comp = { x0: Infinity, y0: Infinity, x1: -1, y1: -1, n: 0, pixels: [] };
    let top = 0;
    label[s] = id;
    stack[top++] = s;
    while (top > 0) {
      const i = stack[--top];
      const x = i % width;
      const y = (i - x) / width;
      comp.pixels.push(i);
      comp.n++;
      comp.x0 = Math.min(comp.x0, x);
      comp.x1 = Math.max(comp.x1, x);
      comp.y0 = Math.min(comp.y0, y);
      comp.y1 = Math.max(comp.y1, y);
      for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i >= width ? i - width : -1, i < width * (height - 1) ? i + width : -1]) {
        if (j >= 0 && mask[j] && !label[j]) {
          label[j] = id;
          stack[top++] = j;
        }
      }
    }
    out.push(comp);
  }
  return out;
}

/** Distance (in steps, up to `limit`) from the nearest `from` pixel, through `through` pixels; 255 beyond. */
function nearness(width, height, from, through, limit) {
  const dist = new Uint8Array(width * height).fill(255);
  let frontier = [];
  for (let i = 0; i < from.length; i++) {
    if (!from[i]) continue;
    const x = i % width;
    for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
      if (j >= 0 && j < from.length && through[j] && dist[j] === 255) {
        dist[j] = 1;
        frontier.push(j);
      }
    }
  }
  for (let d = 2; d <= limit && frontier.length; d++) {
    const next = [];
    for (const i of frontier) {
      const x = i % width;
      for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
        if (j >= 0 && j < from.length && through[j] && dist[j] === 255) {
          dist[j] = d;
          next.push(j);
        }
      }
    }
    frontier = next;
  }
  return dist;
}

/** Least squares line u = a·v + b through points [v, u]. */
function fitLine(points) {
  const n = points.length;
  let sv = 0;
  let su = 0;
  let svv = 0;
  let svu = 0;
  for (const [v, u] of points) {
    sv += v;
    su += u;
    svv += v * v;
    svu += v * u;
  }
  const a = (n * svu - sv * su) / (n * svv - sv * sv);
  return { a, b: (su - a * sv) / n };
}

/**
 * The screen's four outer corners: a line fitted to each straight edge (its
 * middle 70%, clear of the rounded corners), each edge point placed to a
 * fraction of a pixel by how much of that pixel the bezel covers, then the
 * lines intersected. Points are [x, y] in image pixels.
 */
function screenCorners(width, region, frame, s) {
  const covered = (i) => frame.data[i * 4 + 3] / 255;
  const left = [];
  const right = [];
  const top = [];
  const bottom = [];
  const ya = Math.round(s.y0 + (s.y1 - s.y0) * 0.15);
  const yb = Math.round(s.y0 + (s.y1 - s.y0) * 0.85);
  // The top and bottom edges are short next to the corners' curves: their middle half only.
  const xa = Math.round(s.x0 + (s.x1 - s.x0) * 0.25);
  const xb = Math.round(s.x0 + (s.x1 - s.x0) * 0.75);
  for (let y = ya; y <= yb; y++) {
    let x = s.x0 - 4;
    while (x < s.x1 && !region[y * width + x]) x++;
    left.push([y, x + covered(y * width + x)]);
    x = s.x1 + 4;
    while (x > s.x0 && !region[y * width + x]) x--;
    right.push([y, x + 1 - covered(y * width + x)]);
  }
  for (let x = xa; x <= xb; x++) {
    let y = s.y0 - 4;
    while (y < s.y1 && !region[y * width + x]) y++;
    top.push([x, y + covered(y * width + x)]);
    y = s.y1 + 4;
    while (y > s.y0 && !region[y * width + x]) y--;
    bottom.push([x, y + 1 - covered(y * width + x)]);
  }
  // Points off the edge (the MacBook's notch cuts into the top edge) go: the fit is trimmed to its best
  // 60% a few times, then every point within 1.5 px of that line makes the final fit.
  const robust = (pts) => {
    let line = fitLine(pts);
    let kept = pts;
    for (let round = 0; round < 6; round++) {
      const res = kept.map(([v, u]) => Math.abs(line.a * v + line.b - u)).sort((m, n) => m - n);
      const limit = res[Math.floor(res.length * 0.6)];
      kept = kept.filter(([v, u]) => Math.abs(line.a * v + line.b - u) <= limit);
      line = fitLine(kept);
    }
    const final = pts.filter(([v, u]) => Math.abs(line.a * v + line.b - u) < 1.5);
    return { ...fitLine(final), dropped: pts.length - final.length };
  };
  const L = robust(left);
  const R = robust(right);
  const T = robust(top);
  const B = robust(bottom);
  // x = V.a·y + V.b meets y = H.a·x + H.b where y = H.a·(V.a·y + V.b) + H.b.
  const meet = (V, H) => {
    const y = (H.a * V.b + H.b) / (1 - H.a * V.a);
    return [V.a * y + V.b, y];
  };
  return {
    points: { kiriAtas: meet(L, T), kananAtas: meet(R, T), kananBawah: meet(R, B), kiriBawah: meet(L, B) },
    top: T,
    dropped: L.dropped + R.dropped + T.dropped + B.dropped,
  };
}

/**
 * The corner's radius where it shows most: along the diagonal from the virtual corner, the distance t to
 * where the screen begins (half covered), as the circle through that point, R = t / (1 - 1/sqrt 2). Apple's
 * corners are a continuous curve, not a circle; this is the circle that matches it at 45 degrees.
 */
function cornerRadius(width, region, frame, corner) {
  const [cx, cy] = corner;
  // The virtual corner can lie outside the body (a phone's body is rounded too): only the screen counts.
  let prev = 1;
  for (let t = 0; t < 600; t += 0.25) {
    const i = Math.floor(cy + t) * width + Math.floor(cx + t);
    const covered = region[i] ? frame.data[i * 4 + 3] / 255 : 1;
    if (covered < 0.5) return (t - ((0.5 - covered) / Math.max(1e-6, prev - covered)) * 0.25) / (1 - Math.SQRT1_2);
    prev = covered;
  }
  return 0;
}

function processFrame(src) {
  const img = readPng(readFileSync(join(SRC, src.file)));
  const { width, height, data } = img;
  const N = width * height;
  // The key colour, from the middle of the green.
  let gx = 0;
  let gy = 0;
  let gn = 0;
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    if (data[p + 3] > 250 && excess(data, p) > 200) {
      gx += i % width;
      gy += Math.floor(i / width);
      gn++;
    }
  }
  if (gn === 0) throw new Error(`${src.file}: tidak ada layar hijau.`);
  const key = keyColour(img, Math.round(gx / gn), Math.round(gy / gn));
  // The screen's box: the pixels of the key colour.
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    if (!isKey(data, p, key)) continue;
    const x = i % width;
    const y = (i - x) / width;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const screen = { x0, y0, x1, y1, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  // Everything the green reaches, then whatever it encloses.
  const region = new Uint8Array(N);
  const seed = Math.round((y0 + y1) / 2) * width + Math.round((x0 + x1) / 2);
  flood(width, height, [seed], (j) => data[j * 4 + 3] > 0 && excess(data, j * 4) > 0, region);
  const outside = new Uint8Array(N);
  const border = [];
  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) border.push(y * width, y * width + width - 1);
  flood(width, height, border, (j) => region[j] === 0, outside);
  // The mask: the screen with every hole filled. `carries` marks the pixels in it that carry green (unmixed
  // below, wherever they are: the main green, the counters inside a glyph); `solid` the ones that carry none.
  const inside = new Uint8Array(N);
  const carries = new Uint8Array(N);
  const solid = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (outside[i]) continue;
    inside[i] = 1;
    if (data[i * 4 + 3] > 0 && excess(data, i * 4) > 0) carries[i] = 1;
    else solid[i] = 1;
  }
  // Export noise on the body's silhouette, outside the mask: a pixel almost fully transparent (alpha 1 to 4)
  // whose stored colour came out green from rounding (a premultiplied (0, 1, 0) read back at alpha 2 is
  // (0, 128, 0)). It keeps its alpha and takes the colour of the body next to it; nothing else outside the
  // mask is touched.
  const noise = [];
  for (let i = 0; i < N; i++) {
    const p = i * 4;
    if (!outside[i] || data[p + 3] === 0 || data[p + 3] > 4) continue;
    const nearKey = Math.abs(data[p] - key[0]) < NEAR_KEY && Math.abs(data[p + 1] - key[1]) < NEAR_KEY && Math.abs(data[p + 2] - key[2]) < NEAR_KEY;
    if (nearKey || excess(data, p) > GREEN_LEAD) noise.push(i);
  }
  // The solid parts (phones): the island (the largest near the top middle), the home indicator, the rest.
  const parts = components(width, height, solid).filter((c) => c.n >= 3);
  const cx = (x0 + x1) / 2;
  const band = src.tilt ? 0.12 : 0.06;
  let island = null;
  let home = null;
  const unknown = [];
  for (const c of parts) {
    const mid = (c.x0 + c.x1) / 2;
    if (src.kind !== 'phone') unknown.push(c);
    else if (c.y0 - y0 < screen.height * band && Math.abs(mid - cx) < screen.width * 0.12 && (!island || c.n > island.n)) island = c;
    else if (c.y1 > y1 - screen.height * (src.tilt ? 0.06 : 0.03) && Math.abs(mid - cx) < screen.width * 0.12) home = c;
  }
  // The screen's edge: pixels next to the bezel.
  const edge = nearness(width, height, outside, inside, EDGE);
  // The status bar: what lies in the strip down to the island's bottom, away from the island and the edge.
  // On a tilted frame the strip follows the screen's slanted top edge (measured after the alpha, below).
  let topAt = () => y0;
  let depth = island ? island.y1 - y0 + 3 : 0;
  const nearIsland = island ? nearness(width, height, (() => {
    const m = new Uint8Array(N);
    for (const i of island.pixels) m[i] = 1;
    return m;
  })(), inside, 6) : null;
  const inIsland = new Uint8Array(N);
  if (island) for (const i of island.pixels) inIsland[i] = 1;
  const homeZone = (x, y) => home !== null && inBox(home, x, y, 3);
  // The alpha: every pixel that carries green.
  const plain = { width, height, data: new Uint8Array(data) };
  for (const i of noise) {
    const x = i % width;
    const y = (i - x) / width;
    let best = Infinity;
    let from = -1;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const j = (y + dy) * width + x + dx;
        if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height || data[j * 4 + 3] < 128) continue;
        if (dx * dx + dy * dy < best) ((best = dx * dx + dy * dy), (from = j));
      }
    }
    for (let k = 0; k < 3; k++) plain.data[i * 4 + k] = from >= 0 ? data[from * 4 + k] : 0;
  }
  const shows = new Uint8Array(N);
  const alphaOf = new Float32Array(N);
  const kd = key[1] - key[0] + (key[1] - key[2]);
  const nearestSolid = (x, y) => {
    let best = Infinity;
    let F = null;
    for (let dy = -REACH; dy <= REACH; dy++) {
      for (let dx = -REACH; dx <= REACH; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = (ny * width + nx) * 4;
        if (data[q + 3] < 250 || excess(data, q) > 0) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 < best) {
          best = d2;
          F = [data[q], data[q + 1], data[q + 2]];
        }
      }
    }
    return F;
  };
  const fgOf = new Uint8Array(N * 3);
  for (let i = 0; i < N; i++) {
    if (!carries[i]) continue;
    const p = i * 4;
    const [r, g, b] = [data[p], data[p + 1], data[p + 2]];
    let a = 1 - (g - r + (g - b)) / kd;
    a = Math.min(1, Math.max(0, a));
    alphaOf[i] = a;
    if (a * 255 < 0.5) {
      plain.data.fill(0, p, p + 4);
      shows[i] = 255;
      continue;
    }
    const c = Math.min(255, Math.max(0, Math.round((r - (1 - a) * key[0] + (b - (1 - a) * key[2])) / (2 * a))));
    let F = [c, c, c];
    if (a < FAINT) {
      const x = i % width;
      const y = (i - x) / width;
      F = (src.kind === 'phone' && homeZone(x, y) ? src.glyph : null) ?? nearestSolid(x, y) ?? F;
    }
    fgOf.set(F, i * 3);
    plain.data[p] = F[0];
    plain.data[p + 1] = F[1];
    plain.data[p + 2] = F[2];
    plain.data[p + 3] = Math.round(a * 255);
    shows[i] = 255 - plain.data[p + 3];
  }
  const corners = screenCorners(width, region, plain, screen);
  if (src.tilt) {
    // The status strip follows the slanted top edge: y measured from it.
    const T = corners.top;
    topAt = (x) => T.a * x + T.b;
    depth = island ? Math.max(...island.pixels.map((i) => Math.floor(i / width) - topAt(i % width))) + 3 : 0;
  }
  // Zones, the version without the status bar, and the errors (every pixel that is not pure key).
  const bare = src.kind === 'phone' && !src.tilt ? { width, height, data: new Uint8Array(plain.data) } : null;
  const zones = { tepi: [], status: [], indikator: [], lain: [] };
  let notNeutral = 0;
  const statusBox = { kiri: { x0: Infinity, y0: Infinity, x1: -1, y1: -1 }, kanan: { x0: Infinity, y0: Infinity, x1: -1, y1: -1 } };
  for (let i = 0; i < N; i++) {
    if (!inside[i]) continue;
    const x = i % width;
    const y = (i - x) / width;
    const p = i * 4;
    const inStatus = src.kind === 'phone' && island !== null && !inIsland[i] && nearIsland[i] === 255 && edge[i] > EDGE && y - topAt(x) >= 0 && y - topAt(x) <= depth;
    if (inStatus && plain.data[p + 3] >= 128) {
      const side = x < (island.x0 + island.x1) / 2 ? statusBox.kiri : statusBox.kanan;
      side.x0 = Math.min(side.x0, x);
      side.x1 = Math.max(side.x1, x);
      side.y0 = Math.min(side.y0, y);
      side.y1 = Math.max(side.y1, y);
    }
    if (bare && inStatus) bare.data.fill(0, p, p + 4);
    if (!carries[i] || isKey(data, p, key)) continue;
    const a = alphaOf[i];
    let err = 0;
    for (let k = 0; k < 3; k++) err = Math.max(err, Math.abs(data[p + k] - (a * fgOf[i * 3 + k] + (1 - a) * key[k])));
    if (Math.abs(data[p] - data[p + 2]) > 6 && a > 0.05) notNeutral++;
    const zone = inStatus ? 'status' : src.kind === 'phone' && homeZone(x, y) ? 'indikator' : edge[i] <= EDGE ? 'tepi' : 'lain';
    zones[zone].push(err);
  }
  const stats = Object.fromEntries(
    Object.entries(zones)
      .filter(([, v]) => v.length)
      .map(([k, v]) => {
        const s = Float64Array.from(v).sort();
        return [k, { piksel: s.length, galatMaks: round(s[s.length - 1], 1), galatP99: round(s[Math.floor(s.length * 0.99)], 1) }];
      }),
  );
  // Where the rounded corner meets the straight edge (straight frames).
  let cornerRun = 0;
  if (!src.tilt) {
    let rows = 0;
    while (rows < 600 && !isKey(data, ((y0 + rows) * width + x0) * 4, key)) rows++;
    let cols = 0;
    while (cols < 600 && !isKey(data, (y0 * width + x0 + cols) * 4, key)) cols++;
    cornerRun = (rows + cols) / 2;
  }
  const radius = src.tilt ? 0 : cornerRadius(width, region, plain, corners.points.kiriAtas);
  for (const [name, out] of [['utuh', plain], ['tanpa status', bare]]) {
    if (!out) continue;
    const left = greenPixels(out, key);
    if (left.length) fail(`${src.file} (${name}): ${left.length} piksel hijau tersisa`, left);
  }
  const noiseAt = noise.map((i) => [i % width, Math.floor(i / width), data[i * 4 + 3]]);
  return { img, key, plain, bare, shows, screen, island, home, unknown, stats, notNeutral, corners: corners.points, dropped: corners.dropped, cornerRun, radius, statusBox, noiseAt };
}

/** The box of everything not fully transparent. */
function opaqueBox({ width, height, data }) {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  return { x0, y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

function crop({ width, data }, box) {
  const out = new Uint8Array(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    const from = ((box.y0 + y) * width + box.x0) * 4;
    out.set(data.subarray(from, from + box.width * 4), y * box.width * 4);
  }
  return { width: box.width, height: box.height, data: out };
}

function encode(img, name, { lossless = false } = {}) {
  const png = join(OUT, `${name}.png`);
  writeFileSync(png, writePng(img));
  const webp = join(OUT, `${name}.webp`);
  // Lossy colour with a lossless alpha: the screen's edge stays exact. The mask is lossless altogether.
  const opts = lossless ? ['-lossless', '-z', '9'] : ['-q', '90', '-alpha_q', '100', '-m', '6', '-sharp_yuv'];
  execFileSync('cwebp', ['-quiet', ...opts, '-mt', png, '-o', webp]);
  if (!lossless) {
    const left = greenPixels(img);
    if (left.length) fail(`${name}.png: ${left.length} piksel hijau tersisa`, left);
  }
  return { png: `${name}.png`, webp: `${name}.webp`, bytes: { png: readFileSync(png).length, webp: readFileSync(webp).length } };
}

/** The screen's mask (how much UI shows through each pixel) as a white image with that alpha. */
function maskImage(r, box) {
  const { width } = r.img;
  const out = new Uint8Array(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const v = r.shows[(box.y0 + y) * width + box.x0 + x];
      if (v === 0) continue;
      const q = (y * box.width + x) * 4;
      out[q] = 255;
      out[q + 1] = 255;
      out[q + 2] = 255;
      out[q + 3] = v;
    }
  }
  return { width: box.width, height: box.height, data: out };
}

/** A box in source pixels, relative to the screen's box, in points. */
const toPt = (b, s, k) => ({ x: round((b.x0 - s.x0) / k), y: round((b.y0 - s.y0) / k), width: round((b.x1 - b.x0 + 1) / k), height: round((b.y1 - b.y0 + 1) / k) });

/** Check sheet: each crop on each background, side by side, nearest-neighbour at `scale`. */
function sheet(name, frame, crops, backgrounds, scale = 4) {
  const tiles = crops.map((c) => ({ ...c, w: c.x1 - c.x0, h: c.y1 - c.y0 }));
  const pad = 6;
  const tw = Math.max(...tiles.map((t) => t.w)) * scale;
  const W = backgrounds.length * (tw + pad) + pad;
  const H = tiles.reduce((s, t) => s + t.h * scale + pad, pad);
  const out = { width: W, height: H, data: new Uint8Array(W * H * 4).fill(255) };
  let oy = pad;
  for (const t of tiles) {
    backgrounds.forEach((bg, bi) => {
      const ox = pad + bi * (tw + pad);
      for (let y = 0; y < t.h * scale; y++) {
        for (let x = 0; x < t.w * scale; x++) {
          const sx = t.x0 + Math.floor(x / scale);
          const sy = t.y0 + Math.floor(y / scale);
          const inImg = sx >= 0 && sy >= 0 && sx < frame.width && sy < frame.height;
          const p = (sy * frame.width + sx) * 4;
          const a = inImg ? frame.data[p + 3] / 255 : 0;
          const q = ((oy + y) * W + ox + x) * 4;
          for (let k = 0; k < 3; k++) out.data[q + k] = Math.round((inImg ? frame.data[p + k] : 0) * a + bg[k] * (1 - a));
          out.data[q + 3] = 255;
        }
      }
    });
    oy += t.h * scale + pad;
  }
  writeFileSync(join(CHECK, `${name}.png`), writePng(out));
}

need('cwebp');
mkdirSync(OUT, { recursive: true });
if (CHECK) mkdirSync(CHECK, { recursive: true });
const results = Object.fromEntries(SOURCES.map((s) => [s.id, processFrame(s)]));
const report = {};
const data = { sumber: 'Figma pemilik (docs/landing/bingkai), layar hijau', dibuat: 'apps/landing/scripts/olah-bingkai.mjs', bingkai: {} };

for (const src of SOURCES) {
  const r = results[src.id];
  const k = r.screen.width / src.pt.width;
  const box = opaqueBox(r.plain);
  const variants = r.bare ? [['utuh', r.plain], ['tanpa-status', r.bare]] : [['utuh', r.plain]];
  const files = {};
  for (const [name, frame] of variants) {
    const cropped = crop(frame, box);
    files[name] = src.widths.map((w) => {
      const target = w === 0 || w >= cropped.width ? cropped : resize(cropped, w, Math.round((cropped.height * w) / cropped.width));
      return { width: target.width, height: target.height, ...encode(target, `${src.id}${name === 'utuh' ? '' : `-${name}`}-${target.width}`) };
    });
  }
  if (src.tilt) files.mask = { width: box.width, height: box.height, ...encode(maskImage(r, box), `${src.id}-mask`, { lossless: true }) };
  const corners = Object.fromEntries(Object.entries(r.corners).map(([n, [x, y]]) => [n, [round(x - box.x0), round(y - box.y0)]]));
  const pct = Object.fromEntries(Object.entries(corners).map(([n, [x, y]]) => [n, [round((x / box.width) * 100, 4), round((y / box.height) * 100, 4)]]));
  const entry = { pt: src.pt, warnaKunci: r.key, gambar: { width: box.width, height: box.height }, sudutLayar: { px: corners, persen: pct }, berkas: files };
  report[src.id] = { warnaKunci: r.key, sudutLayar: corners, titikDibuang: r.dropped, galat: r.stats, pikselTakNetral: r.notNeutral, bagianTakDikenal: r.unknown.length, derauSiluet: r.noiseAt };
  if (!src.tilt) {
    const scr = { x: r.screen.x0 - box.x0, y: r.screen.y0 - box.y0, width: r.screen.width, height: r.screen.height };
    entry.pxPerPt = round(k, 4);
    entry.layar = { ...scr, persen: { left: round((scr.x / box.width) * 100, 4), top: round((scr.y / box.height) * 100, 4), width: round((scr.width / box.width) * 100, 4), height: round((scr.height / box.height) * 100, 4) } };
    // The corner: the radius of the closest circle, and how far along each edge the curve runs.
    entry.sudutLengkung = { radiusPt: round(r.radius / k, 1), panjangPt: round(r.cornerRun / k, 1) };
    report[src.id].layarPx = `${r.screen.width}x${r.screen.height}`;
    report[src.id].pxPerPt = `${round(k, 4)} (lebar), ${round(r.screen.height / src.pt.height, 4)} (tinggi)`;
  }
  if (src.kind === 'laptop') {
    // The notch: the bezel reaching down into the screen's top edge, away from the corners.
    const { width, data: d } = r.img;
    let nx0 = Infinity;
    let nx1 = -1;
    let ny1 = -1;
    const margin = Math.round(r.cornerRun * 2);
    for (let y = r.screen.y0; y < r.screen.y0 + Math.round(r.screen.height * 0.08); y++) {
      for (let x = r.screen.x0 + margin; x < r.screen.x1 - margin; x++) {
        if (excess(d, (y * width + x) * 4) > 0) continue;
        nx0 = Math.min(nx0, x);
        nx1 = Math.max(nx1, x);
        ny1 = Math.max(ny1, y);
      }
    }
    entry.notch = toPt({ x0: nx0, y0: r.screen.y0, x1: nx1, y1: ny1 }, r.screen, k);
    entry.safeArea = { top: round((ny1 - r.screen.y0 + 1) / k, 1) };
  } else if (!src.tilt) {
    const s = r.screen;
    const isl = toPt(r.island, s, k);
    const hom = r.home ? toPt(r.home, s, k) : null;
    entry.dynamicIsland = isl;
    // The status bar is the strip the island sits centred in: as much room under it as above it.
    entry.statusBar = { height: round(isl.y * 2 + isl.height, 1), jam: toPt(r.statusBox.kiri, s, k), ikon: toPt(r.statusBox.kanan, s, k) };
    entry.indikatorBeranda = hom;
    // The safe areas the UI keeps clear of: the status bar on top; the home indicator's strip (it centred) below.
    entry.safeArea = { top: entry.statusBar.height, bottom: hom ? round((src.pt.height - (hom.y + hom.height)) * 2 + hom.height, 1) : 0 };
  }
  data.bingkai[src.id] = entry;
}

// Each terang frame and its gelap twin must share their geometry, or a theme change would move the screen.
for (const [m, n] of PAIRS) {
  const a = data.bingkai[m];
  const b = data.bingkai[n];
  const off = Math.max(...Object.keys(a.sudutLayar.px).flatMap((c) => [0, 1].map((i) => Math.abs(a.sudutLayar.px[c][i] - b.sudutLayar.px[c][i]))));
  report[`${m}+${n}`] = { selisihSudutPx: round(off, 3) };
  if (JSON.stringify(a.gambar) !== JSON.stringify(b.gambar) || off > 0.5) {
    console.error(`olah-bingkai: ${m} dan ${n} tidak sama letaknya (selisih sudut ${off} px); tema yang berganti akan menggeser layar.`);
    process.exit(1);
  }
}
mkdirSync(resolve(DATA, '..'), { recursive: true });
writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n');

if (CHECK) {
  // White, light grey, black and the brand's orange (packages/ui/src/tokens/palette.css --brand-orange).
  const BACKGROUNDS = [[255, 255, 255], [228, 228, 231], [0, 0, 0], [255, 90, 42]];
  for (const src of SOURCES) {
    const r = results[src.id];
    const c = r.corners;
    // The four rounded corners (around the corner points) and the middle of the left edge.
    const around = ([x, y], right, down) => ({ x0: Math.round(x) - (right ? 96 : 24), y0: Math.round(y) - (down ? 88 : 16), x1: Math.round(x) + (right ? 24 : 96), y1: Math.round(y) + (down ? 16 : 88) });
    const crops = [around(c.kiriAtas, false, false), around(c.kananAtas, true, false), around(c.kiriBawah, false, true), around(c.kananBawah, true, true)];
    const mx = Math.round((c.kiriAtas[0] + c.kiriBawah[0]) / 2);
    const my = Math.round((c.kiriAtas[1] + c.kiriBawah[1]) / 2);
    crops.push({ x0: mx - 16, y0: my - 20, x1: mx + 40, y1: my + 20 });
    const own = [];
    if (src.kind === 'phone') {
      const isl = r.island;
      own.push({ x0: isl.x0 - 12, y0: isl.y0 - 10, x1: Math.min(isl.x1 + 12, isl.x0 + 110), y1: isl.y1 + 10 });
      const { kiri, kanan } = r.statusBox;
      // The time, then the battery (the right end of the icons), each on its own.
      if (kiri.x1 >= 0) own.push({ x0: kiri.x0 - 8, y0: kiri.y0 - 8, x1: kiri.x1 + 8, y1: kiri.y1 + 8 });
      if (kanan.x1 >= 0) own.push({ x0: Math.round(kanan.x1 - (kanan.x1 - kanan.x0) * 0.42) - 8, y0: kanan.y0 - 8, x1: kanan.x1 + 8, y1: kanan.y1 + 8 });
      if (kanan.x1 >= 0) own.push({ x0: kanan.x0 - 8, y0: kanan.y0 - 8, x1: kanan.x1 + 8, y1: kanan.y1 + 8 });
      if (r.home) own.push({ x0: r.home.x0 - 10, y0: r.home.y0 - 10, x1: r.home.x0 + 90, y1: r.home.y1 + 10 });
    } else {
      const n = data.bingkai.macbook.notch;
      const k = r.screen.width / src.pt.width;
      const nx = Math.round(r.screen.x0 + n.x * k);
      own.push({ x0: nx - 30, y0: r.screen.y0 - 10, x1: nx + 70, y1: Math.round(r.screen.y0 + (n.height + 8) * k) });
    }
    sheet(`tepi-${src.id}-4x`, r.plain, [...crops, ...own], BACKGROUNDS);
    if (src.kind === 'phone') sheet(`status-${src.id}-4x`, r.plain, own, BACKGROUNDS);
    if (r.bare) sheet(`status-${src.id}-tanpa-status-4x`, r.bare, own, BACKGROUNDS);
  }
}
console.log(JSON.stringify(report, null, 1));

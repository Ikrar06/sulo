#!/usr/bin/env node
// The brand files draw the face's lower edge on the flame's own lower edge.
// Two shapes smoothed along one line leave a hairline of flame under the
// face, plainest on a dark ground (the README's lockup, the tiles). The
// mascot engine already draws the flame with that run tucked in behind the
// face (packages/ui/src/mascot/shape.ts, BODY); this writes the same tucked
// flame into every brand file that carries the colour mascot, in place of
// the brand's own flame paths. What shows does not change: the face is the
// brand's, and the flame is cut exactly at the face's corners.
//
// A flame path is recognised by its numbers: the brand's back or front
// flame, moved and scaled as a whole (x' = s x + tx, y' = s y + ty). It is
// replaced by the tucked flame under the same move and scale.
// Usage (from apps/mobile): node scripts/tuck-brand-flame.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';

const root = new URL('../../..', import.meta.url).pathname;
// shape.ts is TypeScript: Vite (this app's own build tool) loads it, nothing is served.
const vite = await createServer({ configFile: false, root, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const { BODY, BRAND_BODY } = await vite.ssrLoadModule(join(root, 'packages/ui/src/mascot/shape.ts')).finally(() => vite.close());

// lockup-vertical.svg and tile-dark.svg are drawn another way (their flame already stops at the face's outline), so they are not
// here. Nor is mascot/mascot-base.svg: it is the source of shapes.generated.ts, which the engine tucks itself.
const FILES = [
  'apps/extension/assets/brand/flame-full.svg',
  'apps/extension/assets/brand/lockup-dark.svg',
  'apps/extension/assets/brand/lockup-light.svg',
  'apps/extension/assets/brand/tile-light.svg',
  'apps/mobile/android/app/src/main/res/drawable/ic_launcher_foreground.xml',
];

const points = (o) => [o.start, ...o.segs.flat()];
const numbers = (d) => (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);

/** The same closed outline, started at the end of segment k - 1 (a file may start the path at another anchor). */
function rotated(o, k) {
  if (k === 0) return o;
  return { start: o.segs[k - 1][2], segs: [...o.segs.slice(k), ...o.segs.slice(0, k)] };
}

/** The move and scale that turn `shape` into the path `d`, from whichever anchor `d` starts, or null when `d` is not that shape. */
function fitOf(d, shape) {
  for (let k = 0; k < shape.segs.length; k++) {
    const fit = fitAt(d, rotated(shape, k));
    if (fit) return fit;
  }
  return null;
}

function fitAt(d, shape) {
  const n = numbers(d);
  const p = points(shape);
  if (n.length !== p.length * 2) return null;
  const s = (n[2] - n[0]) / (p[1].x - p[0].x || 1);
  if (!(s > 0)) return null;
  const tx = n[0] - s * p[0].x;
  const ty = n[1] - s * p[0].y;
  const tolerance = Math.max(0.02, 0.002 * s * 512);
  for (let i = 0; i < p.length; i++) {
    if (Math.abs(n[2 * i] - (s * p[i].x + tx)) > tolerance || Math.abs(n[2 * i + 1] - (s * p[i].y + ty)) > tolerance) return null;
  }
  return { s, tx, ty };
}

const r = (v) => String(Math.round(v * 1000) / 1000);
function pathOf(o, { s, tx, ty }) {
  const p = (pt) => `${r(s * pt.x + tx)} ${r(s * pt.y + ty)}`;
  return `M${p(o.start)}${o.segs.map(([a, b, c]) => `C${p(a)} ${p(b)} ${p(c)}`).join('')}Z`;
}

const check = process.argv.includes('--check');
let stale = 0;
for (const file of FILES) {
  const path = join(root, file);
  const text = readFileSync(path, 'utf8');
  let replaced = 0;
  let already = 0;
  const next = text.replace(/(\s(?:d|android:pathData)=")([^"]+)(")/g, (all, open, d, close) => {
    for (const [brand, tucked] of [
      [BRAND_BODY.back, BODY.back],
      [BRAND_BODY.front, BODY.front],
    ]) {
      const fit = fitOf(d, brand);
      if (fit) {
        replaced += 1;
        return `${open}${pathOf(tucked, fit)}${close}`;
      }
      if (fitOf(d, tucked)) already += 1;
    }
    return all;
  });
  if (replaced + already !== 2) throw new Error(`tuck-brand-flame: ${file}: ${replaced + already} flame paths found, 2 expected`);
  if (replaced > 0) {
    stale += 1;
    if (!check) writeFileSync(path, next);
  }
  console.log(`${file}: ${replaced > 0 ? (check ? 'belum diselipkan' : 'diselipkan') : 'sudah diselipkan'}`);
}
if (check && stale > 0) {
  console.error(`tuck-brand-flame: ${stale} berkas belum diselipkan. Jalankan node apps/mobile/scripts/tuck-brand-flame.mjs`);
  process.exit(1);
}

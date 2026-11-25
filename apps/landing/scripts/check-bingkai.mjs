#!/usr/bin/env node
// CI: no green left in the processed device frames (src/assets/bingkai and
// the finished tilted pictures). Reads the PNGs (pure Node); with `dwebp` on
// the machine, the WebPs too. Fails with the coordinates of every bad pixel.
//   node apps/landing/scripts/check-bingkai.mjs [folder ...]
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readPng } from './lib/png.mjs';
import { greenPixels } from './lib/periksa-hijau.mjs';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
const dirs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const folders = dirs.length ? dirs.map((d) => resolve(d)) : [join(ROOT, 'apps/landing/src/assets/bingkai'), join(ROOT, 'apps/landing/src/assets/layar-miring')];
let dwebp = false;
try {
  execFileSync('dwebp', ['-version'], { stdio: 'ignore' });
  dwebp = true;
} catch {
  // PNGs only.
}
const tmp = mkdtempSync(join(tmpdir(), 'cek-bingkai-'));
let files = 0;
let bad = 0;
for (const dir of folders) {
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).sort()) {
    // Masks are white with an alpha; they never carry colour.
    if (name.includes('-mask')) continue;
    let img = null;
    if (name.endsWith('.png')) img = readPng(readFileSync(join(dir, name)));
    else if (name.endsWith('.webp') && dwebp) {
      const out = join(tmp, `${name}.png`);
      execFileSync('dwebp', ['-quiet', join(dir, name), '-o', out]);
      img = readPng(readFileSync(out));
    }
    if (!img) continue;
    files++;
    const found = greenPixels(img);
    if (found.length === 0) continue;
    bad += found.length;
    const shown = found.slice(0, 8).map((f) => `(${f.x},${f.y}) rgba(${f.rgba.join(',')})`).join(' ');
    console.error(`check-bingkai: ${name}: ${found.length} piksel hijau tersisa, misalnya ${shown}`);
  }
}
rmSync(tmp, { recursive: true, force: true });
if (bad > 0) process.exit(1);
console.log(`check-bingkai: ${files} berkas bersih${dwebp ? ' (PNG dan WebP)' : ' (PNG; dwebp tidak ada, WebP dilewati)'}.`);

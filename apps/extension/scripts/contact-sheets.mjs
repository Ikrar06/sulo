#!/usr/bin/env node
// Contact sheets of a folder of screenshots: several shots in one labelled
// image, so a set can be looked through without opening every file. A tall
// shot (a whole scrolled screen) is cut into screen-high pieces laid side by
// side, each as large as the others, so its text stays readable. Rendered
// by the same Chromium the screenshots come from; no other tool.
//
// Usage: node scripts/contact-sheets.mjs --in=<folder of png> --out=<folder>
//   [--name=<prefix>] [--tile=270] [--ratio=2.222] [--cols=5] [--rows=1]
//   [--only=<text in the file name>] [--first]  only the first piece of each shot
// --ratio is a piece's height over its width (800/360 for a phone, 800/1280 for the dashboard).
import { mkdirSync, openSync, readSync, closeSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const base = process.env.INIT_CWD ?? process.cwd();
const input = resolve(base, arg('in', '.'));
const out = resolve(base, arg('out', input));
const name = arg('name', basename(input));
const tile = Number(arg('tile', '270'));
const ratio = Number(arg('ratio', String(800 / 360)));
const cols = Number(arg('cols', '5'));
const rows = Number(arg('rows', '1'));
const only = arg('only', null);
const first = process.argv.includes('--first');
const pieceH = Math.round(tile * ratio);

/** Width and height from a PNG's header. */
function pngSize(file) {
  const fd = openSync(file, 'r');
  const buf = Buffer.alloc(24);
  readSync(fd, buf, 0, 24, 0);
  closeSync(fd);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const files = readdirSync(input).filter((f) => f.endsWith('.png') && (!only || f.includes(only))).sort();
const tiles = [];
for (const f of files) {
  const { width, height } = pngSize(join(input, f));
  const shownH = (height / width) * tile;
  // A last piece under a sixth of a screen is not worth a tile of its own.
  const pieces = first ? 1 : Math.max(1, Math.ceil(shownH / pieceH - 0.16));
  for (let i = 0; i < pieces; i++) tiles.push({ file: f, piece: i, pieces, h: Math.min(pieceH, Math.max(40, Math.round(shownH - i * pieceH))) });
}
mkdirSync(out, { recursive: true });
const perSheet = cols * rows;
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const page = await browser.newPage({ viewport: { width: cols * (tile + 12) + 12, height: 400 }, deviceScaleFactor: 1 });
const written = [];
for (let s = 0; s * perSheet < tiles.length; s++) {
  const part = tiles.slice(s * perSheet, (s + 1) * perSheet);
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:6px;background:#8b8b8b;font:11px/1.25 -apple-system,Helvetica,Arial,sans-serif;color:#fff}
    .g{display:grid;grid-template-columns:repeat(${cols},${tile}px);gap:10px 12px}
    .t{width:${tile}px}.l{height:26px;overflow:hidden;word-break:break-all;padding:0 1px}
    .i{width:${tile}px;background-repeat:no-repeat;background-color:#fff;outline:1px solid #555}
  </style><div class="g">${part
    .map((t) => `<div class="t"><div class="l">${t.file.replace(/\.png$/, '')}${t.pieces > 1 ? ` (${t.piece + 1}/${t.pieces})` : ''}</div><div class="i" style="height:${t.h}px;background-image:url('${pathToFileURL(join(input, t.file)).href}');background-size:${tile}px auto;background-position:0 -${t.piece * pieceH}px"></div></div>`)
    .join('')}</div>`;
  const tmp = join(out, `.sheet-${process.pid}.html`);
  writeFileSync(tmp, html);
  await page.goto(pathToFileURL(tmp).href);
  await page.waitForLoadState('load');
  const file = join(out, `${name}-${String(s + 1).padStart(2, '0')}.jpg`);
  await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 82 });
  rmSync(tmp);
  written.push(file);
}
await browser.close();
console.log(`contact-sheets: ${files.length} gambar, ${tiles.length} potong, ${written.length} lembar di ${out} (${name}-NN.jpg)`);

#!/usr/bin/env node
// A sheet of every icon the two apps share (packages/ui/src/icons.tsx and
// dashboard-icons.tsx): each at 16, 20 and 24 px on a light and a dark
// ground, with its name and how many files use it. For looking at stroke
// weight, optical size and odd ones out before and after a change.
// Usage: node scripts/icon-sheet.mjs --out=<file.png> [--json=<file.json>]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { MOBILE, ROOT } from './env.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const base = process.env.INIT_CWD ?? process.cwd();
const out = resolve(base, arg('out', 'ikon.png'));
const json = arg('json', null);
const FILES = ['icons.tsx', 'dashboard-icons.tsx'];
const USED_IN = ['apps/extension/components', 'apps/extension/entrypoints', 'apps/mobile/src', 'packages/ui/src'];

const server = await createServer({ configFile: join(MOBILE, 'vite.config.ts'), root: MOBILE, mode: 'web', logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
const icons = [];
try {
  for (const file of FILES) {
    const mod = await server.ssrLoadModule(`@sulo/ui/${file.replace(/\.tsx$/, '')}`);
    for (const [name, Comp] of Object.entries(mod)) {
      if (typeof Comp !== 'function' || !/Icon$/.test(name)) continue;
      const svg = renderToStaticMarkup(createElement(Comp, {}));
      // Files that name it, other than the two icon files themselves.
      let uses = 0;
      try {
        uses = execFileSync('grep', ['-rlw', name, ...USED_IN.map((d) => join(ROOT, d)), '--include=*.tsx'], { encoding: 'utf8' }).split('\n').filter((f) => f && !FILES.some((x) => f.endsWith(`/${x}`))).length;
      } catch {
        uses = 0;
      }
      const stroke = /stroke-width="([^"]+)"/.exec(svg)?.[1] ?? '-';
      const filled = /fill="currentColor"/.test(svg);
      icons.push({ name, file, uses, stroke, filled, svg });
    }
  }
} finally {
  await server.close();
}

const at = (svg, px) => svg.replace(/width="24"/, `width="${px}"`).replace(/height="24"/, `height="${px}"`);
const tile = (i) => `<div class="t"><div class="n">${i.name.replace(/Icon$/, '')}<span>${i.file === 'icons.tsx' ? 'umum' : 'dashboard'} · ${i.uses} berkas · garis ${i.stroke}${i.filled ? ' · isi' : ''}</span></div>
  <div class="r l">${[16, 20, 24].map((p) => at(i.svg, p)).join('')}<em>teks 14</em></div><div class="r d">${[16, 20, 24].map((p) => at(i.svg, p)).join('')}<em>teks 14</em></div></div>`;
const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;padding:10px;background:#8b8b8b;font:11px/1.3 -apple-system,Helvetica,Arial,sans-serif}
  .g{display:grid;grid-template-columns:repeat(6,236px);gap:8px}
  .t{background:#fff;border-radius:6px;overflow:hidden}.n{padding:5px 8px;font-weight:600;color:#111}.n span{display:block;font-weight:400;color:#666;font-size:10px}
  .r{display:flex;align-items:center;gap:12px;padding:8px}.r em{font:14px/1 -apple-system,Helvetica,Arial,sans-serif;font-style:normal;margin-left:auto}
  .l{background:#f4f4f6;color:#0d0d12}.d{background:#141417;color:#ececf1}
</style><div class="g">${icons.map(tile).join('')}</div>`;
mkdirSync(dirname(out), { recursive: true });
const tmp = join(dirname(out), `.icon-sheet-${process.pid}.html`);
writeFileSync(tmp, html);
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const page = await browser.newPage({ viewport: { width: 6 * 244 + 20, height: 400 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(tmp).href);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
rmSync(tmp);
if (json) writeFileSync(resolve(base, json), `${JSON.stringify(icons.map(({ svg, ...rest }) => rest), null, 1)}\n`);
console.log(`icon-sheet: ${icons.length} ikon di ${out}`);
const dup = icons.filter((i, n) => icons.findIndex((j) => j.name === i.name) !== n).map((i) => i.name);
if (dup.length > 0) console.log(`Nama yang ada di dua berkas: ${[...new Set(dup)].join(', ')}`);
const unused = icons.filter((i) => i.uses === 0).map((i) => i.name);
if (unused.length > 0) console.log(`Tidak dipakai: ${[...new Set(unused)].join(', ')}`);

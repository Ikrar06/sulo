#!/usr/bin/env node
// After the build: each page's stylesheets go into the page itself (brief 9.6,
// the first paint on a phone). Five render-blocking requests, one of them the
// apps' 115 KB stylesheet, cost a phone on a slow 4G network about two
// seconds before anything showed (Lighthouse, 24 Nov 2026). Inlined, the
// first paint needs the page alone. The device screens (/layar/) keep the
// shared files: several of them open in one page and share one cached copy.
// The CSP hashes each inlined style (scripts/keamanan.mjs runs after this).
//
//   node apps/landing/scripts/sebaris.mjs [--dist=<folder>]
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const DIST = resolve(arg('dist', new URL('../dist', import.meta.url).pathname));

function halaman(dir) {
  return readdirSync(dir).flatMap((nama) => {
    const p = join(dir, nama);
    if (statSync(p).isDirectory()) return relative(DIST, p).split('/')[0] === 'layar' ? [] : halaman(p);
    return nama.endsWith('.html') ? [p] : [];
  });
}

let jumlah = 0;
let bita = 0;
for (const file of halaman(DIST)) {
  const html = readFileSync(file, 'utf8');
  const baru = html.replace(/<link rel="stylesheet" href="(\/_astro\/[^"]+\.css)"\s*\/?>/g, (_, href) => {
    const css = readFileSync(join(DIST, href), 'utf8');
    if (/<\/style/i.test(css)) throw new Error(`sebaris: ${href} memuat </style>`);
    jumlah++;
    bita += css.length;
    return `<style>${css}</style>`;
  });
  if (baru !== html) writeFileSync(file, baru);
}
console.log(`sebaris: ${jumlah} stylesheet masuk ke halaman (${Math.round(bita / 1024)} KB, sebelum dikompres).`);

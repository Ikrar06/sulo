#!/usr/bin/env node
// CI checks on the built site (brief 9.7):
// - Outside assets: no page, stylesheet or script loads anything from another
//   address. Plain links to other sites are fine (they load nothing until
//   clicked); so are the absolute addresses search engines read (canonical,
//   hreflang, the social card).
// - Internal links: every link to this site's own pages leads to a page that
//   exists, and every #anchor to an element that exists there.
//
//   node apps/landing/scripts/check-aset.mjs [--dist=<folder>]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const DIST = resolve(arg('dist', new URL('../dist', import.meta.url).pathname));
const semua = (dir, akhir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? semua(join(dir, n), akhir) : akhir.some((a) => n.endsWith(a)) ? [join(dir, n)] : []));
const luar = (url) => /^(https?:)?\/\//i.test(url);
const masalah = [];

// Outside assets in pages.
const MUAT = [
  [/<script[^>]*\ssrc="([^"]+)"/gi, 'script'],
  [/<link[^>]*\srel="(?:stylesheet|preload|modulepreload|icon|apple-touch-icon|manifest)"[^>]*\shref="([^"]+)"/gi, 'link'],
  [/<link[^>]*\shref="([^"]+)"[^>]*\srel="(?:stylesheet|preload|modulepreload|icon|apple-touch-icon|manifest)"/gi, 'link'],
  [/<(?:img|iframe|video|audio|embed|track)[^>]*\ssrc="([^"]+)"/gi, 'src'],
  [/\ssrcset="([^"]+)"/gi, 'srcset'],
  [/<object[^>]*\sdata="([^"]+)"/gi, 'object'],
];
const halaman = semua(DIST, ['.html']);
const id = new Map();
for (const file of halaman) {
  const html = readFileSync(file, 'utf8');
  const nama = relative(DIST, file);
  for (const [pola, jenis] of MUAT) {
    for (const m of html.matchAll(pola)) {
      const nilai = jenis === 'srcset' ? m[1].split(',').map((s) => s.trim().split(/\s+/)[0]) : [m[1]];
      for (const u of nilai) if (luar(u)) masalah.push(`${nama}: ${jenis} dari luar: ${u}`);
    }
  }
  for (const m of html.matchAll(/style="[^"]*url\(\s*['"]?((?:https?:)?\/\/[^'")]+)/gi)) masalah.push(`${nama}: url() dari luar di atribut style: ${m[1]}`);
  id.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
}
// Outside assets in stylesheets and scripts.
for (const file of semua(DIST, ['.css'])) {
  const css = readFileSync(file, 'utf8');
  for (const m of css.matchAll(/url\(\s*['"]?((?:https?:)?\/\/[^'")]+)/gi)) masalah.push(`${relative(DIST, file)}: url() dari luar: ${m[1]}`);
  for (const m of css.matchAll(/@import\s+(?:url\()?['"]?((?:https?:)?\/\/[^'")\s]+)/gi)) masalah.push(`${relative(DIST, file)}: @import dari luar: ${m[1]}`);
}
for (const file of semua(DIST, ['.js', '.mjs'])) {
  const js = readFileSync(file, 'utf8');
  // A bundle may hold an address as text (a link it shows); what it must never do is fetch or import one.
  for (const m of js.matchAll(/(?:fetch|import|importScripts|new\s+(?:Worker|WebSocket|EventSource))\s*\(\s*['"`]((?:https?:|wss?:)?\/\/[^'"`]+)/gi)) masalah.push(`${relative(DIST, file)}: memuat dari luar: ${m[1]}`);
  for (const m of js.matchAll(/\.src\s*=\s*['"`]((?:https?:)?\/\/[^'"`]+)/gi)) masalah.push(`${relative(DIST, file)}: src dari luar: ${m[1]}`);
}

// Internal links and anchors.
const berkasUntuk = (path) => {
  const bersih = decodeURIComponent(path.split('#')[0].split('?')[0]);
  const kandidat = bersih.endsWith('/') ? join(DIST, bersih, 'index.html') : join(DIST, bersih);
  if (existsSync(kandidat) && statSync(kandidat).isFile()) return kandidat;
  const dir = join(DIST, bersih, 'index.html');
  return existsSync(dir) ? dir : null;
};
for (const file of halaman) {
  if (relative(DIST, file).startsWith('layar/')) continue;
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/<a[^>]*\shref="([^"]+)"/gi)) {
    const href = m[1];
    if (luar(href) || /^(mailto:|tel:|data:|javascript:)/i.test(href)) continue;
    const [path, jangkar] = href.split('#');
    const target = path === '' ? file : path.startsWith('/') ? berkasUntuk(path) : berkasUntuk(join(dirname(relative(DIST, file)), path));
    if (!target) {
      masalah.push(`${relative(DIST, file)}: tautan ke halaman yang tidak ada: ${href}`);
      continue;
    }
    if (jangkar && !id.get(target)?.has(jangkar)) masalah.push(`${relative(DIST, file)}: jangkar #${jangkar} tidak ada di ${relative(DIST, target)}`);
  }
}

const unik = [...new Set(masalah)];
if (unik.length) {
  console.error(`check:aset: ${unik.length} masalah\n- ${unik.slice(0, 40).join('\n- ')}`);
  process.exit(1);
}
console.log(`check:aset: ${halaman.length} halaman tanpa aset dari luar, semua tautan internal dan jangkar ada.`);

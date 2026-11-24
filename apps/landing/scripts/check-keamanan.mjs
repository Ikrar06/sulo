#!/usr/bin/env node
// CI check of the security headers (brief 9.4) on the built site: every page
// has its CSP meta tag first after the charset, every inline script that runs
// is hashed in it, no policy allows eval, and dist/_headers carries the full
// set (the device screens framed by this site only, every other page by no
// one; no referrer; no sniffing; unused features off).
//
//   node apps/landing/scripts/check-keamanan.mjs [--dist=<folder>]
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { BATAS_BARIS_HEADERS, hashSkripSebaris } from './lib/aturan-keamanan.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const DIST = resolve(arg('dist', new URL('../dist', import.meta.url).pathname));
const semuaHtml = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? semuaHtml(join(dir, n)) : n.endsWith('.html') ? [join(dir, n)] : []));

const masalah = [];
for (const file of semuaHtml(DIST)) {
  const html = readFileSync(file, 'utf8');
  const nama = relative(DIST, file);
  const m = /<meta charset="utf-8"\s*\/?><meta http-equiv="Content-Security-Policy" content="([^"]+)">/i.exec(html);
  if (!m) {
    masalah.push(`${nama}: meta CSP tidak ada tepat setelah charset`);
    continue;
  }
  const csp = m[1];
  if (/unsafe-eval/.test(csp)) masalah.push(`${nama}: CSP mengizinkan unsafe-eval`);
  // style-src-elem 'self': a <style> element in the page (in an SVG too) would be blocked.
  if (/<style[\s>]/i.test(html)) masalah.push(`${nama}: ada elemen <style> sebaris (diblokir style-src-elem 'self')`);
  if (!csp.startsWith("default-src 'self'")) masalah.push(`${nama}: CSP tidak diawali default-src 'self'`);
  for (const h of hashSkripSebaris(html, (isi) => createHash('sha256').update(isi).digest('base64'))) {
    if (!csp.includes(`'sha256-${h}'`)) masalah.push(`${nama}: skrip sebaris tanpa hash di CSP (sha256-${h})`);
  }
}
const pathHeaders = join(DIST, '_headers');
if (!existsSync(pathHeaders)) masalah.push('_headers tidak ada');
else {
  const h = readFileSync(pathHeaders, 'utf8');
  h.split('\n').forEach((b, i) => {
    if (b.length > BATAS_BARIS_HEADERS) masalah.push(`_headers baris ${i + 1}: ${b.length} karakter, Cloudflare Pages hanya membaca ${BATAS_BARIS_HEADERS}`);
  });
  const blok = (pola) => h.split(/\n(?=\/)/).find((b) => b.startsWith(pola)) ?? '';
  const semuaBlok = blok('/*\n');
  const layar = blok('/layar/*\n');
  for (const [syarat, ada] of [
    ["frame-ancestors 'none' untuk semua halaman", semuaBlok.includes("frame-ancestors 'none'")],
    ['X-Frame-Options: DENY', semuaBlok.includes('X-Frame-Options: DENY')],
    ['Referrer-Policy: no-referrer', semuaBlok.includes('Referrer-Policy: no-referrer')],
    ['X-Content-Type-Options: nosniff', semuaBlok.includes('X-Content-Type-Options: nosniff')],
    ['Permissions-Policy', semuaBlok.includes('Permissions-Policy: ')],
    ["frame-ancestors 'self' untuk /layar/*", layar.includes("frame-ancestors 'self'") && layar.includes('! Content-Security-Policy')],
  ]) if (!ada) masalah.push(`_headers: ${syarat} tidak ada`);
}
if (masalah.length) {
  console.error(`check:keamanan: ${masalah.length} masalah\n- ${masalah.join('\n- ')}`);
  process.exit(1);
}
console.log(`check:keamanan: ${semuaHtml(DIST).length} halaman dan _headers sesuai aturan.`);

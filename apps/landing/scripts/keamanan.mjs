#!/usr/bin/env node
// The security headers (brief 9.4), written after the build: every inline
// script's and style's SHA-256 is counted per page, and each page gets its
// full CSP in a meta tag first in its head (it works on any host). The host
// adds what a meta tag cannot say: who may frame the page, and the other
// headers. Vercel, where the site is deployed, reads them from
// apps/landing/vercel.json. For Cloudflare Pages, --headers also writes
// dist/_headers with the same rules. Both come from one table
// (lib/aturan-keamanan.mjs).
//
// default-src 'self', scripts from this site plus the hashed inline ones and
// never 'unsafe-eval'; <style> elements from this site only (style-src-elem),
// style attributes allowed (style-src, which style-src-attr falls back to:
// the apps' components set sizes and positions in them); images from here or
// data:; connect-src 'self' (the iPhone interest button, when on). Every
// address is this site's own, so there is nothing to upgrade. The device
// screens (/layar/) may be framed by this site only; every other page by no
// one. No referrer, no sniffing, every unused browser feature off.
//
//   node apps/landing/scripts/keamanan.mjs [--dist=<folder>] [--headers]
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { CSP_DASAR, cspDengan, hashGayaSebaris, hashSkripSebaris, headersCloudflare } from './lib/aturan-keamanan.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const DIST = resolve(arg('dist', new URL('../dist', import.meta.url).pathname));
const DENGAN_HEADERS = process.argv.includes('--headers');

function semuaHtml(dir) {
  return readdirSync(dir).flatMap((nama) => {
    const p = join(dir, nama);
    return statSync(p).isDirectory() ? semuaHtml(p) : nama.endsWith('.html') ? [p] : [];
  });
}

const sha = (isi) => createHash('sha256').update(isi).digest('base64');
let hashSkrip = 0;
let hashGaya = 0;
for (const file of semuaHtml(DIST)) {
  let html = readFileSync(file, 'utf8');
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
  const skrip = hashSkripSebaris(html, sha);
  const gaya = hashGayaSebaris(html, sha);
  hashSkrip += skrip.length;
  hashGaya += gaya.length;
  const meta = `<meta http-equiv="Content-Security-Policy" content="${cspDengan(skrip, gaya)}">`;
  // First thing after the charset: it must come before any script it governs.
  html = html.replace(/(<meta charset="utf-8"\s*\/?>)/i, `$1${meta}`);
  if (!html.includes(meta)) throw new Error(`keamanan: tidak ada <meta charset> di ${relative(DIST, file)}`);
  writeFileSync(file, html);
}

// dist/_headers is Cloudflare Pages' file and is written only when asked. Vercel reads vercel.json, and a
// _headers file in its output was served to anyone who asked for /_headers/ (found on the live site, 25 Nov 2026).
const pathHeaders = join(DIST, '_headers');
if (DENGAN_HEADERS) writeFileSync(pathHeaders, headersCloudflare());
else rmSync(pathHeaders, { force: true });
console.log(`keamanan: CSP di ${semuaHtml(DIST).length} halaman (${hashSkrip} hash skrip, ${hashGaya} hash gaya)${DENGAN_HEADERS ? ', _headers ditulis' : ''}. ${CSP_DASAR.length} aturan dasar.`);

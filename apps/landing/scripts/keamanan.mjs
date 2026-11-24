#!/usr/bin/env node
// The security headers (brief 9.4), written after the build: every inline
// script's and style's SHA-256 is counted per page, and each page gets its
// full CSP in a meta tag first in its head (it works on any host). The host's
// dist/_headers (Cloudflare Pages) adds what a meta tag cannot say: who may
// frame the page, and the other headers.
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
//   node apps/landing/scripts/keamanan.mjs [--dist=<folder>]
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { CSP_DASAR, cspDengan, cspHeader, hashGayaSebaris, hashSkripSebaris } from './lib/aturan-keamanan.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const DIST = resolve(arg('dist', new URL('../dist', import.meta.url).pathname));

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

const UMUM = [
  'Referrer-Policy: no-referrer',
  'X-Content-Type-Options: nosniff',
  'Cross-Origin-Opener-Policy: same-origin',
  'Permissions-Policy: accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), serial=(), usb=(), browsing-topics=()',
];
const headers = [
  '# Written by apps/landing/scripts/keamanan.mjs after the build. Cloudflare Pages reads it; brief 9.4.',
  '/*',
  `  Content-Security-Policy: ${cspHeader("'none'")}`,
  '  X-Frame-Options: DENY',
  ...UMUM.map((h) => `  ${h}`),
  '',
  '# The device screens are framed by this site\'s own pages, and by no one else.',
  '/layar/*',
  '  ! Content-Security-Policy',
  '  ! X-Frame-Options',
  `  Content-Security-Policy: ${cspHeader("'self'")}`,
  '  X-Frame-Options: SAMEORIGIN',
  '',
  '/_astro/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  '',
];
writeFileSync(join(DIST, '_headers'), headers.join('\n'));
console.log(`keamanan: CSP di ${semuaHtml(DIST).length} halaman (${hashSkrip} hash skrip, ${hashGaya} hash gaya), _headers ditulis. ${CSP_DASAR.length} aturan dasar.`);

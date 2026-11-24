// The Content Security Policy's rules (brief 9.4), shared by the writer
// (scripts/keamanan.mjs) and the CI check (scripts/check-keamanan.mjs), and
// tested on their own (tests/keamanan.test.ts).
//
// Each page carries its full policy in a meta tag, with the hashes of its own
// inline scripts and styles (the pages' styles are inlined, scripts/sebaris.mjs).
// The host's header adds what a meta tag cannot say (frame-ancestors) and the
// rules that need no hashes; both policies apply together.
export const CSP_DASAR = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

/** Cloudflare Pages reads at most this many characters on one line of _headers. */
export const BATAS_BARIS_HEADERS = 2000;

/** The header's policy: who may frame the page, and the rules that need no hashes. */
export const cspHeader = (bingkai) => `frame-ancestors ${bingkai}; base-uri 'self'; object-src 'none'; form-action 'self'`;

/** What the host sends with every answer: no referrer, no sniffing, every unused browser feature off. */
export const HEADER_UMUM = [
  ['Referrer-Policy', 'no-referrer'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Cross-Origin-Opener-Policy', 'same-origin'],
  ['Permissions-Policy', 'accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), serial=(), usb=(), browsing-topics=()'],
];

/** Who may frame a page: no one, except the device screens (/layar/), which this site's own pages frame. */
export const headerBingkai = (olehSitusIni) => [
  ['Content-Security-Policy', cspHeader(olehSitusIni ? "'self'" : "'none'")],
  ['X-Frame-Options', olehSitusIni ? 'SAMEORIGIN' : 'DENY'],
];

/** Astro's files carry a hash of their content in their name: one name never changes. */
export const CACHE_ASET = 'public, max-age=31536000, immutable';

/**
 * The same headers as Vercel reads them: the "headers" of apps/landing/vercel.json, which a test holds to
 * this (Vercel reads no _headers file). The two framing rules never match one path together (every path but
 * /layar/, then /layar/ alone), so no header is ever sent with two values.
 */
export function headersVercel() {
  const daftar = (pasangan) => pasangan.map(([key, value]) => ({ key, value }));
  return [
    { source: '/(.*)', headers: daftar(HEADER_UMUM) },
    { source: '/:path((?!layar/).*)', headers: daftar(headerBingkai(false)) },
    { source: '/layar/(.*)', headers: daftar(headerBingkai(true)) },
    { source: '/_astro/(.*)', headers: daftar([['Cache-Control', CACHE_ASET]]) },
  ];
}

/**
 * A page's policy for its inline scripts and styles (base64 SHA-256 each). Style attributes stay allowed
 * (style-src, which style-src-attr falls back to: the apps' components set sizes in them); style elements
 * only from this site or with their hash.
 */
export function cspDengan(hashSkrip, hashGaya = []) {
  const skrip = ["script-src 'self'", ...hashSkrip.map((h) => `'sha256-${h}'`)].join(' ');
  const gaya = ["style-src-elem 'self'", ...hashGaya.map((h) => `'sha256-${h}'`)].join(' ');
  return [CSP_DASAR[0], skrip, CSP_DASAR[1], gaya, ...CSP_DASAR.slice(2)].join('; ');
}

/** The inline scripts that run (not JSON data blocks), hashed with the given function. */
export function hashSkripSebaris(html, hashFn) {
  const hasil = [];
  for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    const atribut = m[1] ?? '';
    if (/\ssrc=/i.test(atribut)) continue;
    const tipe = /\stype="([^"]+)"/i.exec(atribut)?.[1];
    if (tipe && !/^(module|text\/javascript|application\/javascript)$/i.test(tipe)) continue;
    if (m[2].length === 0) continue;
    hasil.push(hashFn(m[2]));
  }
  return [...new Set(hasil)];
}

/** The inline style elements, hashed with the given function. */
export function hashGayaSebaris(html, hashFn) {
  return [...new Set([...html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)].map((m) => hashFn(m[1])))];
}

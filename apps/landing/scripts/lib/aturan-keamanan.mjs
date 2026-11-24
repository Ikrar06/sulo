// The Content Security Policy's rules (brief 9.4), shared by the writer
// (scripts/keamanan.mjs) and the CI check (scripts/check-keamanan.mjs), and
// tested on their own (tests/keamanan.test.ts).
export const CSP_DASAR = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "style-src-elem 'self'",
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

/** The policy for a page whose inline scripts have these hashes (base64 SHA-256). */
export function cspDengan(hash) {
  const skrip = ["script-src 'self'", ...hash.map((h) => `'sha256-${h}'`)].join(' ');
  return [CSP_DASAR[0], skrip, ...CSP_DASAR.slice(1)].join('; ');
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

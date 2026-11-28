// The Content Security Policy's rules: what is hashed, and what the policy never allows; and the host's
// headers as Vercel reads them (vercel.json), held to the same rules.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATAS_BARIS_HEADERS, cspDengan, cspHeader, hashGayaSebaris, hashSkripSebaris, headersCloudflare, headersVercel } from '../scripts/lib/aturan-keamanan.mjs';

const sha = (isi: string) => createHash('sha256').update(isi).digest('base64');

describe('header untuk Cloudflare Pages (_headers, ditulis hanya saat diminta)', () => {
  const teks = headersCloudflare() as string;
  const blok = (awal: string) => teks.split(/\n(?=\/)/).find((b) => b.startsWith(awal)) ?? '';
  it('halaman biasa tidak boleh dibingkai siapa pun, tanpa referrer dan tanpa sniffing', () => {
    const semua = blok('/*\n');
    expect(semua).toContain(`Content-Security-Policy: ${cspHeader("'none'")}`);
    expect(semua).toContain('X-Frame-Options: DENY');
    expect(semua).toContain('Referrer-Policy: no-referrer');
    expect(semua).toContain('X-Content-Type-Options: nosniff');
    expect(semua).toContain('Permissions-Policy: ');
  });
  it('layar perangkat melepas aturan umum dulu, lalu hanya boleh dibingkai situs ini', () => {
    const layar = blok('/layar/*\n');
    expect(layar).toContain('! Content-Security-Policy');
    expect(layar).toContain('! X-Frame-Options');
    expect(layar).toContain(`Content-Security-Policy: ${cspHeader("'self'")}`);
    expect(layar).toContain('X-Frame-Options: SAMEORIGIN');
  });
  it('tiap baris muat di batas yang dibaca Cloudflare Pages', () => {
    for (const baris of teks.split('\n')) expect(baris.length).toBeLessThanOrEqual(BATAS_BARIS_HEADERS);
  });
});

describe('header di Vercel (vercel.json)', () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  // A "source" as a pattern, for the three shapes used here: a wildcard, a folder, everything but a folder.
  const cocok = (source: string, path: string) => new RegExp(`^${source.replace('/:path(', '/(')}$`).test(path);
  const nilai = (path: string, kunci: string) =>
    headersVercel()
      .filter((aturan) => cocok(aturan.source, path))
      .flatMap((aturan) => aturan.headers.filter((h) => h.key === kunci).map((h) => h.value));

  it('berkasnya memuat persis aturan yang sama', () => {
    expect(vercel.headers).toEqual(headersVercel());
  });
  it('alamat berakhiran garis miring seperti halaman Astro, dan hasil build di dist', () => {
    expect(vercel.trailingSlash).toBe(true);
    expect(vercel.outputDirectory).toBe('dist');
  });
  it('perintah install dan build muat di batas 256 karakter Vercel', () => {
    for (const perintah of [vercel.installCommand, vercel.buildCommand]) expect(perintah.length).toBeLessThanOrEqual(256);
  });
  it('halaman biasa tidak boleh dibingkai siapa pun', () => {
    for (const path of ['/', '/en/', '/pasang/android/', '/404.html', '/layarku/']) {
      expect(nilai(path, 'X-Frame-Options')).toEqual(['DENY']);
      expect(nilai(path, 'Content-Security-Policy')).toEqual([cspHeader("'none'")]);
    }
  });
  it('layar perangkat hanya boleh dibingkai situs ini', () => {
    for (const path of ['/layar/id/hp/auto/', '/layar/en/laptop/gelap/']) {
      expect(nilai(path, 'X-Frame-Options')).toEqual(['SAMEORIGIN']);
      expect(nilai(path, 'Content-Security-Policy')).toEqual([cspHeader("'self'")]);
    }
  });
  it('setiap jawaban tanpa referrer dan tanpa sniffing; berkas ber-hash disimpan lama', () => {
    for (const path of ['/', '/layar/id/hp/auto/', '/_astro/a.css']) {
      expect(nilai(path, 'Referrer-Policy')).toEqual(['no-referrer']);
      expect(nilai(path, 'X-Content-Type-Options')).toEqual(['nosniff']);
    }
    expect(nilai('/_astro/a.css', 'Cache-Control')).toEqual(['public, max-age=31536000, immutable']);
    expect(nilai('/', 'Cache-Control')).toEqual([]);
  });
});

describe('CSP halaman', () => {
  it('mulai dari default-src self dan tidak pernah mengizinkan eval', () => {
    const csp = cspDengan([sha('a')]);
    expect(csp.startsWith("default-src 'self'")).toBe(true);
    expect(csp).not.toMatch(/unsafe-eval/);
    expect(csp).toContain(`script-src 'self' 'sha256-${sha('a')}'`);
  });
  it('elemen gaya hanya dari situs ini atau dengan hash; atribut gaya tetap boleh', () => {
    const csp = cspDengan([], [sha('b')]);
    expect(csp).toContain(`style-src-elem 'self' 'sha256-${sha('b')}'`);
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toMatch(/style-src-elem[^;]*unsafe-inline/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
  it('tidak ada alamat lain di kebijakan', () => {
    expect(cspDengan([sha('a')], [sha('b')])).not.toMatch(/https?:/);
  });
  // Vercel Web Analytics' script (tata/Dasar.astro, the live site only) sends each visit to /_vercel/insights/view
  // on this site, with fetch. With connect-src 'none' every visit was refused and none was counted (28 Nov 2026).
  it('kunjungan bisa dikirim ke situs ini sendiri, dan hanya ke situs ini', () => {
    expect(cspDengan([sha('a')])).toContain("connect-src 'self'");
    expect(cspDengan([sha('a')])).not.toMatch(/connect-src[^;]*(https?:|\*)/);
  });
});

describe('CSP header', () => {
  it('menyebut siapa yang boleh membingkai, tanpa hash', () => {
    expect(cspHeader("'none'")).toBe("frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'");
    expect(cspHeader("'self'")).toMatch(/^frame-ancestors 'self'/);
  });
});

describe('hash sebaris', () => {
  it('menghitung skrip yang jalan, termasuk module', () => {
    const html = '<script>var a=1</script><script type="module">import "/x.js"</script>';
    expect(hashSkripSebaris(html, sha)).toEqual([sha('var a=1'), sha('import "/x.js"')]);
  });
  it('melewati skrip dari berkas, blok data JSON-LD, dan skrip kosong', () => {
    const html = '<script type="module" src="/a.js"></script><script type="application/ld+json">{"a":1}</script><script></script>';
    expect(hashSkripSebaris(html, sha)).toEqual([]);
  });
  it('satu hash untuk skrip yang sama di dua tempat', () => {
    expect(hashSkripSebaris('<script>x()</script><script>x()</script>', sha)).toHaveLength(1);
  });
  it('menghitung elemen gaya, juga di dalam SVG', () => {
    expect(hashGayaSebaris('<style>a{color:red}</style><svg><style>b{}</style></svg>', sha)).toEqual([sha('a{color:red}'), sha('b{}')]);
  });
});

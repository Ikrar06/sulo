// The Content Security Policy's rules: what is hashed, and what the policy never allows.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cspDengan, cspHeader, hashGayaSebaris, hashSkripSebaris } from '../scripts/lib/aturan-keamanan.mjs';

const sha = (isi: string) => createHash('sha256').update(isi).digest('base64');

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

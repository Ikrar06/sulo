// The Content Security Policy's rules: what is hashed, and what the policy never allows.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CSP_DASAR, cspDengan, hashSkripSebaris } from '../scripts/lib/aturan-keamanan.mjs';

const sha = (isi: string) => createHash('sha256').update(isi).digest('base64');

describe('CSP', () => {
  it('mulai dari default-src self dan tidak pernah mengizinkan eval', () => {
    const csp = cspDengan([sha('a')]);
    expect(csp.startsWith("default-src 'self'")).toBe(true);
    expect(csp).not.toMatch(/unsafe-eval/);
    expect(csp).toContain(`script-src 'self' 'sha256-${sha('a')}'`);
  });
  it('style sebaris hanya di atribut: elemen <style> harus dari situs ini', () => {
    expect(CSP_DASAR).toContain("style-src-elem 'self'");
    expect(CSP_DASAR).toContain("style-src 'self' 'unsafe-inline'");
  });
  it('tidak ada alamat lain di kebijakan', () => {
    expect(cspDengan([])).not.toMatch(/https?:/);
  });
});

describe('hash skrip sebaris', () => {
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
});

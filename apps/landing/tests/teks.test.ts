// The text rules: what counts as a separator between phrases, and what does not.
import { describe, expect, it } from 'vitest';
import { cariPemisah, kata } from '../scripts/lib/aturan-teks.mjs';

describe('pemisah antarfrasa', () => {
  it('menemukan titik tengah, garis tegak, garis miring, bullet, dan tanda pisah di antara spasi', () => {
    for (const p of ['·', '|', '/', '•', '—', '–', '-']) expect(cariPemisah(`Gratis ${p} Kode terbuka`)).toBe(p);
  });
  it('tidak menganggap garis miring dan tanda hubung di dalam kata atau alamat', () => {
    for (const t of ['chrome://extensions', 'Unhas-mu sendiri', 'peta 14-day', 'shasum -a 256 nama-berkas', 'Versi 1.0.0, 6,6 MB']) expect(cariPemisah(t)).toBeNull();
  });
  it('menghitung kata', () => {
    expect(kata('  Tanya   jawab ')).toBe(2);
  });
});

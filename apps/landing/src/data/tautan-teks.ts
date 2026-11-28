// A few outside sites named in the guides' sentences become links where they are written (owner, 27 Nov 2026:
// "sideloadly.io" should be clickable). Only these hosts, always https, opened in a new tab without a referrer.
export const SITUS_LUAR = ['sideloadly.io', 'altstore.io'] as const;

export type PotonganTeks = { teks: string } | { teks: string; href: string };

/** The sentence cut into plain parts and links to SITUS_LUAR, in order; a sentence without one comes back whole. */
export function potongTautan(teks: string): PotonganTeks[] {
  const pola = new RegExp(`\\b(${SITUS_LUAR.map((s) => s.replace('.', '\\.')).join('|')})\\b`, 'g');
  const hasil: PotonganTeks[] = [];
  let dari = 0;
  for (const m of teks.matchAll(pola)) {
    const i = m.index ?? 0;
    if (i > dari) hasil.push({ teks: teks.slice(dari, i) });
    hasil.push({ teks: m[0], href: `https://${m[0]}` });
    dari = i + m[0].length;
  }
  if (dari < teks.length) hasil.push({ teks: teks.slice(dari) });
  return hasil;
}

// The guides' motion that needs script: each step, and the parts under the
// steps, rise into place once as they are reached, and what to press in a
// step's drawing arrives after the drawing (the ring closes in on it, then
// its dot). The top of the page arrives by CSS alone (styles/gerak.css), and
// the steps' rail follows the scroll there too. Nothing runs under reduced
// motion; without this script everything is simply in place.
import { MASUK, siapkanNaik } from './naik';

const gerak = document.documentElement.dataset.gerak ?? 'diam';

const NAIK = [
  ['.langkah', 'anak'],
  ['.panduan-catatan', 'satu'],
  ['.panduan-bagian', 'satu'],
  ['.panduan-dua', 'anak'],
  ['.panduan-periksa', 'satu'],
  ['.panduan-minat', 'satu'],
  ['.panduan-lain', 'satu'],
] as const;

/** One ring after another where a step has two things to press. */
const SELANG_LINGKAR = 160;

function lingkarTiba(wadah: HTMLElement): void {
  wadah.querySelectorAll<HTMLElement>('.il-lingkar').forEach((lingkar, i) => {
    const tunda = 380 + i * SELANG_LINGKAR;
    // A first keyframe only: each ends on the drawing's own style.
    lingkar.animate([{ outlineColor: 'transparent', outlineOffset: '12px', offset: 0 }], { duration: 420, delay: tunda, easing: MASUK, fill: 'backwards' });
    lingkar.animate([{ opacity: 0, scale: 0.2, offset: 0 }], { pseudoElement: '::after', duration: 260, delay: tunda + 260, easing: MASUK, fill: 'backwards' });
  });
}

if (gerak !== 'diam') siapkanNaik(NAIK, lingkarTiba);

export {};

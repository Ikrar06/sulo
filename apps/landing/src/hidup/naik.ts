// Things that rise into place once, as they are reached (the home page and
// the guides). Until then they are held by a plain inline style (no
// animation, so no layer is kept waiting); the animation takes over the
// moment they are seen and leaves nothing behind. Without this script, or
// under reduced motion, nothing is ever held.
export const MASUK = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const JARAK = 70;

/**
 * `satu`: the element itself. `anak`: its children one after another. `masing`: each child on its own, when it
 * is reached itself, a little later the further right it sits.
 */
export type CaraNaik = 'satu' | 'anak' | 'masing';
export type DaftarNaik = readonly (readonly [selector: string, cara: CaraNaik])[];

interface Kerja {
  pengamat: HTMLElement;
  target: HTMLElement[];
  tunda: (i: number, el: HTMLElement) => number;
}

const JAUH = '0 18px';
const LAMA = 560;

function tahan({ pengamat, target, tunda }: Kerja, tiba?: (pengamat: HTMLElement) => void): void {
  for (const el of target) {
    el.style.opacity = '0';
    el.style.translate = JAUH;
  }
  const io = new IntersectionObserver(
    (entri) => {
      if (!entri.some((e) => e.isIntersecting)) return;
      io.disconnect();
      target.forEach((el, i) => {
        el.style.opacity = '';
        el.style.translate = '';
        el.animate([{ opacity: 0, translate: JAUH }, { opacity: 1, translate: '0 0' }], { duration: LAMA, delay: tunda(i, el), easing: MASUK, fill: 'backwards' });
      });
      tiba?.(pengamat);
    },
    { threshold: 0.12 },
  );
  io.observe(pengamat);
}

/** Holds what is still below the screen and lets it rise when reached; `tiba` is told as each one starts. */
export function siapkanNaik(daftar: DaftarNaik, tiba?: (pengamat: HTMLElement) => void): void {
  const kerja: Kerja[] = [];
  for (const [selector, cara] of daftar) {
    for (const wadah of document.querySelectorAll<HTMLElement>(selector)) {
      const anak = [...wadah.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
      if (cara === 'satu') kerja.push({ pengamat: wadah, target: [wadah], tunda: () => 0 });
      else if (cara === 'anak') kerja.push({ pengamat: wadah, target: anak, tunda: (i) => Math.min(i, 8) * JARAK });
      else for (const el of anak) kerja.push({ pengamat: el, target: [el], tunda: (_, e) => Math.round((e.getBoundingClientRect().left / Math.max(1, innerWidth)) * 180) });
    }
  }
  // Read first, write after: one layout for all of them. What is already on the screen or above it (a page opened
  // at an anchor, a restored scroll) has been painted and is left alone: hiding it now would blink. So is anything
  // not shown at all (its place reads as the top of the page).
  const bawahLayar = innerHeight;
  const menunggu = kerja.filter((k) => k.target.length > 0 && k.pengamat.getBoundingClientRect().top >= bawahLayar);
  for (const k of menunggu) tahan(k, tiba);
}

// The user guide's list of sections marks the one being read (aria-current),
// by the same rule the apps' own documents use (core scrollspy: the last
// section whose top has passed a line near the top of the screen). Without
// this script the list is a plain list of links.
import { getActiveSection, SCROLLSPY_OFFSET } from '@sulo/ui/scrollspy';

/**
 * The rule's line sits 96 px down. Here a floating navigation covers the top
 * of the screen and a section starts with its own padding, so a section
 * counts from the moment its title is in the top third: its top is measured
 * this much higher than it is.
 */
const LEBIH_AWAL = () => Math.max(0, window.innerHeight / 3 - SCROLLSPY_OFFSET);

const tautan = [...document.querySelectorAll<HTMLAnchorElement>('.pakai-daftar a[href^="#"]')];
const bagian = tautan.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))));

if (tautan.length > 0 && bagian.every((b): b is HTMLElement => b !== null)) {
  let kini = -1;
  let menunggu = false;
  const tandai = () => {
    menunggu = false;
    const awal = LEBIH_AWAL();
    const atas = bagian.map((b) => b.getBoundingClientRect().top + window.scrollY - awal);
    const aktif = getActiveSection(atas, window.scrollY, window.innerHeight, document.documentElement.scrollHeight);
    if (aktif === kini) return;
    tautan[kini]?.removeAttribute('aria-current');
    tautan[aktif]?.setAttribute('aria-current', 'true');
    kini = aktif;
  };
  // One measurement a frame at most, and none while nothing moves.
  const minta = () => {
    if (menunggu) return;
    menunggu = true;
    requestAnimationFrame(tandai);
  };
  window.addEventListener('scroll', minta, { passive: true });
  window.addEventListener('resize', minta, { passive: true });
  tandai();
}

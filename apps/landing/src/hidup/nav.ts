// The navigation's two quiet behaviours, nothing sent anywhere:
// - once the page has scrolled a little, the pill tightens (html[data-gulir]);
// - "Install" fills in once the hero's own download button has left the
//   screen (html[data-tombol-lewat]); while that button is on screen the
//   page has one loud button, not two.
// And the phone menu closes when one of its links is chosen.
const html = document.documentElement;

const penanda = document.createElement('div');
penanda.setAttribute('aria-hidden', 'true');
penanda.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:64px;pointer-events:none';
document.body.prepend(penanda);
new IntersectionObserver(([e]) => {
  if (e) html.toggleAttribute('data-gulir', !e.isIntersecting);
}).observe(penanda);

// The hero holds one main button per device; only the visitor's is shown (data-perangkat is set before this runs).
const utama = [...document.querySelectorAll<HTMLElement>('.pembuka [data-tombol-utama]')].find((e) => e.offsetParent !== null);
if (utama) {
  new IntersectionObserver(([e]) => {
    if (e) html.toggleAttribute('data-tombol-lewat', !e.isIntersecting);
  }).observe(utama);
}
// A page without the hero (the guides, the 404) has its own button (a step's download, the way home): the nav's
// Install stays quiet there, so it never outshines the page's own action or leads away from it.

const menu = document.getElementById('menu-hp');
for (const a of document.querySelectorAll<HTMLElement>('[data-tutup-menu]')) {
  a.addEventListener('click', () => {
    try {
      menu?.hidePopover();
    } catch {
      // Already closed.
    }
  });
}

export {};

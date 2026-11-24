// The theme button. The page starts in the visitor's own setting (CSS and
// prefers-color-scheme); a choice made here is kept in this browser
// (localStorage, wrapped: a private window may refuse it) and read again
// before the first paint (tata/Dasar.astro). The device screens that follow
// the page ("auto") follow the choice too: same-origin iframes, told directly.
// The change itself is the browser's own View Transition (a short cross-fade),
// except under reduced motion. Nothing is sent anywhere.
export const KUNCI_TEMA = 'sulo-landing:tema';

type Tema = 'light' | 'dark';
const gelapSistem = matchMedia('(prefers-color-scheme: dark)');
const sekarang = (): Tema => (document.documentElement.dataset.theme as Tema | undefined) ?? (gelapSistem.matches ? 'dark' : 'light');

function simpan(tema: Tema) {
  try {
    localStorage.setItem(KUNCI_TEMA, tema);
  } catch {
    // Private window or storage blocked: the choice lasts for this page only.
  }
}

/** Tells every device screen that follows the page ("auto") which theme is in force. */
function kabariLayar(tema: Tema) {
  for (const f of document.querySelectorAll<HTMLIFrameElement>('iframe[src*="/auto/"]')) {
    try {
      const html = f.contentDocument?.documentElement;
      if (html) html.dataset.theme = tema;
    } catch {
      // Not loaded yet: the screen reads the same choice itself when it loads.
    }
  }
}

function labeli(tema: Tema) {
  for (const b of document.querySelectorAll<HTMLElement>('[data-tema-tombol]')) {
    const label = tema === 'dark' ? b.dataset.labelTerang : b.dataset.labelGelap;
    if (!label) continue;
    if (b.classList.contains('nav-tema-teks')) b.textContent = label;
    else b.setAttribute('aria-label', label);
  }
}

function pakai(tema: Tema) {
  document.documentElement.dataset.theme = tema;
  kabariLayar(tema);
  labeli(tema);
}

/** The other theme's pictures (lazy and hidden until now) start loading as the button is reached for. */
function pramuat() {
  for (const img of document.querySelectorAll<HTMLImageElement>('img[data-pramuat]')) img.loading = 'eager';
}

for (const b of document.querySelectorAll<HTMLElement>('[data-tema-tombol]')) {
  b.addEventListener('pointerenter', pramuat, { once: true });
  b.addEventListener('focus', pramuat, { once: true });
  b.addEventListener('click', () => {
    pramuat();
    const tema: Tema = sekarang() === 'dark' ? 'light' : 'dark';
    simpan(tema);
    if (document.documentElement.dataset.gerak !== 'diam' && 'startViewTransition' in document) document.startViewTransition(() => pakai(tema));
    else pakai(tema);
  });
}
labeli(sekarang());
// While no choice is made, the system's own change is followed (CSS does the page; the labels follow here).
gelapSistem.addEventListener('change', () => {
  if (!document.documentElement.dataset.theme) labeli(sekarang());
});

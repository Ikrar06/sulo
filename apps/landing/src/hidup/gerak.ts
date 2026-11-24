// The home page's motion that needs script (brief 7): the hero's pieces find
// their rows in the laptop's screen, and a few things play once when they
// come into view. Nothing here hides anything: each one-shot animation is
// made and held at its first frame here, then played when seen, so without
// this script (or under reduced motion, data-gerak="diam") everything simply
// stays in its final place. Transform and opacity only, the apps' curves.
const html = document.documentElement;
const gerak = html.dataset.gerak ?? 'diam';
const MASUK = 'cubic-bezier(0.22, 1, 0.36, 1)';
const JARAK = 70;

/** Holds the animations at their first frame, and plays them once the element is a fifth in view. */
function sekaliSaatTerlihat(el: Element, buat: () => Animation[]): void {
  const animasi = buat();
  for (const a of animasi) a.pause();
  const io = new IntersectionObserver(
    (entri) => {
      if (!entri.some((e) => e.isIntersecting)) return;
      io.disconnect();
      for (const a of animasi) a.play();
    },
    { threshold: 0.2 },
  );
  io.observe(el);
}

/** The pieces' targets: for each, the row or card in the laptop's screen that shows the same words. */
function ukurTujuan(): void {
  const iframe = document.querySelector<HTMLIFrameElement>('.pembuka .perangkat--laptop iframe');
  const dok = iframe?.contentDocument;
  if (!iframe || !dok?.body || iframe.offsetWidth === 0) return;
  const pembuka = document.querySelector<HTMLElement>('.pembuka');
  if (!pembuka) return;
  const fr = iframe.getBoundingClientRect();
  const k = fr.width / iframe.offsetWidth;
  const asal = pembuka.getBoundingClientRect();
  for (const potongan of document.querySelectorAll<HTMLElement>('.pembuka > .potongan')) {
    if (potongan.offsetWidth === 0) continue;
    const tujuan = cariPasangan(potongan, dok);
    if (!tujuan) continue;
    const t = tujuan.getBoundingClientRect();
    // Both scroll with the page, so their distance is the same at any scroll. The piece's centre is read from its
    // layout box (its offset in the hero), never from where its own animation has it now.
    const pusatX = asal.left + potongan.offsetLeft + potongan.offsetWidth / 2;
    const pusatY = asal.top + potongan.offsetTop + potongan.offsetHeight / 2;
    const tujuanX = fr.left + (t.left + t.width / 2) * k;
    const tujuanY = fr.top + (t.top + t.height / 2) * k;
    const skala = Math.min(1.4, Math.max(0.35, (t.width * k) / potongan.offsetWidth));
    potongan.style.setProperty('--tuju-x', `${Math.round(tujuanX - pusatX)}px`);
    potongan.style.setProperty('--tuju-y', `${Math.round(tujuanY - pusatY)}px`);
    potongan.style.setProperty('--tuju-skala', skala.toFixed(3));
  }
}

/** The piece's longest words that the laptop's screen also shows, and the row or card round them there. */
function cariPasangan(potongan: HTMLElement, dok: Document): Element | null {
  const kalimat = [...potongan.querySelectorAll('*')]
    .flatMap((el) => [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent?.trim() ?? ''))
    .filter((t) => t.length >= 4)
    .sort((a, b) => b.length - a.length);
  const jalan = (t: string): Element | null => {
    const w = dok.createTreeWalker(dok.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.textContent?.trim() === t) return n.parentElement;
    return null;
  };
  for (const t of kalimat) {
    const el = jalan(t);
    if (el) return el.closest('li, section, article, a') ?? el;
  }
  return null;
}

function siapkanPotongan(): void {
  const iframe = document.querySelector<HTMLIFrameElement>('.pembuka .perangkat--laptop iframe');
  if (!iframe) return;
  // After the devices' own entrance has settled, so the laptop is where it stays.
  const panggung = document.querySelector('.panggung');
  const tenang = () => Promise.all((panggung?.getAnimations() ?? []).map((a) => a.finished)).catch(() => undefined);
  const ukur = () => void tenang().then(() => requestAnimationFrame(ukurTujuan));
  if (iframe.contentDocument?.readyState === 'complete') ukur();
  iframe.addEventListener('load', ukur);
  let tunda = 0;
  addEventListener('resize', () => {
    clearTimeout(tunda);
    tunda = window.setTimeout(ukur, 150);
  });
  document.fonts?.ready.then(ukur).catch(() => {});
}

/** One-shot motion as sections come into view (brief 7.1: one per bento tile, simple entrances elsewhere). */
function siapkanSekali(): void {
  // Where the data comes from: the three lines draw themselves into Sulo once.
  const garis = document.querySelector('.sumber-garis');
  if (garis) {
    sekaliSaatTerlihat(garis, () =>
      [...garis.querySelectorAll<SVGPathElement>('path')].map((path, i) => {
        path.setAttribute('pathLength', '1');
        path.style.strokeDasharray = '1';
        return path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 700, delay: i * JARAK * 2, easing: MASUK, fill: 'both' });
      }),
    );
  }
  // Kabar terbaru: the updates arrive one by one, from pale to full.
  const kabar = document.querySelector('.ubin--kabar');
  if (kabar) {
    sekaliSaatTerlihat(kabar, () =>
      [...kabar.querySelectorAll('li')].slice(0, 6).map((li, i) => li.animate([{ opacity: 0.35, translate: '0 6px' }, { opacity: 1, translate: '0 0' }], { duration: 360, delay: 120 + i * JARAK, easing: MASUK, fill: 'both' })),
    );
  }
  // The 7 days ahead: the app's own bars grow again when the tile is seen (they first grew while out of sight).
  const beban = document.querySelector('.ubin--beban');
  if (beban) {
    sekaliSaatTerlihat(beban, () =>
      [...beban.querySelectorAll<HTMLElement>('.m-bar-grow')].map((bar, i) => {
        bar.style.animation = 'none';
        return bar.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 300, delay: 100 + i * 40, easing: MASUK, fill: 'both' });
      }),
    );
  }
  // A day with Sulo: each moment rises into place as it is reached.
  for (const momen of document.querySelectorAll('.momen')) {
    sekaliSaatTerlihat(momen, () => {
      const teks = momen.querySelector('.momen-teks');
      const hp = momen.querySelector('.momen-hp');
      return [
        ...(teks ? [teks.animate([{ opacity: 0, translate: '0 16px' }, { opacity: 1, translate: '0 0' }], { duration: 420, easing: MASUK, fill: 'both' })] : []),
        ...(hp ? [hp.animate([{ opacity: 0, translate: '0 24px' }, { opacity: 1, translate: '0 0' }], { duration: 480, delay: JARAK, easing: MASUK, fill: 'both' })] : []),
      ];
    });
  }
}

if (gerak !== 'diam') {
  siapkanSekali();
  if (gerak === 'penuh' && CSS.supports('animation-timeline: scroll()')) siapkanPotongan();
}

export {};

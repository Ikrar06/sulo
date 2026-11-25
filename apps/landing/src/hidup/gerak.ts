// The home page's motion that needs script (brief 7): the hero's pieces find
// their rows in the laptop's screen, and a few things play once when they
// come into view. Nothing here hides anything: each one-shot animation is
// made and held at its first frame here, then played when seen, so without
// this script (or under reduced motion, data-gerak="diam") everything simply
// stays in its final place. Transform and opacity only (and one clip-path
// sweep), the apps' curves. Each one-shot fills backwards only: done, it lets
// go of its layer and the element is simply in its own style.
import { JARAK, MASUK, siapkanNaik, type DaftarNaik } from './naik';

const html = document.documentElement;
const gerak = html.dataset.gerak ?? 'diam';
const CERITA = 'cubic-bezier(0.16, 1, 0.3, 1)';

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

/** What rises into place once as it is reached (hidup/naik.ts). */
const NAIK: DaftarNaik = [
  ['.bagian-kepala', 'anak'],
  ['.fakta-daftar', 'anak'],
  ['.sumber-daftar', 'anak'],
  ['.bento-grid', 'masing'],
  ['.privasi-peta', 'satu'],
  ['.privasi-alamat', 'anak'],
  ['.privasi-daftar', 'anak'],
  ['.privasi-izin', 'anak'],
  ['.privasi-bawah', 'satu'],
  ['.pasang-grid', 'masing'],
  ['.tanya-gambar', 'satu'],
  ['.tanya-daftar', 'anak'],
  ['.penutup-isi', 'anak'],
];

/** The pieces' targets: for each, the row or card in the laptop's screen that shows the same words. */
function ukurTujuan(): void {
  const iframe = document.querySelector<HTMLIFrameElement>('.pembuka .perangkat--laptop iframe');
  const dok = iframe?.contentDocument;
  if (!iframe || !dok?.body || iframe.offsetWidth === 0) return;
  const pembuka = document.querySelector<HTMLElement>('.pembuka');
  if (!pembuka) return;
  // The stage grows with the scroll (gerak.css): measured at its full size, where the pieces land.
  const panggung = document.querySelector<HTMLElement>('.panggung');
  if (panggung) panggung.style.animation = 'none';
  const fr = iframe.getBoundingClientRect();
  const k = fr.width / iframe.offsetWidth;
  const asal = pembuka.getBoundingClientRect();
  for (const potongan of document.querySelectorAll<HTMLElement>('.pembuka > .potongan')) {
    if (potongan.offsetWidth === 0) continue;
    const pasangan = cariPasangan(potongan, dok);
    if (!pasangan) continue;
    const t = pasangan.tujuan.getBoundingClientRect();
    // Both scroll with the page, so their distance is the same at any scroll. The piece's centre is read from its
    // layout box (its offset in the hero), never from where its own animation has it now.
    const pusatX = asal.left + potongan.offsetLeft + potongan.offsetWidth / 2;
    const pusatY = asal.top + potongan.offsetTop + potongan.offsetHeight / 2;
    const tujuanX = fr.left + (t.left + t.width / 2) * k;
    const tujuanY = fr.top + (t.top + t.height / 2) * k;
    // The piece shrinks to the size its words have on the screen (their font size there, scaled with the screen),
    // so it lands as that row, never larger than itself.
    const ukuran = (el: Element) => parseFloat(getComputedStyle(el).fontSize) || 1;
    const skala = Math.min(1, Math.max(0.5, (ukuran(pasangan.teksTujuan) * k) / ukuran(pasangan.teksPotongan)));
    potongan.style.setProperty('--tuju-x', `${Math.round(tujuanX - pusatX)}px`);
    potongan.style.setProperty('--tuju-y', `${Math.round(tujuanY - pusatY)}px`);
    potongan.style.setProperty('--tuju-skala', skala.toFixed(3));
  }
  if (panggung) panggung.style.animation = '';
}

interface Pasangan {
  /** The row or card in the screen. */
  tujuan: Element;
  /** The words there, and the same words in the piece. */
  teksTujuan: Element;
  teksPotongan: Element;
}

/** The piece's longest words that the laptop's screen also shows, and the row or card round them there. */
function cariPasangan(potongan: HTMLElement, dok: Document): Pasangan | null {
  const kalimat = [...potongan.querySelectorAll('*')]
    .flatMap((el) => [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => ({ teks: n.textContent?.trim() ?? '', el })))
    .filter((k) => k.teks.length >= 4)
    .sort((a, b) => b.teks.length - a.teks.length);
  const jalan = (t: string): Element | null => {
    const w = dok.createTreeWalker(dok.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.textContent?.trim() === t) return n.parentElement;
    return null;
  };
  for (const k of kalimat) {
    const el = jalan(k.teks);
    if (el) return { tujuan: el.closest('li, section, article, a') ?? el, teksTujuan: el, teksPotongan: k.el };
  }
  return null;
}

function siapkanPotongan(): void {
  const iframe = document.querySelector<HTMLIFrameElement>('.pembuka .perangkat--laptop iframe');
  if (!iframe) return;
  const ukur = () => requestAnimationFrame(ukurTujuan);
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
  // Where the data comes from: the three lines draw themselves into Sulo once, a sweep from the sources to Sulo
  // (a clip on the drawing: its end is exactly the still drawing; a dash would stop short of the lines' real length).
  const garis = document.querySelector('.sumber-garis');
  if (garis) {
    // Watched through its parent: held at its first frame, the drawing is clipped to nothing and never "seen" itself.
    // Sulo's card lights as the lines reach it.
    const nyala = document.querySelector('.sumber-nyala');
    sekaliSaatTerlihat(garis.parentElement ?? garis, () => [
      garis.animate([{ clipPath: 'inset(-4px 100% -4px -4px)' }, { clipPath: 'inset(-4px)' }], { duration: 700, easing: MASUK, fill: 'backwards' }),
      ...(nyala ? [nyala.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 800, delay: 480, easing: MASUK, fill: 'backwards' })] : []),
    ]);
  }
  // Kabar terbaru: the updates arrive one by one, from pale to full.
  const kabar = document.querySelector('.ubin--kabar');
  if (kabar) {
    sekaliSaatTerlihat(kabar, () =>
      [...kabar.querySelectorAll('li')].slice(0, 6).map((li, i) => li.animate([{ opacity: 0.35, translate: '0 6px' }, { opacity: 1, translate: '0 0' }], { duration: 360, delay: 120 + i * JARAK, easing: MASUK, fill: 'backwards' })),
    );
  }
  // The 7 days ahead: the app's own bars grow again when the tile is seen (they first grew while out of sight).
  const beban = document.querySelector('.ubin--beban');
  if (beban) {
    sekaliSaatTerlihat(beban, () =>
      [...beban.querySelectorAll<HTMLElement>('.m-bar-grow')].map((bar, i) => {
        bar.style.animation = 'none';
        return bar.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 300, delay: 100 + i * 40, easing: MASUK, fill: 'backwards' });
      }),
    );
  }
  // The academic calendar: the teaching weeks' bar fills again when the tile is seen (the app's own fill ran out of sight).
  const kalender = document.querySelector('.ubin--kalender');
  if (kalender) {
    sekaliSaatTerlihat(kalender, () =>
      [...kalender.querySelectorAll<HTMLElement>('.db-week-fill')].map((bar) => {
        bar.style.animation = 'none';
        return bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 600, delay: 120, easing: MASUK, fill: 'backwards' });
      }),
    );
  }
  // A day with Sulo: as a row is reached its tile opens, the phone rises into it from below the tile's edge, and
  // the words follow.
  for (const momen of document.querySelectorAll('.momen')) {
    const ubin = momen.querySelector('.momen-ubin');
    const hp = momen.querySelector('.momen-hp');
    const teks = momen.querySelector('.momen-teks');
    if (!ubin || !hp || !teks) continue;
    // Where the browser can tie the phone to the scroll (gerak.css), it travels up its tile as the row passes, and
    // needs no entrance of its own here.
    const terikatGulir = gerak === 'penuh' && CSS.supports('animation-timeline: view()');
    sekaliSaatTerlihat(ubin, () => [
      ubin.animate([{ opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1 }], { duration: 520, easing: CERITA, fill: 'backwards' }),
      ...(terikatGulir ? [] : [hp.animate([{ translate: '-50% 72px' }, { translate: '-50% 0' }], { duration: 820, delay: 60, easing: CERITA, fill: 'backwards' })]),
      teks.animate([{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }], { duration: 460, delay: 140, easing: MASUK, fill: 'backwards' }),
    ]);
  }
}

/** The source diagram keeps flowing only while it is in view (styles/gerak.css runs it under data-hidup). */
function siapkanArus(): void {
  const diagram = document.querySelector<HTMLElement>('.sumber-diagram');
  if (!diagram) return;
  new IntersectionObserver(([e]) => {
    if (e) diagram.toggleAttribute('data-hidup', e.isIntersecting);
  }).observe(diagram);
}

if (gerak !== 'diam') {
  siapkanNaik(NAIK);
  siapkanSekali();
  if (gerak === 'penuh') siapkanArus();
  if (gerak === 'penuh' && CSS.supports('animation-timeline: scroll()')) siapkanPotongan();
}


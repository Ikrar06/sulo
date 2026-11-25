// The screenshot sets of scripts/potret.mjs: which pages, at which widths,
// light or dark, Indonesian or English, and what each shot tries.
const BAHASA = ['id', 'en'];
const TEMA = ['light', 'dark'];
const namaTema = (t) => (t === 'light' ? 'terang' : 'gelap');
const rumah = (b) => (b === 'en' ? '/en/' : '/');

/** Every combination of the lists given, as objects. */
function kali(spec) {
  return Object.entries(spec).reduce((acc, [k, vals]) => acc.flatMap((o) => vals.map((v) => ({ ...o, [k]: v }))), [{}]);
}

export const SETS = {
  // The hero as chosen: phone and laptop, light and dark, both languages; the first screen and the whole hero.
  pembuka: () =>
    kali({ bahasa: BAHASA, tema: TEMA, w: [360, 390, 1440] }).flatMap(({ bahasa, tema, w }) => [
      { path: rumah(bahasa), w, tema, layarPertama: true, nama: `${bahasa}-${w}-${namaTema(tema)}-layar-pertama` },
      { path: rumah(bahasa), w, tema, elemen: '.pembuka', nama: `${bahasa}-${w}-${namaTema(tema)}-pembuka` },
    ]),
  // The mascot's size on a laptop (1.4, 1.7 and 2 times the old 84 px) and a little up on a phone.
  maskot: () => [
    ...kali({ ukuran: [118, 143, 168], tema: TEMA }).map(({ ukuran, tema }) => ({ path: '/', w: 1440, tema, layarPertama: true, gaya: `.pembuka{--maskot:${ukuran}px !important}`, nama: `laptop-${ukuran}-${namaTema(tema)}` })),
    ...kali({ ukuran: [80, 88, 96], skala: [1, 1.3] }).map(({ ukuran, skala }) => ({ path: '/', w: 390, tema: 'light', skala, layarPertama: true, gaya: `.pembuka{--maskot:${ukuran}px !important}`, nama: `hp-${ukuran}-skala-${skala}` })),
  ],
  // Brief 4.1's first test on the light dawn: the warm light behind the mascot, with and without.
  cahaya: () =>
    kali({ w: [390, 1440], cahaya: ['tanpa', 'dengan'] }).map(({ w, cahaya }) => ({
      path: '/',
      w,
      tema: 'light',
      layarPertama: true,
      gaya: cahaya === 'dengan' ? '.cahaya{display:block !important}' : '',
      nama: `terang-${w}-${cahaya}-cahaya`,
    })),
  // The whole home page: every section, phone and laptop, light and dark, both languages.
  rumah: () => kali({ bahasa: BAHASA, tema: TEMA, w: [390, 1440] }).map(({ bahasa, tema, w }) => ({ path: rumah(bahasa), w, tema, nama: `${bahasa}-${w}-${namaTema(tema)}` })),
  // One shot per section, for judging each by eye.
  bagian: () =>
    kali({ bahasa: ['id'], tema: TEMA, w: [390, 1440], bagian: ['.fakta', '.sumber', '.sehari', '.bento', '.privasi', '.pasang', '.tanya', '.penutup', '.kaki'] }).map(({ bahasa, tema, w, bagian }) => ({
      path: rumah(bahasa),
      w,
      tema,
      elemen: bagian,
      gulirDulu: true,
      nama: `${bagian.slice(1)}-${w}-${namaTema(tema)}`,
    })),
  // The install guides and the not-found page.
  panduan: () =>
    kali({ halaman: ['pasang/', 'pasang/android/', 'pasang/chrome/', 'pasang/edge/', 'pasang/iphone/', '404.html'], w: [390, 1440], tema: TEMA }).map(({ halaman, w, tema }) => ({
      path: `/${halaman}`,
      w,
      tema,
      nama: `${halaman.replace(/\/$/, '').replace(/[/.]/g, '-')}-${w}-${namaTema(tema)}`,
    })),
  // The phone's first screen at the browser's text size 1.3: mascot, chips, title, sentence, buttons.
  skala: () => kali({ bahasa: BAHASA, w: [360, 390], skala: [1, 1.3] }).map(({ bahasa, w, skala }) => ({ path: rumah(bahasa), w, tema: 'light', skala, layarPertama: true, nama: `${bahasa}-${w}-skala-${skala}` })),
};

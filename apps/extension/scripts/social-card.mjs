#!/usr/bin/env node
// pnpm social:card: the link preview image (Open Graph, 1200 x 630) shown
// when a link to Sulo is shared on WhatsApp, Instagram and elsewhere. Drawn
// as an HTML page with the brand's own fonts, palette tokens and lockup,
// photographed by Chromium (no network, no image library).
//
// Three layouts, light and dark, three sentences, Indonesian and English:
//   a  Belah     words on the left, the owner's hero (laptop and phone) on the right
//   b  Panggung  lockup and words centred, the hero rising from the bottom edge
//   c  Kartu     the phone's deadline card, rendered from the app with synthetic
//                data (pnpm shots:mockup), large in the middle, the mascot on it
// Everything that matters stays 60 px inside the edges; the words and the
// mascot also survive a centred square crop.
//
// Usage: node scripts/social-card.mjs [--design=a,b,c] [--themes=light,dark]
//        [--sentence=1,2,3] [--lang=id|en] [--out=../../docs-publik]
// Output: <out>/kartu-sosial-<design>-<theme>[-k<sentence>].<lang>.png
// (sentence 1 has no suffix). Design c needs docs/mockup/mobile-bebas from
// pnpm shots:mockup.
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const repo = resolve(root, '../..');
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
/** The owner's pick (23 Nov 2026): design a, sentence 1. Its files carry no design letter. */
const CHOSEN = 'a';
const designs = arg('design', CHOSEN).split(',');
const themes = arg('themes', 'light,dark').split(',');
const sentences = arg('sentence', '1').split(',').map(Number);
const lang = arg('lang', 'id');
const out = resolve(arg('out', join(repo, 'docs-publik')));
const W = 1200;
const H = 630;
const SAFE = 60;

/** The sentences: the owner picks one. English is written for English, not translated word by word. `em` is the one phrase in orange. */
const SENTENCES = {
  id: [
    { pre: 'Tugas, jadwal, presensi Unhas di ', em: 'satu tempat', post: '.' },
    { pre: 'Semua tenggat kuliahmu, kelihatan ', em: 'sekali lihat', post: '.' },
    { pre: 'SIKOLA, NEOSIA, kalender akademik. ', em: 'Sekali buka', post: '.' },
  ],
  en: [
    { pre: 'Your Unhas tasks, classes and attendance, in ', em: 'one place', post: '.' },
    { pre: 'Every deadline you have, ', em: 'at a glance', post: '.' },
    { pre: 'SIKOLA, NEOSIA and the academic calendar, ', em: 'in one view', post: '.' },
  ],
};
const FOOT = {
  id: 'Pendamping akademik mahasiswa Unhas · Tidak resmi',
  en: 'A study companion for Unhas students · Unofficial',
};
const THEME_DIR = { light: 'terang', dark: 'gelap' };

const file = (p) => `file://${p}`;
const fonts = join(root, 'assets/fonts');
const brand = join(root, 'assets/brand');
const heroOf = (theme) => join(repo, 'docs-publik', `hero-${theme}${lang === 'id' ? '.id' : ''}.webp`);
const cardOf = (theme) => join(repo, 'docs/mockup/mobile-bebas', THEME_DIR[theme], lang, 'ringkasan.png');

/** The hero's drawn part: the owner's export leaves a strip at the bottom transparent. */
const HERO_BOX = { w: 1719, h: 1043 }; // of 1720 x 1072

function css(theme) {
  // @import first: a CSS @import after any other rule is ignored.
  return `
  @import url("${file(join(repo, 'packages/ui/src/tokens/palette.css'))}");
  @font-face { font-family: "Plus Jakarta Sans"; font-weight: 700; src: url("${file(join(fonts, 'plus-jakarta-sans/plus-jakarta-sans-latin-700-normal.woff2'))}") format("woff2"); }
  @font-face { font-family: "Inter"; font-weight: 500; src: url("${file(join(fonts, 'inter/inter-latin-500-normal.woff2'))}") format("woff2"); }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body {
    position: relative;
    color: var(--text);
    font-family: "Inter", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    /* One soft family, no hue shift: a touch lighter at the top left (the owner's pick, 23 Nov 2026). */
    background: ${theme === 'dark' ? 'linear-gradient(160deg, #141419 0%, var(--bg) 70%)' : 'linear-gradient(160deg, #ffffff 0%, var(--surface-raised) 100%)'};
  }
  h1 {
    font-family: "Plus Jakarta Sans", "Inter", sans-serif;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.08;
    text-wrap: balance;
  }
  h1 em { font-style: normal; color: var(--brand-orange); }
  /* Plus Jakarta Sans sets commas and full stops wide: pulled in so "tempat." does not read "tempat .". */
  h1 .p { margin-left: -0.05em; }
  .foot { font-size: 22px; font-weight: 500; color: var(--muted); letter-spacing: 0; }
  .lockup { display: block; }
  .shade { position: absolute; inset: 0; pointer-events: none; }`;
}

const lockup = (theme, height) => `<img class="lockup" src="${file(join(brand, theme === 'dark' ? 'lockup-dark.svg' : 'lockup-light.svg'))}" style="height:${height}px" alt="">`;
const punct = (t) => t.replace(/([,.])/g, '<span class="p">$1</span>');
const sentence = (s) => `${punct(s.pre)}<em>${s.em}</em>${punct(s.post)}`;

/** The hero cut to its drawn part, `width` wide. */
function hero(theme, width, style) {
  const scale = width / HERO_BOX.w;
  return `<div style="position:absolute;overflow:hidden;width:${width}px;height:${Math.round(HERO_BOX.h * scale)}px;${style}"><img src="${file(heroOf(theme))}" style="position:absolute;left:0;top:0;width:${Math.round(1720 * scale)}px" alt=""></div>`;
}

const LAYOUTS = {
  // Words on the left as one block, centred top to bottom; the devices on the right.
  a: (theme, s) => `
    <div style="position:absolute;left:${SAFE + 4}px;top:0;bottom:0;width:470px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:0">
      ${lockup(theme, 62)}
      <h1 style="margin-top:44px;font-size:58px">${sentence(s)}</h1>
      <p class="foot" style="margin-top:32px;white-space:nowrap;font-size:19px">${FOOT[lang]}</p>
    </div>
    ${hero(theme, 570, `right:${SAFE - 10}px;top:${Math.round((H - HERO_BOX.h * (570 / HERO_BOX.w)) / 2)}px`)}`,
  // Centred lockup and words; the devices rise from the bottom edge.
  b: (theme, s) => `
    <div style="position:absolute;left:0;right:0;top:${SAFE - 4}px;display:flex;justify-content:center">${lockup(theme, 58)}</div>
    <h1 style="position:absolute;left:150px;right:150px;top:142px;text-align:center;font-size:56px">${sentence(s)}</h1>
    ${hero(theme, 820, `left:${(W - 820) / 2 + 40}px;top:318px`)}`,
  // The phone's greeting and deadline card, large on the right, the mascot sitting on the card.
  c: (theme, s) => {
    // A slice of the phone screen (1206 px wide at scale 3): from the greeting to the deadline card's bottom edge.
    const img = 540;
    const k = img / 1206;
    const top = Math.round(160 * k);
    const height = Math.round((1090 - 160) * k);
    return `
    <div style="position:absolute;left:${SAFE + 4}px;top:${SAFE + 4}px;width:${W - 2 * SAFE - img - 56 - 4}px;display:flex;flex-direction:column;gap:22px">
      <h1 style="font-size:54px">${sentence(s)}</h1>
      <p class="foot" style="font-size:18px">${FOOT[lang]}</p>
    </div>
    <div style="position:absolute;left:${SAFE + 4}px;bottom:${SAFE + 6}px">${lockup(theme, 50)}</div>
    <div style="position:absolute;right:${SAFE}px;top:${Math.round((H - height) / 2)}px;width:${img}px;height:${height}px;overflow:hidden;border-radius:28px;border:1px solid var(--border);background:var(--layer-screen)">
      <img src="${file(cardOf(theme))}" style="position:absolute;left:-1px;top:${-top - 1}px;width:${img}px" alt="">
    </div>`;
  },
};

if (designs.includes('c')) for (const t of themes) if (!existsSync(cardOf(t))) throw new Error(`social-card: ${cardOf(t)} is missing; run pnpm shots:mockup first`);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--allow-file-access-from-files', '--host-resolver-rules=MAP * ~NOTFOUND'] });
const done = [];
for (const d of designs)
  for (const theme of themes)
    for (const n of sentences) {
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      const html = `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><style>${css(theme)}</style></head><body>${LAYOUTS[d](theme, SENTENCES[lang][n - 1])}</body></html>`;
      const tmp = join(out, `.kartu-${d}-${theme}-${n}.html`);
      const { writeFileSync, rmSync } = await import('node:fs');
      writeFileSync(tmp, html);
      await page.goto(file(tmp), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      const name = `kartu-sosial${d === CHOSEN ? '' : `-${d}`}-${theme === 'dark' ? 'gelap' : 'terang'}${n === 1 ? '' : `-k${n}`}.${lang}.png`;
      await page.screenshot({ path: join(out, name) });
      rmSync(tmp);
      done.push(name);
      await page.close();
    }
await browser.close();
console.log(`${done.length} kartu di ${out}`);

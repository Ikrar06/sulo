#!/usr/bin/env node
// Screenshots of the built landing page (dist/) for the owner to judge by eye.
// They stay local (docs/landing/potret/, never committed).
//
//   node apps/landing/scripts/potret.mjs --set=<name> --out=<folder>
//
// Sets: "pembuka" (phase 1: sky a, b, c by where the mascot stands, light and
// dark, 390 and 1440 wide, Indonesian and English), "cip" (three chips or one
// sentence), "judul" (the title's two tones), "skala" (390 wide at the
// phone's text size 1.3: does the first screen still hold the title and the
// button?). A narrow page is opened as an Android phone, a wide one as Chrome
// on a laptop: the download button the page puts first depends on it.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './lib/server.mjs';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const SET = arg('set', 'pembuka');
const OUT = resolve(arg('out', join(ROOT, 'docs/landing/potret/fase-1', SET)));
const DIST = resolve(arg('dist', join(ROOT, 'apps/landing/dist')));

const UA = {
  hp: 'Mozilla/5.0 (Linux; Android 15; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
  laptop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
};
const LEBAR = [390, 1440];
const BAHASA = ['id', 'en'];

/** Every shot of the set: the page, the width, light or dark, the text scale, the file name. */
function shots(set) {
  const list = [];
  if (set === 'pembuka') {
    for (const bahasa of BAHASA)
      for (const latar of ['a', 'b', 'c'])
        for (const maskot of ['atas', 'samping'])
          for (const tema of ['light', 'dark'])
            for (const w of LEBAR) list.push({ path: `/prototipe/${bahasa}/${latar}-${maskot}/`, w, tema, nama: `${bahasa}-${latar}-${maskot}-${w}-${tema === 'light' ? 'terang' : 'gelap'}` });
  } else if (set === 'cip' || set === 'judul') {
    const opsi = set === 'cip' ? ['pisah', 'kalimat'] : ['akhir', 'awal', 'sorot'];
    for (const bahasa of BAHASA) for (const o of opsi) for (const w of LEBAR) list.push({ path: `/prototipe/${bahasa}/${set}-${o}/`, w, tema: 'light', nama: `${bahasa}-${set}-${o}-${w}` });
  } else if (set === 'skala') {
    for (const bahasa of BAHASA) for (const pilihan of ['a-atas', 'a-samping', 'cip-kalimat']) list.push({ path: `/prototipe/${bahasa}/${pilihan}/`, w: 390, tema: 'light', skala: 1.3, nama: `${bahasa}-${pilihan}-390-skala-1.3`, layarPertama: true });
  } else throw new Error(`Set tidak dikenal: ${set}`);
  return list;
}

mkdirSync(join(OUT, 'kecil'), { recursive: true });
const site = await serve(DIST);
const browser = await chromium.launch();
let failed = 0;
for (const s of shots(SET)) {
  const hp = s.w < 768;
  const ctx = await browser.newContext({
    viewport: { width: s.w, height: hp ? 844 : 900 },
    deviceScaleFactor: hp ? 2 : 1,
    colorScheme: s.tema,
    userAgent: hp ? UA.hp : UA.laptop,
    isMobile: hp,
    hasTouch: hp,
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('requestfailed', (r) => errors.push(`gagal dimuat: ${r.url()}`));
  if (s.skala) {
    // The browser's text size, as a visitor sets it: the page's rem sizes follow it.
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Page.enable');
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: Math.round(16 * s.skala), fixed: 13 } });
  }
  await page.goto(`${site.url}${s.path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const file = join(OUT, `${s.nama}.png`);
  await page.screenshot({ path: file, fullPage: !s.layarPertama });
  // A small copy for the comparison sheet.
  execFileSync('cwebp', ['-quiet', '-q', '82', '-resize', String(Math.min(hp ? 780 : 1440, s.w * (hp ? 2 : 1))), '0', file, '-o', join(OUT, 'kecil', `${s.nama}.webp`)]);
  if (errors.length) {
    failed++;
    console.error(`${s.nama}: ${errors.slice(0, 3).join(' | ')}`);
  }
  await ctx.close();
}
await browser.close();
await site.stop();
console.log(`potret: ${shots(SET).length} tangkapan di ${OUT}${failed ? `, ${failed} dengan galat` : ''}`);
if (failed) process.exit(1);

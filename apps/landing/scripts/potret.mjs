#!/usr/bin/env node
// Screenshots of the built landing page (dist/) for the owner to judge by eye.
// They stay local (docs/landing/potret/, never committed).
//
//   node apps/landing/scripts/potret.mjs --set=<name> [--out=<folder>] [--dist=<folder>]
//
// A narrow page is opened as an Android phone, a wide one as Chrome on a
// laptop: the download button the page puts first depends on it. Motion is
// reduced, so every shot is the still end state. A shot may carry CSS to try
// a variant (`gaya`), the browser's text size (`skala`, as a visitor sets it:
// the page's rem sizes follow), the first screen only, or one element.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './lib/server.mjs';
import { SETS } from './lib/potret-set.mjs';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const SET = arg('set', 'pembuka');
const OUT = resolve(arg('out', join(ROOT, 'docs/landing/potret', SET)));
const DIST = resolve(arg('dist', join(ROOT, 'apps/landing/dist')));

const UA = {
  hp: 'Mozilla/5.0 (Linux; Android 15; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
  laptop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
};

const make = SETS[SET];
if (!make) throw new Error(`Set tidak dikenal: ${SET}. Ada: ${Object.keys(SETS).join(', ')}`);
const list = make();
mkdirSync(join(OUT, 'kecil'), { recursive: true });
const site = await serve(DIST);
const browser = await chromium.launch();
let failed = 0;
for (const s of list) {
  const hp = s.w < 768;
  const ctx = await browser.newContext({
    viewport: { width: s.w, height: s.h ?? (hp ? 844 : 900) },
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
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Page.enable');
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: Math.round(16 * s.skala), fixed: 13 } });
  }
  await page.goto(`${site.url}${s.path}`, { waitUntil: 'networkidle' });
  if (s.gaya) await page.addStyleTag({ content: s.gaya });
  if (!s.layarPertama || s.gulirDulu) {
    // Lazy frames and pictures load as they come near: walk down the page once, then back to the top.
    const tinggi = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < tinggi; y += Math.round((s.h ?? 900) * 0.8)) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(120);
    }
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.waitForTimeout(s.tunggu ?? 400);
  const file = join(OUT, `${s.nama}.png`);
  if (s.elemen) await page.locator(s.elemen).first().screenshot({ path: file });
  else await page.screenshot({ path: file, fullPage: !s.layarPertama });
  // A small copy for comparison sheets and for looking at quickly. WebP stops at 16383 px: a very long
  // phone page goes down to 1x, and if even that is too tall only the PNG is kept.
  for (const lebar of [Math.min(hp ? 780 : 1440, s.w * (hp ? 2 : 1)), s.w]) {
    try {
      execFileSync('cwebp', ['-quiet', '-q', '82', '-resize', String(lebar), '0', file, '-o', join(OUT, 'kecil', `${s.nama}.webp`)], { stdio: 'ignore' });
      break;
    } catch {
      // Too tall at this width: try the next, or keep the PNG alone.
    }
  }
  if (errors.length) {
    failed++;
    console.error(`${s.nama}: ${errors.slice(0, 3).join(' | ')}`);
  }
  await ctx.close();
}
await browser.close();
await site.stop();
console.log(`potret: ${list.length} tangkapan di ${OUT}${failed ? `, ${failed} dengan galat` : ''}`);
if (failed) process.exit(1);

#!/usr/bin/env node
// Store images from the brand files, drawn by Chromium (no image library):
// - public/icon/icon-128.png: the dark tile at 96x96 inside 16 px of
//   transparent padding (Chrome Web Store guideline), legible on light and
//   dark backgrounds;
// - docs/rilis/promo-440x280.png: the lockup (flame and wordmark) on a solid
//   background, for the small promo tile.
// Usage: node scripts/build-store-assets.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const svg = (name) => `data:image/svg+xml;base64,${readFileSync(join(root, 'assets/brand', name)).toString('base64')}`;

async function draw(page, { width, height, background, image, box }) {
  const data = await page.evaluate(
    async ({ width, height, background, image, box }) => {
      const img = new Image();
      img.src = image;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, box.x, box.y, box.w, box.h);
      return c.toDataURL('image/png').split(',')[1];
    },
    { width, height, background, image, box },
  );
  return Buffer.from(data, 'base64');
}

const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage();
await page.setContent('<!doctype html><title>assets</title>');

writeFileSync(join(root, 'public/icon/icon-128.png'), await draw(page, { width: 128, height: 128, background: null, image: svg('tile-dark.svg'), box: { x: 16, y: 16, w: 96, h: 96 } }));

// Lockup is 1811x567; 360 px wide on the 440x280 tile, centred.
const w = 360;
const h = Math.round((567 / 1811) * w);
mkdirSync(join(root, 'docs/rilis'), { recursive: true });
writeFileSync(join(root, 'docs/rilis/promo-440x280.png'), await draw(page, { width: 440, height: 280, background: '#0b0b10', image: svg('lockup-dark.svg'), box: { x: (440 - w) / 2, y: (280 - h) / 2, w, h } }));

await browser.close();
console.log('Ditulis: public/icon/icon-128.png, docs/rilis/promo-440x280.png');

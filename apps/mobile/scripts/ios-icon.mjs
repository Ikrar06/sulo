#!/usr/bin/env node
// The iPhone's app icon and launch screen. The icon: the same as the Android launcher icon and the landing
// page's apple-touch-icon,
// the mascot (apps/landing/public/favicon.svg) on the light screen colour (#F1F1F4, android
// res/values/ic_launcher_background.xml). iOS wants one 1024 x 1024 PNG with no transparency; it rounds the
// corners itself. The launch screen: the mascot on the app's screen colour, light and dark (Android
// res/values*/colors.xml sulo_screen, its splash). Rendered with the Playwright Chromium the layout checks
// already use: nothing to install.
//   node scripts/ios-icon.mjs
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const MOBILE = new URL('..', import.meta.url).pathname;
const svg = readFileSync(join(MOBILE, '../landing/public/favicon.svg'), 'utf8');
const BG = /<color name="ic_launcher_background">(#[0-9A-Fa-f]{6})<\/color>/.exec(readFileSync(join(MOBILE, 'android/app/src/main/res/values/ic_launcher_background.xml'), 'utf8'))[1];
const OUT = join(MOBILE, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');

const html = `<!doctype html><html><body style="margin:0"><div style="width:1024px;height:1024px;background:${BG};display:grid;place-items:center">
<div style="width:680px;height:680px;display:grid;place-items:center">${svg.replace('<svg ', '<svg style="width:100%;height:100%" ')}</div></div></body></html>`;
const screen = (dir) => /<color name="sulo_screen">(#[0-9A-Fa-f]{6})<\/color>/.exec(readFileSync(join(MOBILE, `android/app/src/main/res/${dir}/colors.xml`), 'utf8'))[1];
const SPLASH = join(MOBILE, 'ios/App/App/Assets.xcassets/Splash.imageset');
const splashHtml = (bg) => `<!doctype html><html><body style="margin:0"><div style="width:2732px;height:2732px;background:${bg};display:grid;place-items:center">
<div style="width:420px;height:420px;display:grid;place-items:center">${svg.replace('<svg ', '<svg style="width:100%;height:100%" ')}</div></div></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  writeFileSync(OUT, await page.screenshot({ type: 'png', omitBackground: false }));
  console.log(`ios-icon: ${OUT} (1024 x 1024, latar ${BG})`);
  // The launch screen fills the screen (aspect fill): the mascot stays in the middle at about 130 points.
  for (const f of readdirSync(SPLASH)) if (f.endsWith('.png')) rmSync(join(SPLASH, f));
  const big = await browser.newPage({ viewport: { width: 2732, height: 2732 }, deviceScaleFactor: 1 });
  for (const [name, bg] of [['splash-light.png', screen('values')], ['splash-dark.png', screen('values-night')]]) {
    await big.setContent(splashHtml(bg));
    writeFileSync(join(SPLASH, name), await big.screenshot({ type: 'png' }));
    console.log(`ios-icon: ${name} (latar ${bg})`);
  }
  writeFileSync(join(SPLASH, 'Contents.json'), JSON.stringify({
    images: [
      { idiom: 'universal', filename: 'splash-light.png' },
      { idiom: 'universal', filename: 'splash-dark.png', appearances: [{ appearance: 'luminosity', value: 'dark' }] },
    ],
    info: { version: 1, author: 'xcode' },
  }, null, 2) + '\n');
} finally {
  await browser.close();
}

#!/usr/bin/env node
// Frames of the mascot's twelve named expressions (core MASCOT_EXPRESSIONS),
// for looking at its motion before and after a change: from the resting
// expression into each one (the first 400 ms) and its idle motion after (to
// 3 s), on the onboarding's sign-in screen, where the layout check also
// drives every expression. Web build of the app, synthetic data, no network.
//
//   <out>/<tema>/<nn-ekspresi>--<ms>.png   the mascot's box with a margin, scale 2
//
// Usage: node scripts/mascot-frames.mjs --out=<dir> [--no-build] [--themes=light,dark] [--reduced]
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE, ROOT } from './env.mjs';
import { walk } from './onboarding-walk.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const outArg = arg('out', null);
if (!outArg) throw new Error('--out=<dir> is required');
const out = resolve(process.env.INIT_CWD ?? process.cwd(), outArg);
const themes = arg('themes', 'light,dark').split(',');
const reduced = process.argv.includes('--reduced');
const THEME_DIR = { light: 'terang', dark: 'gelap' };
const NAMES = ['neutral', 'happy', 'lookUp', 'lookLeft', 'lookRight', 'lookDown', 'proud', 'busy', 'sad', 'celebrate', 'wink', 'surprised'];
const TIMES = [0, 80, 160, 240, 400, 1000, 2000, 3000];
const PORT = 5197;
const DIST = join(ROOT, '.output/audit-mobile-web');
const OFFLINE = '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost';

if (!process.argv.includes('--no-build')) execFileSync('pnpm', ['exec', 'vite', 'build', '--mode', 'web', '--outDir', DIST, '--emptyOutDir', '--logLevel', 'warn'], { cwd: MOBILE, stdio: ['ignore', 'ignore', 'inherit'] });
const server = spawn('pnpm', ['exec', 'vite', 'preview', '--mode', 'web', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
await new Promise((ok) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && ok()));
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: [OFFLINE] });
let count = 0;
const late = [];
try {
  for (const theme of themes) {
    const dir = join(out, THEME_DIR[theme]);
    mkdirSync(dir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Makassar', colorScheme: theme, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/?lang=id`);
    await walk(page, () => null, { lang: 'id', stopAt: 'signin', slow: 0.5 });
    await page.waitForTimeout(800);
    const box = await page.locator('[data-onb-mascot]').boundingBox();
    const pad = box.width * 0.22;
    const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + 2 * pad, height: box.height + 2 * pad };
    for (const [i, name] of NAMES.entries()) {
      await page.evaluate(() => window.__suloMascot.express('neutral'));
      // "neutral" itself starts from another expression, so its own change is on the sheet too.
      if (name === 'neutral') await page.evaluate(() => window.__suloMascot.express('happy'));
      await page.waitForTimeout(1300);
      const start = Date.now();
      await page.evaluate((n) => window.__suloMascot.express(n), name);
      for (const t of TIMES) {
        const wait = start + t - Date.now();
        if (wait > 0) await page.waitForTimeout(wait);
        const at = Date.now() - start;
        if (at - t > 60) late.push(`${theme} ${name} ${t} ms diambil di ${at} ms`);
        await page.screenshot({ path: join(dir, `${String(i + 1).padStart(2, '0')}-${name}--${String(t).padStart(4, '0')}.png`), clip });
        count++;
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { /* already gone */ }
}
console.log(`mascot-frames: ${count} bingkai di ${out}${late.length > 0 ? `; ${late.length} bingkai terlambat lebih dari 60 ms (mesin sibuk)` : ''}`);

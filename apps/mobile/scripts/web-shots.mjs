#!/usr/bin/env node
// Screenshots of pnpm mobile:web at phone size (412x915), light and dark.
// Usage: node scripts/web-shots.mjs [outDir]   (default .output/mobile-shots)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE, ROOT } from './env.mjs';

const out = process.argv[2] ?? join(ROOT, '.output/mobile-shots');
mkdirSync(out, { recursive: true });
const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', '5175', '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes('5175') && resolve()));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID' });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('http://localhost:5175/');
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(out, `412x915-${scheme}-onboarding.png`) });
    await page.getByRole('button', { name: 'Masuk ke SIKOLA' }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(out, `412x915-${scheme}-terhubung.png`) });
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`Screenshot di ${out}`);

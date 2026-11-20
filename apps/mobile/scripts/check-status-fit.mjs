#!/usr/bin/env node
// Render check: the one updating line (shell/SyncStatusLine.tsx) never cuts
// its text. Every line from core's dictionary (running stages, "Sudah
// terbaru", the failure with "Coba lagi"), Indonesian and English, at 360
// and 384 px wide, text zoom 100% and 130%, in the live app (pnpm mobile:web,
// the app's own CSS and font). Exit 1 on any cut.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { join } from 'node:path';
import { MOBILE, ROOT } from './env.mjs';

const CORE_WORDS = join(ROOT, 'packages/core/src/i18n/mobile.ts');

const PORT = 5186;
const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', String(PORT), '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve()));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
let failed = 0;
try {
  for (const lang of ['id', 'en']) {
    for (const width of [360, 384]) {
      for (const zoom of [1, 1.3]) {
        const context = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2, isMobile: true, locale: lang === 'en' ? 'en-US' : 'id-ID', reducedMotion: 'reduce' });
        if (zoom !== 1) await context.addInitScript((z) => document.addEventListener('DOMContentLoaded', () => document.documentElement.style.setProperty('--m-tz', String(z))), zoom);
        const page = await context.newPage();
        await page.goto(`http://localhost:${PORT}/?lang=${lang}`);
        await page.waitForFunction(() => typeof window.__suloEnterDemo === 'function');
        await page.evaluate(() => window.__suloEnterDemo());
        await page.waitForTimeout(800);
        // The texts come from the page's own module graph (the same dictionary the app uses).
        const texts = await page.evaluate(async ([lang, path]) => {
          const mod = await import(`/@fs${path}`);
          const s = mod.mobileWords(lang).connected.sync;
          return [[s.updating, false], ...Object.values(s.stages).map((t) => [t, false]), [s.upToDate, false], [s.failed, true]].map(([t, retry]) => ({ t, retry, retryText: s.retry }));
        }, [lang, CORE_WORDS]);
        const cuts = await page.evaluate((texts) => {
          const host = document.querySelector('main .mx-auto') ?? document.body;
          const out = [];
          for (const { t, retry, retryText } of texts) {
            const p = document.createElement('p');
            // The same classes as SyncStatusLine: one line, or (the failure, with its button) up to two.
            p.className = `mb-3 flex min-h-9 items-center gap-2 bg-m-inset px-4 text-m13 ${retry ? 'rounded-2xl py-2' : 'rounded-full'}`;
            p.innerHTML = `<span class="size-3.5 shrink-0 rounded-full border-2"></span><span class="min-w-0 flex-1 ${retry ? '' : 'truncate'}"></span>${retry ? '<button class="-mr-2 shrink-0 rounded-full px-2 py-1 font-semibold"></button>' : ''}`;
            p.children[1].textContent = t;
            if (retry) p.children[2].textContent = retryText;
            host.prepend(p);
            const span = p.children[1];
            if (span.scrollWidth > span.clientWidth + 0.5) out.push(`${t} (${Math.round(span.scrollWidth)} > ${Math.round(span.clientWidth)} px)`);
            const lines = Math.round(span.getBoundingClientRect().height / parseFloat(getComputedStyle(span).lineHeight));
            if (lines > (retry ? 2 : 1)) out.push(`${t} (${lines} baris)`);
            p.remove();
          }
          return out;
        }, texts);
        console.log(`${cuts.length ? 'GAGAL' : 'ok   '} baris status ${lang} ${width}px zoom ${Math.round(zoom * 100)}%: ${texts.length} teks${cuts.length ? `\n  ${cuts.join('\n  ')}` : ''}`);
        failed += cuts.length;
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  process.kill(-server.pid);
}
process.exit(failed ? 1 : 0);

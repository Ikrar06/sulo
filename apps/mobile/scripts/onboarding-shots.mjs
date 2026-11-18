#!/usr/bin/env node
// Screenshots, clips and frame sheets of the phone's onboarding (M8c.2).
// Usage: node scripts/onboarding-shots.mjs [outDir] [--sizes=360x800,384x832,360x640]
//   [--lang=id|en] [--themes=light,dark]
//   [--special]  the special states (sign-in closed, no connection, sync
//                failed, no course ticked, no name, watching not allowed)
//   [--zoom]     384x832 with text at 130 %
//   [--time]     seconds per screen, long frames; with --cpu=4 the CPU throttle
//   [--video]    one clip of the whole journey and one per screen
//   [--frames]   five frames of each scene (start, 25, 50, 75 %, end)
import { mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './env.mjs';
import { MASCOTS, openPage, startServer, takeFrames, TEXT, walk } from './onboarding-walk.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const has = (name) => args.includes(`--${name}`);
const out = args.find((a) => !a.startsWith('--')) ?? join(ROOT, '.output/onboarding-shots');
const sizes = flag('sizes', '360x800,384x832,360x640').split(',').map((s) => s.split('x').map(Number));
const lang = flag('lang', 'id');
const themes = flag('themes', 'light,dark').split(',');
const cpu = Number(flag('cpu', '1'));
mkdirSync(out, { recursive: true });
const PORT = 5177;
const { browser, stop } = await startServer(PORT);
const notes = [];
const name = (scheme) => (scheme === 'light' ? 'terang' : 'gelap');
const shot = (page, file) => page.screenshot({ path: join(out, file) });

try {
  if (has('video')) {
    const [width, height] = [384, 832];
    const dir = join(out, 'klip');
    const { context, page } = await openPage(browser, PORT, { width, height, lang, video: dir });
    await walk(page, () => null, { lang });
    await page.waitForTimeout(500);
    await context.close();
    renameSync(join(dir, readdirSync(dir).find((f) => f.endsWith('.webm'))), join(out, 'klip-perjalanan-penuh.webm'));
  } else if (has('frames')) {
    // Five frames of each story scene (start, 25, 50, 75 %, end): a fresh walk per frame, stopped by the clock.
    const [width, height] = [384, 832];
    const SCENES = [['1', 3500], ['3', 3400], ['5', 2600], ['9', 1600]];
    class Stop extends Error {}
    for (const [scene, total] of SCENES)
      for (const [i, share] of [0.03, 0.25, 0.5, 0.75, 1].entries()) {
        const { context, page } = await openPage(browser, PORT, { width, height, lang });
        try {
          await walk(page, () => null, {
            lang,
            slow: 0.3,
            onEnter: async (n) => {
              if (n !== scene) return;
              await page.waitForTimeout(total * share);
              await shot(page, `bingkai-layar${scene}-${i}.png`);
              throw new Stop();
            },
          });
        } catch (e) {
          if (!(e instanceof Stop)) throw e;
        }
        await context.close();
      }
  } else {
    for (const [width, height] of sizes)
      for (const scheme of themes) {
        const { context, page } = await openPage(browser, PORT, { width, height, scheme, lang, cpu, probe: has('time') });
        const tag = `${lang === 'en' ? 'en-' : ''}${width}x${height}-${name(scheme)}`;
        const counts = [];
        const frames = [];
        let last = Date.now();
        const times = [];
        await walk(
          page,
          async (n) => {
            times.push(`${n.split('-')[0]}:${((Date.now() - last) / 1000).toFixed(1)}`);
            last = Date.now();
            counts.push(`${n.split('-')[0]}:${await page.evaluate(MASCOTS)}`);
            if (has('time')) frames.push(`${n.split('-')[0]} ${JSON.stringify(await takeFrames(page))}`);
            if (!has('time')) await shot(page, `${tag}-${n}.png`);
          },
          { lang, slow: cpu > 1 ? 1.6 : 1 },
        );
        notes.push(`${tag}: maskot terlihat per layar ${counts.join(' ')}`);
        if (has('time')) notes.push(`${tag} (CPU ${cpu}x): detik sampai tiap layar ${times.join(' ')}`, ...frames.map((f) => `${tag} frame sampai layar ${f}`));
        await context.close();
      }
    if (has('special')) {
      const cases = [
        ['masuk-ditutup', '?signin=cancel', { stopAt: 'signin', signinClick: true }, ['4b']],
        ['tanpa-koneksi', '?signin=offline', { stopAt: 'signin', signinClick: true }, ['4b']],
        ['gagal-memuat', '?prep=fail', { stopAt: 'preparing' }, ['5']],
        ['nol-mata-kuliah', '', { noneTicked: true }, ['6b']],
        ['tanpa-nama', '', { noName: true }, ['7b', '9']],
        ['pemantauan-tidak-diizinkan', '?watch=off', {}, ['8']],
      ];
      for (const [width, height] of sizes)
        for (const scheme of themes)
          for (const [label, query, opts, keep] of cases) {
            const { context, page } = await openPage(browser, PORT, { width, height, scheme, lang, query });
            await walk(page, (n) => (keep.some((k) => n.startsWith(`${k}-`)) ? shot(page, `khusus-${width}x${height}-${name(scheme)}-${label}-${n}.png`) : null), { ...opts, lang, slow: 0.5 });
            await context.close();
          }
    }
    if (has('zoom'))
      for (const scheme of themes) {
        const { context, page } = await openPage(browser, PORT, { width: 384, height: 832, scheme, lang, zoom: 1.3 });
        await walk(page, (n) => shot(page, `font130-384x832-${name(scheme)}-${n}.png`), { lang });
        await context.close();
      }
  }
} finally {
  await stop();
}
writeFileSync(join(out, `catatan${has('time') ? `-waktu-cpu${cpu}` : ''}.txt`), `${notes.join('\n')}\n`);
console.log(notes.join('\n'));

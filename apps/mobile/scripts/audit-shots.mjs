#!/usr/bin/env node
// pnpm shots:audit (the Android app's half): every screen and state of the
// app, for before and after comparisons. From a production build of the web
// mode (vite build --mode web: the synthetic demo account and fake
// adaptors packed in, minified like a release), served locally; every other
// host is unreachable, so nothing can reach SIKOLA, NEOSIA or the data
// repository. The clock is fixed and motion is reduced, so two runs of the
// same code give the same pixels.
//
//   <out>/mobile/<tema>/<bahasa>/<nn-layar>--<keadaan>.png       360x800, scale 2
//   <out>/mobile-412/<tema>/<bahasa>/<nn-layar>--<keadaan>.png   412x915, scale 2 (main screens)
//
// Labels come from the app's own dictionaries (scripts/lib/words.mjs), so a
// reworded button never breaks a step. Each step is guarded: one that cannot
// run is listed at the end and the rest go on. Grades are only ever shot hidden.
//
// Usage: node scripts/audit-shots.mjs --out=<dir> [--no-build] [--themes=light,dark]
//   [--langs=id,en] [--sizes=360,412] [--only=<text in the file name>] [--scale=2]
//   [--plain]  no folder per size: <out>/<tema>/<bahasa>/ (used by shots:mockup)
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE, ROOT } from './env.mjs';
import { clipLog, staticTexts } from './lib/clipped.mjs';
import { loadWords } from './lib/words.mjs';
import { SPECIAL, walk } from './onboarding-walk.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const has = (name) => process.argv.includes(`--${name}`);
const outArg = arg('out', null);
if (!outArg) throw new Error('--out=<dir> is required');
// pnpm runs this from apps/mobile; a relative path is read from where the command was typed.
const out = resolve(process.env.INIT_CWD ?? process.cwd(), outArg);
const themes = arg('themes', 'light,dark').split(',');
const langs = arg('langs', 'id,en').split(',');
const sizes = arg('sizes', '360,412').split(',').map(Number);
const only = arg('only', null);
const scale = Number(arg('scale', '2'));
const SIZE = { 360: [360, 800], 412: [412, 915], 384: [384, 832] };
const THEME_DIR = { light: 'terang', dark: 'gelap' };
const PORT = 5196;
const DIST = join(ROOT, '.output/audit-mobile-web');
// A Wednesday morning in Makassar; the demo account's times are laid out around it.
const NOW = new Date('2026-11-18T10:00:00+08:00');
const OFFLINE = '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost';
const log = (m) => process.stderr.write(`audit-shots (mobile): ${m}\n`);

if (!has('no-build')) {
  log('build web mode (production)');
  // One fixed build id: Tentang shows the commit in this mode, and two runs of the same screens must give the same pixels.
  execFileSync('pnpm', ['exec', 'vite', 'build', '--mode', 'web', '--outDir', DIST, '--emptyOutDir', '--logLevel', 'warn'], { cwd: MOBILE, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, GITHUB_SHA: 'audit00' } });
}
const WORDS = await loadWords();
const server = spawn('pnpm', ['exec', 'vite', 'preview', '--mode', 'web', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
await new Promise((ok) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && ok()));
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: [OFFLINE] });
const done = [];
const failed = [];
const clips = clipLog();
const TEXTS = { id: staticTexts(WORDS.id), en: staticTexts(WORDS.en) };
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** One phone, one theme, one language, one set of query switches; `steps` run in order on it. */
async function session({ width, theme, lang, query = '', lock = false, finished = false, full: fullAllowed = true, dir }, steps) {
  const [w, h] = SIZE[width];
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, isMobile: true, hasTouch: true, locale: lang === 'en' ? 'en-US' : 'id-ID', timezoneId: 'Asia/Makassar', colorScheme: theme, reducedMotion: 'reduce' });
  if (lock) await context.addInitScript(() => localStorage.setItem('CapacitorStorage.sulo:mobile:lockEnabled', 'true'));
  if (finished) await context.addInitScript(() => localStorage.setItem('CapacitorStorage.sulo:mobile:onboarding', JSON.stringify({ step: 'finished', mode: 'first' })));
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  const t = WORDS[lang];
  const target = join(out, dir, THEME_DIR[theme], lang);
  mkdirSync(target, { recursive: true });
  /** Viewport shot, or with `full` the window grown to the screen's whole scrolled content (the app scrolls inside <main>). */
  const shot = async (name, { full = false, wait = 450 } = {}) => {
    if (only && !name.includes(only)) return;
    await page.waitForTimeout(wait);
    const extra = full && fullAllowed ? await page.evaluate(() => { const m = document.querySelector('main'); return m ? Math.min(6000, m.scrollHeight - m.clientHeight) : 0; }) : 0;
    if (extra > 0) {
      await page.setViewportSize({ width: w, height: h + extra });
      await page.waitForTimeout(300);
    }
    const file = join(target, `${name}.png`);
    await page.screenshot({ path: file });
    await clips.note(page, relative(out, file), TEXTS[lang]);
    if (extra > 0) await page.setViewportSize({ width: w, height: h });
    done.push(file);
  };
  const btn = (name, exact = false) => page.getByRole('button', { name, exact }).first();
  const starts = (text) => new RegExp(`^${escapeRe(text)}`);
  const go = async (hash) => {
    await page.evaluate((x) => (location.hash = x), hash);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelector('main')?.scrollTo({ top: 0 }));
  };
  const closeSheet = async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  };
  /** Past the onboarding: the demo account, signed in; the reminders question answered "later". */
  const enter = async () => {
    await page.waitForFunction(() => typeof window.__suloEnterDemo === 'function');
    await page.evaluate(() => window.__suloEnterDemo());
    await page.waitForTimeout(900);
    const later = btn(t.mobile.notify.later, true);
    if (await later.isVisible().catch(() => false)) await later.click();
    // The "updated just now" snackbar of the first sync is gone before anything is shot (it covers what is under it).
    await page.waitForTimeout(3200);
  };
  const ctx = { page, t, lang, shot, btn, starts, go, closeSheet, enter };
  const sep = query.includes('?') ? '&' : '?';
  await page.goto(`http://localhost:${PORT}/${query}${sep}lang=${lang}`);
  for (const [name, run] of steps) {
    try {
      await run(ctx);
    } catch (e) {
      failed.push(`${dir} ${theme} ${lang} ${name}: ${String(e.message ?? e).split('\n')[0]}`);
      await closeSheet().catch(() => undefined);
    }
  }
  await context.close();
}

// ---- The main screens of the demo account (three overdue tasks), NEOSIA off as on a new phone ----
const MAIN = [
  ['masuk', (c) => c.enter()],
  ['ringkasan', (c) => c.shot('10-ringkasan--terlambat', { full: true })],
  ['ringkasan lipatan', (c) => c.shot('10-ringkasan--layar-pertama')],
  ['tugas', async (c) => (await c.go('#tugas'), c.shot('11-tugas--penuh', { full: true }))],
  ['kalender', async (c) => (await c.go('#kalender'), c.shot('13-kalender--daftar', { full: true }))],
  ['presensi', async (c) => (await c.go('#presensi'), c.shot('14-presensi--rekap', { full: true }))],
  ['lainnya', async (c) => (await c.go('#lainnya'), c.shot('15-lainnya--daftar', { full: true }))],
  ['kabar', async (c) => (await c.go('#kabar'), c.shot('16-kabar--daftar', { full: true }))],
  ['mata kuliah', async (c) => (await c.go('#mata-kuliah'), c.shot('17-mata-kuliah--daftar', { full: true }))],
  ['pengaturan', async (c) => (await c.go('#pengaturan'), c.shot('18-pengaturan--semua', { full: true }))],
  ['bantuan', async (c) => (await c.go('#bantuan'), c.shot('19-bantuan--daftar', { full: true }))],
  ['tentang', async (c) => (await c.go('#tentang'), c.shot('20-tentang--semua', { full: true }))],
  ['privasi', async (c) => (await c.go('#privasi'), c.shot('21-privasi--semua', { full: true }))],
];

// ---- Sheets, details and in-screen states (360 only) ----
const DETAIL = [
  ['masuk', (c) => c.enter()],
  ['memperbarui', async ({ page, btn, t, shot }) => {
    // The stand-in sync takes 1.2 s: the first frame is mid-way, the second right after it ends.
    await btn(t.mobile.connected.refresh).click();
    await page.waitForTimeout(650);
    await shot('10-ringkasan--memperbarui', { wait: 0 });
    await page.waitForTimeout(1100);
    await shot('10-ringkasan--sudah-terbaru', { wait: 0 });
    await page.waitForTimeout(3200);
  }],
  ['tugas cari kosong', async ({ page, go, btn, t, shot }) => {
    await go('#tugas');
    await btn(t.mobile.app.search, true).click();
    await page.getByRole('searchbox').fill('zzzz');
    await shot('11-tugas--cari-kosong');
    await btn(t.mobile.app.closeSearch, true).click();
  }],
  ['rincian tugas', async ({ page, shot }) => {
    await page.locator('main section.m-card .m-cover').first().click();
    await page.waitForTimeout(450);
    await shot('12-rincian-tugas--terbuka', { full: true });
  }],
  ['sheet aksi dan tunda', async ({ page, btn, t, starts, shot, closeSheet }) => {
    await btn(t.mobile.app.moreActions, true).click();
    await page.waitForTimeout(450);
    await shot('12-rincian-tugas--sheet-aksi');
    await page.getByRole('dialog').getByRole('button', { name: starts(t.mobile.app.snoozeMenu) }).click();
    await page.waitForTimeout(450);
    await shot('12-rincian-tugas--sheet-tunda');
    await closeSheet();
  }],
  ['tugas filter tanggal', async ({ page, go, shot }) => {
    await go('#ringkasan');
    await page.evaluate(() => { const m = document.querySelector('main'); m?.scrollTo({ top: m.scrollHeight }); });
    await page.locator('[aria-labelledby="week-title"] button').nth(1).click();
    await page.waitForTimeout(450);
    await shot('11-tugas--filter-tanggal');
  }],
  ['kalender bulan', async ({ page, go, btn, t, shot }) => {
    await go('#kalender');
    await btn(t.dash.kalender.month, true).click();
    await page.waitForTimeout(350);
    await shot('13-kalender--bulan', { full: true });
    await page.locator('[role="grid"] button').nth(20).click();
    await page.waitForTimeout(350);
    await shot('13-kalender--hari-dipilih', { full: true });
  }],
  ['presensi rincian', async ({ page, go, shot }) => {
    await go('#presensi');
    await page.getByRole('main').getByRole('button', { name: /Mekanika Fluida/ }).click();
    await page.waitForTimeout(450);
    await shot('14-presensi--rincian', { full: true });
  }],
  ['presensi rincian tanpa sesi', async ({ page, go, shot }) => {
    await go('#presensi');
    await page.getByRole('main').getByRole('button', { name: /Praktikum Lapangan/ }).click();
    await page.waitForTimeout(450);
    await shot('14-presensi--rincian-tanpa-sesi');
  }],
  ['kabar atur notifikasi', async ({ page, go, btn, t, shot, closeSheet }) => {
    await go('#kabar');
    await btn(t.dash.kabar.notify).click();
    await page.waitForTimeout(450);
    await shot('16-kabar--sheet-notifikasi');
    await closeSheet();
  }],
  ['mata kuliah tidak dipantau', async ({ page, go, shot }) => {
    await go('#mata-kuliah');
    await page.getByRole('main').locator('button[aria-expanded]').last().click();
    await page.waitForTimeout(350);
    await shot('17-mata-kuliah--tidak-dipantau', { full: true });
  }],
  ['mata kuliah ganti nama', async ({ page, go, t, starts, shot, closeSheet }) => {
    await go('#mata-kuliah');
    await page.getByRole('button', { name: starts(t.dash.mataKuliah.editName('').trim()) }).first().click();
    await page.waitForTimeout(450);
    await shot('17-mata-kuliah--sheet-nama');
    await closeSheet();
  }],
  ['mata kuliah warna', async ({ page, t, starts, shot, closeSheet }) => {
    await page.getByRole('button', { name: starts(t.dash.mataKuliah.color) }).first().click();
    await page.waitForTimeout(450);
    await shot('17-mata-kuliah--sheet-warna');
    await closeSheet();
  }],
  ['nama panggilan', async ({ page, go, t, starts, shot, closeSheet }) => {
    await go('#pengaturan');
    await page.getByRole('button', { name: starts(t.dash.pengaturan.nickname) }).click();
    await page.waitForTimeout(450);
    await shot('18-pengaturan--sheet-nama-panggilan');
    await closeSheet();
  }],
  ['suara notifikasi', async ({ page, go, t, starts, shot, closeSheet }) => {
    await go('#pengaturan');
    await page.getByRole('button', { name: starts(t.mobile.notifySound.label) }).click();
    await page.waitForTimeout(450);
    await shot('18-pengaturan--sheet-suara');
    await closeSheet();
  }],
  ['laporan masalah', async ({ page, t, starts, shot, closeSheet }) => {
    await page.getByRole('button', { name: starts(t.dash.pengaturan.bugReport.button) }).click();
    await page.waitForTimeout(450);
    await shot('18-pengaturan--sheet-laporan');
    await closeSheet();
  }],
  ['keluar', async ({ page, t, starts, shot, closeSheet }) => {
    await page.getByRole('button', { name: starts(t.mobile.settings.signOutDelete) }).click();
    await page.waitForTimeout(450);
    await shot('18-pengaturan--sheet-keluar');
    await closeSheet();
  }],
  ['bantuan terbuka dan cari kosong', async ({ page, go, shot }) => {
    await go('#bantuan');
    await page.getByRole('main').locator('button[aria-expanded]').first().click();
    await page.waitForTimeout(400);
    await shot('19-bantuan--jawaban-terbuka');
    await page.getByRole('searchbox').fill('zzzz');
    await shot('19-bantuan--cari-kosong');
  }],
];

const one = (name, file, run, full = false) => [[name, async (c) => (await c.enter(), run && (await run(c)), c.shot(file, { full }))]];

/** NEOSIA with synthetic data (?neosia=): the cards on Ringkasan, Jadwal, Nilai hidden, the settings and the checklist. */
const NEOSIA_ALL = [
  ['masuk', (c) => c.enter()],
  ['ringkasan neosia', (c) => c.shot('10-ringkasan--neosia', { full: true })],
  ['jadwal', async (c) => (await c.go('#jadwal'), c.shot('22-jadwal--minggu', { full: true }))],
  ['nilai tersembunyi', async (c) => (await c.go('#nilai'), c.shot('23-nilai--tersembunyi'))],
  ['lainnya neosia', async (c) => (await c.go('#lainnya'), c.shot('15-lainnya--neosia', { full: true }))],
  ['pengaturan neosia', async (c) => (await c.go('#pengaturan/neosia'), c.shot('18-pengaturan--neosia', { full: true }))],
];

async function app(width, theme, lang, dir, wide) {
  const base = { width, theme, lang, dir };
  await session(base, MAIN);
  await session({ ...base, query: '?neosia=all' }, NEOSIA_ALL);
  if (wide) return;
  await session(base, DETAIL);
  await session({ ...base, query: '?demo=aman' }, one('ringkasan aman', '10-ringkasan--aman', null, true));
  await session({ ...base, query: '?demo=kosong' }, [
    ...one('ringkasan kosong', '10-ringkasan--kosong', null, true),
    ['tugas kosong', async (c) => (await c.go('#tugas'), c.shot('11-tugas--kosong'))],
    ['kabar kosong', async (c) => (await c.go('#kabar'), c.shot('16-kabar--kosong'))],
  ]);
  await session({ ...base, query: '?session=expired' }, one('sesi habis', '10-ringkasan--sesi-habis'));
  await session(base, one('offline', '10-ringkasan--tanpa-koneksi', async (c) => {
    await c.page.context().setOffline(true);
    await c.btn(c.t.mobile.connected.refresh).click().catch(() => undefined);
    await c.page.waitForTimeout(1200);
  }));
  await session({ ...base, query: '?session=connected', finished: true }, [['tanpa data', async (c) => (await c.page.waitForTimeout(1500), c.shot('10-ringkasan--memuat-pertama'))]]);
  await session({ ...base, query: '?presensi=none' }, one('presensi belum ada', '14-presensi--belum-ada', (c) => c.go('#presensi')));
  await session({ ...base, query: '?presensi=slow' }, one('presensi memuat', '14-presensi--rincian-memuat', async (c) => {
    await c.go('#presensi');
    await c.page.getByRole('main').getByRole('button', { name: /Etika Profesi/ }).click();
    await c.page.waitForTimeout(200);
  }));
  for (const [mode, file] of [['wait', '30-kunci--menunggu'], ['fail', '30-kunci--gagal'], ['nolock', '30-kunci--tanpa-kunci-layar']])
    await session({ ...base, query: `?lock=${mode}`, lock: true }, [[`kunci ${mode}`, async (c) => (await c.page.waitForTimeout(900), c.shot(file))]]);
  // The new-version card, its row on Tentang, and the screen that replaces the app below the required version.
  await session({ ...base, query: '?release=available' }, [
    ['versi baru', async (c) => {
      await c.page.waitForFunction(() => typeof window.__suloEnterDemo === 'function');
      await c.page.evaluate(() => window.__suloEnterDemo());
      await c.page.waitForTimeout(2600);
      // The reminders question's "later" comes first; the release card's own "later" stays.
      if (await c.page.getByText(c.t.onboarding.reminders.allow).isVisible().catch(() => false)) await c.btn(c.t.mobile.notify.later, true).click();
      await c.page.waitForTimeout(3200);
      await c.shot('10-ringkasan--versi-baru');
      await c.go('#tentang');
      await c.shot('20-tentang--versi-baru', { full: true });
    }],
  ]);
  await session({ ...base, query: '?release=required' }, [
    ['perlu diperbarui', async (c) => {
      await c.page.waitForFunction(() => typeof window.__suloEnterDemo === 'function');
      await c.page.evaluate(() => window.__suloEnterDemo());
      await c.page.waitForTimeout(2000);
      await c.page.reload();
      await c.page.waitForTimeout(1500);
      await c.shot('31-perlu-diperbarui--layar');
    }],
  ]);
  // The static page an old WebView gets instead of the app (public/perlu-pembaruan.html, its own two languages).
  await session(base, [['halaman webview lama', async (c) => {
    await c.page.goto(`http://localhost:${PORT}/perlu-pembaruan.html`);
    await c.page.waitForTimeout(500);
    await c.shot('32-webview-lama--halaman');
  }]]);
  for (const stage of ['invite', 'new', 'beranda', 'unsupported'])
    await session({ ...base, query: `?neosia=${stage}` }, [
      ...one(`neosia ${stage}`, `24-neosia-sambung--${stage}`),
      ...(stage === 'new' ? [['neosia langkah masuk', async (c) => {
        await c.btn(c.t.neosia.mobile.nextItem).click();
        await c.page.waitForTimeout(500);
        await c.shot('24-neosia-sambung--langkah-masuk');
      }]] : []),
    ]);
  await session({ ...base, query: '?neosia=expired' }, one('neosia sesi habis', '24-neosia-sambung--sesi-habis', async (c) => {
    await c.btn(c.t.neosia.mobile.nextItem).click();
    await c.page.waitForTimeout(500);
  }));
}

/** The onboarding's ten screens at rest, then its special states (scripts/onboarding-walk.mjs). */
async function onboarding(width, theme, lang, dir) {
  const run = (query, opts, keep, label) =>
    session({ width, theme, lang, query, dir }, [[`onboarding ${label ?? 'utama'}`, async (c) => {
      await walk(c.page, async (n) => {
        if (keep && !keep.some((k) => n.startsWith(`${k}-`))) return;
        // "9-selesai" -> 00-onboarding--9-selesai; a special state is named by its label ("4b-masuk-ditutup").
        if (n.startsWith('10-')) return;
        await c.shot(`00-onboarding--${label ? `${n.split('-')[0]}-${label}` : n}`);
      }, { ...opts, lang, slow: 0.6 });
    }]]);
  await run('', {}, null, null);
  for (const [label, query, opts, keep] of SPECIAL) await run(query, opts, keep, label);
}

try {
  for (const width of sizes) {
    const wide = width !== sizes[0];
    const dir = has('plain') ? '' : wide ? `mobile-${width}` : 'mobile';
    for (const theme of themes)
      for (const lang of langs) {
        log(`${width} ${theme} ${lang}`);
        await app(width, theme, lang, dir, wide);
        await onboarding(width, theme, lang, dir);
      }
  }
} finally {
  await browser.close();
  // The whole group: pnpm and the vite it started.
  try { process.kill(-server.pid); } catch { /* already gone */ }
}
if (!only && !has('plain')) writeFileSync(join(out, 'terpotong-mobile.json'), `${JSON.stringify(clips.rows, null, 1)}\n`);
else for (const r of clips.rows.filter((x) => x.kind !== 'data')) console.log(`terpotong (${r.kind}, ${r.how}) ${r.file}: ${r.text}`);
log(`${done.length} gambar di ${dirname(done[0] ?? out)} dan folder sejenis`);
console.log(`Teks terpotong: ${JSON.stringify(clips.summary())} (rincian di terpotong-mobile.json)`);
if (failed.length > 0) console.log(`Langkah gagal (${failed.length}):\n${failed.join('\n')}`);
console.log(`audit-shots mobile: ${done.length} gambar, ${failed.length} langkah gagal`);

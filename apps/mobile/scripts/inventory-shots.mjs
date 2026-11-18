#!/usr/bin/env node
// Every screen and state of the Android app (the M8c.1 inventory) at
// 384x832, light and dark, from pnpm mobile:web with the synthetic demo
// account. Web-only switches set up the states: ?demo= (aman, kosong),
// ?session=expired, ?presensi= (none, slow), ?lock= (wait, fail, nolock).
// Each step is guarded: a step that cannot run is listed, the rest go on.
// Also checks each shot for the card rules: no element wider than the
// screen's content with a bottom border (a full-width divider list).
// Usage: node scripts/inventory-shots.mjs <outDir> [--only=light|dark]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE } from './env.mjs';

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--'));
if (!out) throw new Error('outDir missing');
const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];
mkdirSync(out, { recursive: true });
const PORT = 5182;
const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', String(PORT), '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve()));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const done = [];
const failed = [];
const findings = [];

/** Bordered rows that reach the screen's edges (within 4 px): the old full-width list. */
const edgeRows = (page) =>
  page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    return [...document.querySelectorAll('main *, [role="dialog"] *')]
      .filter((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return r.height > 0 && parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== 'none' && r.left <= 4 && r.right >= W - 4;
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}"`);
  });

async function session(scheme, { query = '', lock = false, offline = false } = {}, steps) {
  const context = await browser.newContext({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Makassar', colorScheme: scheme, reducedMotion: 'reduce' });
  if (lock) await context.addInitScript(() => localStorage.setItem('CapacitorStorage.sulo:mobile:lockEnabled', 'true'));
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-11-18T10:00:00+08:00'));
  const shot = async (name) => {
    await page.waitForTimeout(450);
    const file = `${scheme}-${name}.png`;
    await page.screenshot({ path: join(out, file) });
    done.push(file);
    const rows = await edgeRows(page);
    if (rows.length > 0) findings.push(`${file}: baris bergaris selebar layar: ${rows.join('; ')}`);
  };
  const btn = (name, exact = false) => page.getByRole('button', { name, exact }).first();
  const back = async () => {
    const b = page.getByRole('button', { name: 'Kembali', exact: true });
    while (await b.isVisible().catch(() => false)) {
      await b.click();
      await page.waitForTimeout(250);
    }
  };
  const tab = async (name) => {
    await back();
    await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click();
    await page.waitForTimeout(300);
  };
  const more = async (name) => {
    await tab('Lainnya');
    await page.getByRole('main').getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
    await page.waitForTimeout(300);
  };
  const scroll = (to) => page.evaluate((y) => { const m = document.querySelector('main'); m?.scrollTo({ top: y === 'end' ? m.scrollHeight : y }); }, to);
  const closeSheet = async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  };
  const signIn = async () => {
    await page.waitForTimeout(600);
    await btn('Masuk ke SIKOLA').click();
    await page.waitForTimeout(700);
    if (await btn('Nanti', true).isVisible().catch(() => false)) await btn('Nanti', true).click();
    await page.waitForTimeout(700);
  };
  const ctx = { page, shot, btn, tab, more, back, scroll, closeSheet, signIn };
  await page.goto(`http://localhost:${PORT}/${query}`);
  if (offline) await context.setOffline(false);
  for (const [name, run] of steps) {
    try {
      await run(ctx);
    } catch (e) {
      failed.push(`${scheme} ${name}: ${String(e.message ?? e).split('\n')[0]}`);
      await closeSheet().catch(() => undefined);
    }
  }
  await context.close();
}

const MAIN = [
  ['onboarding', async ({ page, shot }) => (await page.waitForTimeout(700), shot('01-onboarding'))],
  ['izin notifikasi', async ({ page, btn, shot }) => {
    await btn('Masuk ke SIKOLA').click();
    await page.waitForTimeout(800);
    await shot('02-izin-notifikasi');
    await btn('Nanti', true).click();
    await page.waitForTimeout(800);
  }],
  ['ringkasan terlambat', async ({ shot, scroll }) => {
    await shot('03-ringkasan-terlambat');
    await scroll('end');
    await shot('03b-ringkasan-bawah');
    await scroll(0);
  }],
  ['snackbar', async ({ page, btn, shot }) => {
    await btn('Perbarui').click();
    await page.waitForTimeout(250);
    await shot('04-snackbar');
    await page.waitForTimeout(2600);
  }],
  ['tugas penuh', async ({ tab, shot }) => (await tab('Tugas'), shot('05-tugas'))],
  ['tugas cari kosong', async ({ page, btn, shot }) => {
    await btn('Cari').click();
    await page.getByRole('searchbox').fill('zzzz');
    await page.locator('body').click({ position: { x: 5, y: 600 } });
    await shot('06-tugas-cari-kosong');
    await btn('Tutup pencarian').click();
  }],
  ['rincian tugas', async ({ page, shot }) => {
    await page.locator('main section.m-card .m-cover').first().click();
    await page.waitForTimeout(400);
    await shot('07-rincian-tugas');
  }],
  ['tunda', async ({ page, btn, shot, closeSheet }) => {
    await btn('Tunda').click();
    await page.waitForTimeout(400);
    await shot('08-sheet-tunda');
    await closeSheet();
  }],
  ['tugas filter tanggal', async ({ page, tab, shot, scroll }) => {
    await tab('Ringkasan');
    await scroll('end');
    await page.locator('[aria-labelledby="week-title"] button').nth(1).click();
    await page.waitForTimeout(400);
    await shot('09-tugas-filter-tanggal');
  }],
  ['kalender daftar', async ({ tab, shot }) => (await tab('Kalender'), shot('10-kalender-daftar'))],
  ['kalender langganan', async ({ scroll, shot }) => (await scroll('end'), shot('11-kalender-langganan'))],
  ['kalender bulan', async ({ page, btn, shot, scroll }) => {
    await scroll(0);
    await btn('Bulan', true).click();
    await page.waitForTimeout(300);
    await shot('12-kalender-bulan');
    await page.locator('[role="grid"] button').nth(20).click();
    await page.waitForTimeout(300);
    await shot('13-kalender-hari-dipilih');
  }],
  ['presensi', async ({ tab, shot }) => (await tab('Presensi'), shot('14-presensi'))],
  ['presensi rincian', async ({ page, shot, scroll }) => {
    await page.getByRole('main').getByRole('button', { name: /Mekanika Fluida/ }).click();
    await page.waitForTimeout(400);
    await shot('15-presensi-rincian');
    await scroll('end');
    await shot('15b-presensi-rincian-bawah');
  }],
  ['presensi rincian kosong', async ({ page, back, shot }) => {
    await back();
    await page.locator('main section.m-card .m-cover').nth(1).click();
    await page.waitForTimeout(400);
    await shot('16-presensi-rincian-tanpa-sesi');
  }],
  ['lainnya', async ({ tab, shot }) => (await tab('Lainnya'), shot('17-lainnya'))],
  ['kabar', async ({ more, shot }) => (await more('Kabar'), shot('18-kabar'))],
  ['kabar atur notifikasi', async ({ page, btn, shot, closeSheet }) => {
    await btn('Atur notifikasi').click();
    await page.waitForTimeout(400);
    await shot('19-sheet-atur-notifikasi');
    await closeSheet();
  }],
  ['mata kuliah', async ({ more, shot, scroll }) => {
    await more('Mata kuliah');
    await shot('20-mata-kuliah');
    await scroll('end');
    await shot('21-mata-kuliah-bawah');
  }],
  ['mata kuliah tidak dipantau', async ({ page, shot }) => {
    await page.getByRole('main').getByRole('button', { name: /Tidak dipantau/ }).click();
    await page.waitForTimeout(300);
    await shot('22-mata-kuliah-tidak-dipantau');
  }],
  ['mata kuliah ganti nama', async ({ page, shot, closeSheet, scroll }) => {
    await scroll(0);
    await page.getByRole('button', { name: /^Ubah nama tampilan/ }).first().click();
    await page.waitForTimeout(400);
    await shot('23-sheet-ganti-nama');
    await closeSheet();
  }],
  ['mata kuliah warna', async ({ page, shot, closeSheet }) => {
    await page.getByRole('button', { name: /^Warna/ }).first().click();
    await page.waitForTimeout(400);
    await shot('24-sheet-warna');
    await closeSheet();
  }],
  ['pengaturan', async ({ more, shot, scroll }) => {
    await more('Pengaturan');
    await shot('25-pengaturan');
    await scroll(700);
    await shot('26-pengaturan-tengah');
    await scroll(1400);
    await shot('27-pengaturan-tengah-2');
    await scroll('end');
    await shot('28-pengaturan-bawah');
  }],
  ['nama panggilan', async ({ page, shot, closeSheet }) => {
    await page.getByRole('button', { name: /^Nama panggilan/ }).click();
    await page.waitForTimeout(400);
    await shot('29-sheet-nama-panggilan');
    await closeSheet();
  }],
  ['laporan bug', async ({ page, shot, closeSheet }) => {
    await page.getByRole('button', { name: /^Salin info/ }).click();
    await page.waitForTimeout(400);
    await shot('30-sheet-laporan-bug');
    await closeSheet();
  }],
  ['keluar', async ({ page, shot, closeSheet }) => {
    await page.getByRole('button', { name: /^Keluar dan hapus/ }).click();
    await page.waitForTimeout(400);
    await shot('31-sheet-keluar');
    await closeSheet();
  }],
  ['bantuan', async ({ page, more, btn, shot }) => {
    await more('Bantuan');
    await shot('32-bantuan');
    await btn(/Kapan data/).click();
    await page.waitForTimeout(350);
    await shot('33-bantuan-terbuka');
    await page.getByRole('searchbox').fill('zzzz');
    await shot('34-bantuan-cari-kosong');
  }],
  ['tentang', async ({ more, shot, scroll }) => {
    await more('Tentang');
    await shot('35-tentang');
    await scroll('end');
    await shot('35b-tentang-bawah');
  }],
  ['privasi', async ({ more, shot, scroll }) => {
    await more('Privasi');
    await shot('36-privasi');
    await scroll(900);
    await shot('36b-privasi-tengah');
  }],
  ['layar dev', async ({ page, shot }) => {
    await page.evaluate(() => window.dispatchEvent(new Event('sulo:dev')));
    await page.waitForTimeout(400);
    await shot('37-layar-dev');
  }],
];

const one = (name, file, run) => [[name, async (c) => (await c.signIn(), await (run ? run(c) : null), c.shot(file))]];

try {
  for (const scheme of ['light', 'dark'].filter((s) => !only || s === only)) {
    await session(scheme, {}, MAIN);
    await session(scheme, { query: '?demo=aman' }, one('ringkasan aman', '40-ringkasan-aman'));
    await session(scheme, { query: '?demo=kosong' }, [
      ...one('ringkasan kosong', '41-ringkasan-kosong'),
      ['tugas kosong', async (c) => (await c.tab('Tugas'), c.shot('42-tugas-kosong'))],
    ]);
    await session(scheme, { query: '?session=expired' }, one('ringkasan sesi habis', '43-ringkasan-sesi-habis'));
    await session(scheme, {}, one('ringkasan offline', '44-ringkasan-offline', async (c) => {
      await c.page.context().setOffline(true);
      await c.page.waitForTimeout(400);
    }));
    await session(scheme, { query: '?presensi=none' }, one('presensi belum ada', '45-presensi-belum-ada', (c) => c.tab('Presensi')));
    await session(scheme, { query: '?presensi=slow' }, one('presensi memuat', '46-presensi-rincian-memuat', async (c) => {
      await c.tab('Presensi');
      await c.page.locator('main section.m-card .m-cover').nth(1).click();
      await c.page.waitForTimeout(200);
    }));
    for (const [mode, file] of [['wait', '47-kunci'], ['fail', '48-kunci-gagal'], ['nolock', '49-kunci-tanpa-kunci-layar']])
      await session(scheme, { query: `?lock=${mode}`, lock: true }, [[`kunci ${mode}`, async (c) => (await c.page.waitForTimeout(800), c.shot(file))]]);
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`${done.length} screenshot di ${out}`);
if (failed.length > 0) console.log(`Langkah gagal (${failed.length}):\n${failed.join('\n')}`);
console.log(findings.length > 0 ? `Temuan pola kartu:\n${findings.join('\n')}` : 'Temuan pola kartu: tidak ada.');

#!/usr/bin/env node
// The text check (brief 8, the owner's separator rule): every built page but
// the device screens (/layar/, the apps' own UI) is opened, and its visible
// text and its metadata (title, description, social card text, alt, aria-label,
// title attributes) must hold no separator between phrases; section titles,
// tile lines, the hero's sentence and button labels stay within the brief's
// budgets. The apps' own UI drawn on the page (marked data-ui-aplikasi) is
// left out, as the device screens are: its separators wait for the owner's
// separate decision. Fails with every problem listed.
//
//   node apps/landing/scripts/check-teks.mjs [--dist=<folder>]
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { chromium } from 'playwright';
import { ANGGARAN, cariPemisah, kata } from './lib/aturan-teks.mjs';
import { serve } from './lib/server.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const DIST = resolve(arg('dist', new URL('../dist', import.meta.url).pathname));

function halaman(dir) {
  const hasil = [];
  for (const nama of readdirSync(dir)) {
    const p = join(dir, nama);
    if (statSync(p).isDirectory()) {
      if (relative(DIST, p).split('/')[0] !== 'layar') hasil.push(...halaman(p));
    } else if (nama.endsWith('.html')) hasil.push(`/${relative(DIST, p)}`.replace(/index\.html$/, ''));
  }
  return hasil;
}

const site = await serve(DIST);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const masalah = [];
for (const path of halaman(DIST)) {
  await page.goto(`${site.url}${path}`, { waitUntil: 'domcontentloaded' });
  const isi = await page.evaluate(() => {
    const luar = (el) => el.closest('[data-ui-aplikasi], script, style, code, noscript, template');
    const teks = [];
    const jalan = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = jalan.nextNode(); n; n = jalan.nextNode()) {
      const t = n.textContent.replace(/\s+/g, ' ').trim();
      if (t && !luar(n.parentElement)) teks.push(t);
    }
    // Text split across elements (a title in two tones) is read as one line too.
    for (const el of document.querySelectorAll('h1, h2, h3, p, li, a, button, summary, dt, dd, figcaption')) {
      if (!luar(el)) teks.push(el.textContent.replace(/\s+/g, ' ').trim());
    }
    const meta = [document.title];
    for (const m of document.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]')) meta.push(m.getAttribute('content') ?? '');
    for (const el of document.querySelectorAll('[alt], [aria-label], [title]')) {
      if (luar(el)) continue;
      for (const a of ['alt', 'aria-label', 'title']) if (el.hasAttribute(a)) meta.push(el.getAttribute(a));
    }
    const ambil = (sel) => [...document.querySelectorAll(sel)].filter((el) => !luar(el) && el.offsetParent !== null).map((el) => el.textContent.replace(/\s+/g, ' ').trim());
    return {
      teks,
      meta,
      judulBagian: ambil('main h2'),
      ubin: ambil('.ubin-teks p'),
      pendukung: ambil('.pembuka-pendukung'),
      tombol: ambil('a.tombol, button.tombol, span.tombol').map((t) => t.replace(/\d+([.,]\d+)?\s?MB$/, '').trim()),
    };
  });
  for (const t of [...isi.teks, ...isi.meta]) {
    const p = cariPemisah(t);
    if (p) masalah.push(`${path}: pemisah "${p}" di "${t.slice(0, 90)}"`);
  }
  for (const t of isi.judulBagian) if (kata(t) > ANGGARAN.judulBagian) masalah.push(`${path}: judul bagian lebih dari ${ANGGARAN.judulBagian} kata: "${t}"`);
  for (const t of isi.ubin) if (kata(t) > ANGGARAN.keteranganUbin) masalah.push(`${path}: keterangan ubin lebih dari ${ANGGARAN.keteranganUbin} kata: "${t}"`);
  for (const t of isi.pendukung) if (t.length > ANGGARAN.pendukung) masalah.push(`${path}: kalimat pembuka lebih dari ${ANGGARAN.pendukung} karakter (${t.length})`);
  for (const t of isi.tombol) if (kata(t) > ANGGARAN.tombol) masalah.push(`${path}: tombol lebih dari ${ANGGARAN.tombol} kata: "${t}"`);
}
await browser.close();
await site.stop();
const unik = [...new Set(masalah)];
if (unik.length) {
  console.error(`check:teks: ${unik.length} masalah\n- ${unik.join('\n- ')}`);
  process.exit(1);
}
console.log(`check:teks: ${halaman(DIST).length} halaman bersih (pemisah dan anggaran teks).`);

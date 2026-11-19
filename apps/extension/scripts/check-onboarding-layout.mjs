#!/usr/bin/env node
// pnpm check:onboarding-layout (extension, Tahap 2, second layout): the
// onboarding's layout rules, measured at rest in the development build's
// preview (synthetic data), both languages, both themes.
// At two columns (1280x800, 1440x900):
//   1. the scene is 40 to 75 % of the content area's height, centred in it
//   2. the scene is 440 to 480 wide; at most 4 pieces
//   3. the mascot is in the right column, 144 (1280x800) or 160 (1440x900),
//      its left edge on the title's; its box is the same on every step
//   4. under it: 24 to the title (at most two lines), 12 to the line, 28 to
//      the actions; the right block centred on the scene's axis
//   5. the course list's card is as tall as its rows, at most 70 % of the area
// One column (900x700): mascot 120 first, the scene at most 3 pieces, the
// primary button in sight without scrolling (the actions stick to the bottom).
// Everywhere: nothing cut or ellipsized or outside the viewport, one mascot,
// no technical term in the page, and the connect scene holds no field, no
// button and no sign-in words (it is a picture, hidden from screen readers).
// "Kenapa aman?" open: centred, radius 16, nothing cut.
// Exit 1 on any finding. Usage: node scripts/check-onboarding-layout.mjs [--no-build]
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
if (!process.argv.includes('--no-build')) execFileSync('pnpm', ['exec', 'wxt', 'build', '--mode', 'development'], { cwd: root, stdio: 'ignore' });
const ext = join(root, '../../.output/chrome-mv3-dev');

const SCREENS = [
  ['intro-1', 'onboarding=1&page=0'],
  ['intro-2', 'onboarding=1&page=1'],
  ['intro-3', 'onboarding=1&page=2'],
  ['hubungkan-memeriksa', 'onboarding=2&connect=checking'],
  ['hubungkan-belum-masuk', 'onboarding=2&connect=need_login'],
  ['hubungkan-tersambung', 'onboarding=2&connect=connected'],
  ['hubungkan-gagal', 'onboarding=2&connect=failed'],
  ['menyiapkan-0', 'onboarding=2&prep=0'],
  ['menyiapkan-1', 'onboarding=2&prep=1'],
  ['menyiapkan-3', 'onboarding=2&prep=3'],
  ['menyiapkan-gagal', 'onboarding=2&prep=1&fail'],
  ['mata-kuliah', 'onboarding=3'],
  ['mata-kuliah-banyak', 'onboarding=3&many'],
  ['mata-kuliah-0', 'onboarding=3&none'],
  ['selesai', 'onboarding=4'],
  ['selesai-tanpa-tugas', 'onboarding=4&notasks'],
  ['kenapa-aman', 'onboarding=1&page=2&why'],
];
/** Words that are not for a student: storage, protocol and code names. */
const TECHNICAL = /chrome\.|storage|sesskey|token|cookie|\bAPI\b|JSON|webservice|moodle|localhost|extension id/i;
const SIGN_IN = /username|password|sign in|nama pengguna|kata sandi/i;

const measure = () => {
  const vis = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const vw = innerWidth;
  const vh = innerHeight;
  const frame = document.querySelector('.obj');
  if (!frame) return null;
  const cut = [];
  for (const el of frame.querySelectorAll('h1, p, span, button, label, li')) {
    // Rows scrolled inside the course list's card are not cut, just scrolled.
    if (!vis(el) || el.closest('.obj-list')) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') cut.push(`terpotong: "${el.textContent.trim().slice(0, 30)}"`);
    if (r.left < -0.5 || r.right > vw + 0.5) cut.push(`di luar layar: "${el.textContent.trim().slice(0, 30)}"`);
  }
  const scene = frame.querySelector('.obj-swap');
  const stage = frame.querySelector('[data-ob-stage]');
  const pieces = scene ? [...scene.querySelectorAll(':scope > .obj-scene > *')].filter(vis).length : 0;
  for (const el of [...frame.querySelectorAll('.obj-swap, [data-onb-mascot], .obj-actions')].filter(vis)) {
    const r = el.getBoundingClientRect();
    if (r.bottom > vh + 0.5 || r.top < -0.5) cut.push(`keluar dari layar: ${el.matches('[data-onb-mascot]') ? 'maskot' : el.className.split(' ')[0]}`);
  }
  const list = frame.querySelector('.obj-list');
  let listSlack = null;
  if (list && vis(list)) {
    const kids = [...list.children].filter(vis);
    const lastBottom = Math.max(...kids.map((k) => k.getBoundingClientRect().bottom));
    const pad = parseFloat(getComputedStyle(list).paddingBottom);
    listSlack = list.scrollHeight > list.clientHeight + 1 ? 0 : Math.round(list.getBoundingClientRect().bottom - lastBottom - pad);
  }
  const text = frame.querySelector('.obj-text');
  const blocks = text ? [...text.children].filter(vis).map(box) : [];
  const dialog = document.querySelector('[data-slot="alert-dialog-content"]');
  if (dialog) {
    for (const el of dialog.querySelectorAll('h2, p, span, button, li')) {
      if (!vis(el)) continue;
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') cut.push(`terpotong di dialog: "${el.textContent.trim().slice(0, 30)}"`);
    }
  }
  return {
    vw,
    vh,
    cut,
    mascots: document.querySelectorAll('.m-face').length,
    mascot: box(frame.querySelector('[data-onb-mascot]')),
    scene: box(scene),
    stage: box(stage),
    pieces,
    title: box(frame.querySelector('#ob-title')),
    line: box(frame.querySelector('.obj-line')),
    actions: box(frame.querySelector('.obj-actions')),
    primary: box(frame.querySelector('.obj-actions [data-variant="default"]')),
    blockBottom: blocks.length ? Math.max(...blocks.map((b) => b.bottom)) : null,
    listSlack,
    list: box(list),
    pageText: document.body.innerText,
    stageText: stage?.innerText ?? '',
    stageControls: stage ? stage.querySelectorAll('input, textarea, select, button, a, [role="button"], [tabindex]').length : 0,
    stageHidden: stage?.getAttribute('aria-hidden') === 'true',
    stageCursor: stage ? getComputedStyle(stage.querySelector('.obj-scene') ?? stage).cursor : null,
    dialog: dialog ? { ...box(dialog), radius: parseFloat(getComputedStyle(dialog).borderTopLeftRadius) } : null,
  };
};

const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost'] });
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const findings = [];
let measured = 0;
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
for (const [w, h] of [[1280, 800], [1440, 900], [1024, 768], [900, 700]]) {
  const two = w >= 1024;
  const full = w >= 1280;
  const wantMascot = !two ? 120 : h >= 860 ? 160 : 144;
  for (const lang of ['id', 'en']) {
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      let first = null;
      for (const [name, query] of SCREENS) {
        await page.goto(`chrome-extension://${id}/preview.html?${query}&theme=${theme}&lang=${lang}`);
        await page.waitForTimeout(700);
        const m = await page.evaluate(measure);
        const tag = `${w}x${h} ${lang} ${theme} ${name}`;
        measured += 1;
        if (!m) {
          findings.push(`${tag}: kerangka onboarding tidak ditemukan`);
          continue;
        }
        const area = h - 64 - 40;
        // One column scrolls: only two columns must fit the window.
        for (const c of m.cut) if (two || !c.startsWith('keluar dari layar')) findings.push(`${tag}: ${c}`);
        // Each Mascot draws one face (two layers at most): more than two faces is a second mascot.
        if (m.mascots > 2) findings.push(`${tag}: lebih dari satu maskot`);
        const term = m.pageText.match(TECHNICAL);
        if (term) findings.push(`${tag}: istilah teknis "${term[0]}"`);
        if (name.startsWith('hubungkan')) {
          if (m.stageControls > 0) findings.push(`${tag}: adegan Hubungkan memuat ${m.stageControls} kontrol`);
          const word = m.stageText.match(SIGN_IN);
          if (word) findings.push(`${tag}: adegan Hubungkan memuat "${word[0]}"`);
          if (!m.stageHidden) findings.push(`${tag}: adegan Hubungkan tidak aria-hidden`);
          if (m.stageCursor !== 'default') findings.push(`${tag}: kursor adegan ${m.stageCursor}`);
        }
        if (name === 'kenapa-aman') {
          if (!m.dialog) findings.push(`${tag}: dialog tidak terbuka`);
          else {
            if (!near(m.dialog.left + m.dialog.width / 2, w / 2, 1) || !near(m.dialog.top + m.dialog.height / 2, h / 2, 1)) findings.push(`${tag}: dialog tidak di tengah layar`);
            if (m.dialog.radius !== 16) findings.push(`${tag}: radius dialog ${m.dialog.radius}`);
          }
          continue;
        }
        // The mascot: its size; the same box on every step.
        if (!m.mascot) {
          findings.push(`${tag}: maskot tidak ada`);
          continue;
        }
        if (Math.round(m.mascot.width) !== wantMascot) findings.push(`${tag}: maskot ${Math.round(m.mascot.width)} px, seharusnya ${wantMascot}`);
        const mbox = [m.mascot.left, m.mascot.top, m.mascot.width].map(Math.round).join(',');
        if (two) {
          first ??= mbox;
          if (mbox !== first) findings.push(`${tag}: kotak maskot ${mbox}, langkah pertama ${first}`);
        }
        if (m.pieces > (two ? 4 : 3)) findings.push(`${tag}: ${m.pieces} elemen di adegan (paling banyak ${two ? 4 : 3})`);
        if (m.title && m.title.height > 2 * 38 + 1) findings.push(`${tag}: judul lebih dari dua baris`);
        if (!two) {
          if (m.scene && m.title && m.scene.top < m.title.bottom) findings.push(`${tag}: satu kolom, adegan di atas judul`);
          if (m.mascot.top > (m.title?.top ?? 0)) findings.push(`${tag}: satu kolom, maskot tidak paling atas`);
          // The page may scroll, but the primary button is in sight from the start.
          if (m.primary && (m.primary.bottom > h + 0.5 || m.primary.top < 0)) findings.push(`${tag}: satu kolom, tombol utama terpotong tepi bawah`);
          continue;
        }
        if (!full) continue;
        // Two columns.
        if (m.stage && m.mascot.left < m.stage.right) findings.push(`${tag}: maskot tidak di kolom kanan`);
        if (m.title && !near(m.mascot.left, m.title.left)) findings.push(`${tag}: tepi kiri maskot ${Math.round(m.mascot.left)}, judul ${Math.round(m.title.left)}`);
        if (m.title && !near(m.title.top - m.mascot.bottom, 24)) findings.push(`${tag}: maskot ke judul ${Math.round(m.title.top - m.mascot.bottom)} px (24)`);
        if (m.title && m.line && !near(m.line.top - m.title.bottom, 12)) findings.push(`${tag}: judul ke pendukung ${Math.round(m.line.top - m.title.bottom)} px (12)`);
        if (m.line && m.actions && !near(m.actions.top - m.line.bottom, 28)) findings.push(`${tag}: pendukung ke aksi ${Math.round(m.actions.top - m.line.bottom)} px (28)`);
        if (m.scene) {
          const share = m.scene.height / area;
          if (share < 0.4 || share > 0.75) findings.push(`${tag}: adegan ${(share * 100).toFixed(0)}% tinggi area (40 sampai 75)`);
          if (m.scene.width < 440 - 0.5 || m.scene.width > 480 + 0.5) findings.push(`${tag}: lebar adegan ${Math.round(m.scene.width)} (440 sampai 480)`);
          const sceneMid = m.scene.top + m.scene.height / 2;
          if (!near(sceneMid, 64 + area / 2, 2)) findings.push(`${tag}: adegan tidak di tengah area (${Math.round(sceneMid)} vs ${Math.round(64 + area / 2)})`);
          // A step with actions has the usual block; a shorter one (Menyiapkan Sulo) keeps the mascot's place.
          const blockMid = (m.mascot.top + m.blockBottom) / 2;
          if (m.actions && Math.abs(blockMid - sceneMid) > 48) findings.push(`${tag}: blok kanan ${Math.round(blockMid - sceneMid)} px dari sumbu adegan`);
        }
        if (m.listSlack !== null && m.listSlack > 2) findings.push(`${tag}: kartu daftar ${m.listSlack} px lebih tinggi dari isinya`);
        if (m.list && m.list.height > area * 0.7 + 1) findings.push(`${tag}: kartu daftar ${Math.round(m.list.height)} px, lebih dari 70% area`);
      }
    }
  }
}
await ctx.close();
for (const e of errors) findings.push(`galat halaman: ${e}`);
if (findings.length) {
  console.log(`check-onboarding-layout (ekstensi): ${findings.length} temuan`);
  for (const f of findings) console.log(f);
  process.exit(1);
}
console.log(`check-onboarding-layout (ekstensi): bersih (${measured} layar diukur, dua bahasa, dua tema, empat ukuran).`);

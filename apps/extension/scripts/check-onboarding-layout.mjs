#!/usr/bin/env node
// pnpm check:onboarding-layout (extension, Tahap 2): the onboarding's layout
// rules, measured at rest in the development build's preview (synthetic data)
// at 1280x800 and 1440x900, both languages, both themes:
//   1. no vertical gap over 72 px between two visible things, top to bottom
//   2. the scene takes at least 70 % of its stage's height
//   3. nothing cut or ellipsized, nothing outside the viewport
//   4. one mascot on the page
//   5. at two columns the stage is 50 to 60 % of the content's width
//   6. the intro's scenes: the big mascot under the pieces, 184 at 1280x800 and
//      200 at 1440x900, 20 to 28 px under the last piece
// 1024x768 and 900x700 (one column below 1024) are measured for rule 3 and 4.
// "Menyiapkan Sulo" and the done step are a small group around the mascot
// in the middle of the stage (as on the phone's screens 5 and 9), so rules 1
// and 2 do not apply to them.
// Exit 1 on any finding. Usage: node scripts/check-onboarding-layout.mjs [--no-build]
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
if (!process.argv.includes('--no-build')) execFileSync('pnpm', ['exec', 'wxt', 'build', '--mode', 'development'], { cwd: root, stdio: 'ignore' });
const ext = join(root, '../../.output/chrome-mv3-dev');
const GAP_MAX = 72;
const SCENE_MIN = 0.7;

const SCREENS = [
  ['intro-1', 'onboarding=1&page=0', true],
  ['intro-2', 'onboarding=1&page=1', true],
  ['intro-3', 'onboarding=1&page=2', true],
  ['hubungkan', 'onboarding=2&connect=waiting', true],
  ['hubungkan-gagal', 'onboarding=2&connect=failed', true],
  ['menyiapkan', 'onboarding=2&prep=2', false],
  ['mata-kuliah', 'onboarding=3', true],
  ['mata-kuliah-banyak', 'onboarding=3&many', true],
  ['selesai', 'onboarding=4', false],
];

const measure = () => {
  const vis = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const vh = innerHeight;
  const vw = innerWidth;
  const frame = document.querySelector('.obj');
  if (!frame) return null;
  const things = [...frame.querySelectorAll('.obj-top > *, .obj-scene:not(.obj-scene-list) > *, .obj-scene-list, .obj-text h1, .obj-text p, .obj-text button, .obj-foot, [data-onb-mascot]')].filter(vis);
  const rects = things.map((el) => el.getBoundingClientRect()).map((r) => ({ top: Math.max(0, r.top), bottom: Math.min(vh, r.bottom) })).filter((r) => r.bottom > r.top).sort((a, b) => a.top - b.top);
  let reach = 0;
  let gap = 0;
  let gapAt = 0;
  for (const r of rects) {
    if (r.top - reach > gap) {
      gap = r.top - reach;
      gapAt = reach;
    }
    reach = Math.max(reach, r.bottom);
  }
  if (vh - reach > gap) {
    gap = vh - reach;
    gapAt = reach;
  }
  let scene = null;
  const stage = frame.querySelector('[data-ob-stage]');
  if (stage) {
    const s = stage.getBoundingClientRect();
    const pieces = [...stage.querySelectorAll('.obj-scene:not(.obj-scene-list) > *, .obj-scene-list')].filter(vis).map((el) => el.getBoundingClientRect());
    const m = frame.querySelector('[data-onb-mascot]');
    if (m) pieces.push(m.getBoundingClientRect());
    if (pieces.length) {
      const top = Math.max(s.top, Math.min(...pieces.map((r) => r.top)));
      const bottom = Math.min(s.bottom, Math.max(...pieces.map((r) => r.bottom)));
      scene = (bottom - top) / s.height;
    }
  }
  const cut = [];
  for (const el of frame.querySelectorAll('h1, p, span, button, label, li')) {
    // Rows scrolled inside the course list's card are not cut, just scrolled.
    if (!vis(el) || el.closest('.obj-scene-list')) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') cut.push(`terpotong: "${el.textContent.trim().slice(0, 30)}"`);
    if (r.left < -0.5 || r.right > vw + 0.5) cut.push(`di luar layar: "${el.textContent.trim().slice(0, 30)}"`);
  }
  const main = frame.querySelector('.obj-main');
  const stageW = stage ? stage.getBoundingClientRect().width / main.getBoundingClientRect().width : null;
  const flyer = frame.querySelector('[data-onb-mascot]');
  const slot = frame.querySelector('.obj-scene > [data-mascot-slot]');
  let underGap = null;
  if (slot) {
    const before = [...slot.parentElement.children].filter((el) => el !== slot && vis(el));
    const lastBottom = Math.max(...before.map((el) => el.getBoundingClientRect().bottom));
    underGap = Math.round(slot.getBoundingClientRect().top - lastBottom);
  }
  // The mascot and the scene's pieces inside the window (a scene taller than its stage pushes them out).
  for (const el of [...frame.querySelectorAll('.obj-scene:not(.obj-scene-list) > *, .obj-scene-list, [data-onb-mascot]')].filter(vis)) {
    const r = el.getBoundingClientRect();
    if (r.bottom > vh + 0.5 || r.top < -0.5) cut.push(`keluar dari layar: ${el.matches('[data-onb-mascot]') ? 'maskot' : `"${el.textContent.trim().slice(0, 24)}"`}`);
  }
  return { gap: Math.round(gap), gapAt: Math.round(gapAt), scene, cut, mascots: document.querySelectorAll('.m-face').length, stageW, mascotSize: flyer ? Math.round(flyer.getBoundingClientRect().width) : null, underGap };
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
for (const [w, h] of [[1280, 800], [1440, 900], [1024, 768], [900, 700]]) {
  const full = w >= 1280;
  for (const lang of ['id', 'en']) {
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      for (const [name, query, rules] of SCREENS) {
        await page.goto(`chrome-extension://${id}/preview.html?${query}&theme=${theme}&lang=${lang}`);
        await page.waitForTimeout(700);
        const m = await page.evaluate(measure);
        const tag = `${w}x${h} ${lang} ${theme} ${name}`;
        measured += 1;
        if (!m) {
          findings.push(`${tag}: kerangka onboarding tidak ditemukan`);
          continue;
        }
        if (full && rules && m.gap > GAP_MAX) findings.push(`${tag}: celah ${m.gap} px (mulai y=${m.gapAt})`);
        if (full && rules && m.scene !== null && m.scene < SCENE_MIN) findings.push(`${tag}: adegan ${(m.scene * 100).toFixed(0)}% panggung`);
        if (full && m.stageW !== null && (m.stageW < 0.5 || m.stageW > 0.6)) findings.push(`${tag}: panggung ${(m.stageW * 100).toFixed(0)}% lebar isi`);
        if (full && name.startsWith('intro')) {
          const want = h >= 860 ? 200 : 184;
          if (m.mascotSize !== want) findings.push(`${tag}: maskot ${m.mascotSize} px, seharusnya ${want}`);
          if (m.underGap === null || m.underGap < 20 || m.underGap > 28) findings.push(`${tag}: jarak ke maskot ${m.underGap} px (20 sampai 28)`);
        }
        for (const c of m.cut) if (full || !c.startsWith('keluar dari layar')) findings.push(`${tag}: ${c}`);
        // Each Mascot draws one face (two layers at most): more than two faces is a second mascot.
        if (m.mascots > 2) findings.push(`${tag}: lebih dari satu maskot`);
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

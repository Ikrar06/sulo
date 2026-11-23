#!/usr/bin/env node
// pnpm check:onboarding-layout: the onboarding's layout rules, measured on
// every screen at rest (M8c.2).
//   1. no vertical gap over 72 px between two visible elements in a row,
//      at 360x800 and 384x832 (the nickname screen with the keyboard up,
//      emulated by a viewport 300 px shorter; the 1.6 s splash, a logo
//      alone in the middle, is exempt)
//   2. the scene takes at least 70 % of the stage's height (the splash,
//      which is the mascot and the name alone for 1.6 s, is exempt)
//   3. the scene's scale is exactly 1 at 360x800 and 384x832, and never
//      below 0.8 anywhere (360x640, and 384x832 with text at 130 %)
//   4. nothing is cut or ellipsized: no text wider than its box, nothing
//      outside the viewport, the primary button at the same place on every
//      screen
//   7. the nickname screen with the keyboard up: the title, the field and
//      the primary button all show at once, with nothing to scroll
//   6. the mascot is the same size at the same place on the three setup
//      screens (6, 7, 8); every scene piece keeps 16 px from the screen's
//      edges
//   Every special state too (onboarding-walk.mjs SPECIAL: sign-in closed,
//   no connection, sync failed, none ticked, no name, watching not
//   allowed, a different account).
//   Screens 5, 9 and the different-account question are a small group around the mascot in the middle of
//   the stage (the owner's later instruction), so rules 1 and 2 do not
//   apply to them.
//   5. never two mascots; the mascot's drawing (both flame layers and the
//      face) stays inside its box at every size and, on the sign-in screen,
//      for every expression
// Both languages. Exit 1 on any finding.
import { MASCOTS, openPage, SPECIAL, startServer, walk } from './onboarding-walk.mjs';

const PORT = 5179;
const GAP_MAX = 72;
const SCENE_MIN = 0.7;
const { browser, stop } = await startServer(PORT);
const findings = [];
const notes = [];

const measure = () => {
  const vis = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const live = (el) => !el.closest('[data-onb-leaving]');
  const frame = [...document.querySelectorAll('.onb-frame')].find(live);
  if (!frame) return null;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  // Visible things, top to bottom: scene pieces, the mascot, texts, controls.
  const things = [...frame.querySelectorAll('[data-onb-piece], h1, p, button, input, label, [role="progressbar"], [role="tablist"], [role="status"], .m-card')].filter((el) => live(el) && vis(el));
  const mascot = document.querySelector('[data-onb-mascot]');
  const rects = [...things, ...(mascot ? [mascot] : [])].map((el) => el.getBoundingClientRect()).filter((r) => r.right > 0 && r.left < vw).map((r) => ({ top: Math.max(0, r.top), bottom: Math.min(vh, r.bottom) })).filter((r) => r.bottom > r.top).sort((a, b) => a.top - b.top);
  let reach = 0;
  let gap = 0;
  let gapAt = 0;
  for (const r of rects) {
    if (r.top - reach > gap) { gap = r.top - reach; gapAt = reach; }
    reach = Math.max(reach, r.bottom);
  }
  if (vh - reach > gap) { gap = vh - reach; gapAt = reach; }
  // The scene against its stage.
  const stage = [...frame.querySelectorAll('[data-onb-stage]')].find(vis);
  let scene = null;
  if (stage) {
    const s = stage.getBoundingClientRect();
    const pieces = [...stage.querySelectorAll('[data-onb-piece]')].filter(vis).map((el) => el.getBoundingClientRect()).filter((r) => r.right > 0 && r.left < vw);
    if (mascot) pieces.push(mascot.getBoundingClientRect());
    const top = Math.max(s.top, Math.min(...pieces.map((r) => r.top)));
    const bottom = Math.min(s.bottom, Math.max(...pieces.map((r) => r.bottom)));
    scene = { share: (bottom - top) / s.height, scale: Number(stage.dataset.onbScale ?? 1), compact: stage.hasAttribute('data-onb-compact'), stageH: Math.round(s.height) };
  }
  // Text cut or ellipsized, things outside the viewport.
  const cut = [];
  for (const el of frame.querySelectorAll('h1, p, span, button, label')) {
    if (!live(el) || !vis(el) || el.closest('[data-onb-scene]')) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') cut.push(`terpotong: "${el.textContent.trim().slice(0, 30)}"`);
    if (r.left < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5) cut.push(`di luar layar: "${el.textContent.trim().slice(0, 30)}"`);
  }
  // Scene text must never be ellipsized either (the address above all).
  for (const el of frame.querySelectorAll('[data-onb-scene] .truncate')) if (live(el) && vis(el) && el.scrollWidth > el.clientWidth + 1) cut.push(`elipsis di adegan: "${el.textContent.trim().slice(0, 30)}"`);
  if (mascot) {
    const box = mascot.getBoundingClientRect();
    const k = box.width / 176;
    let out = 0;
    for (const el of mascot.querySelectorAll('.sm-back, .sm-front, .sm-face')) {
      const r = el.getBoundingClientRect();
      out = Math.max(out, (box.left - r.left) / k, (r.right - box.right) / k, (box.top - r.top) / k, (r.bottom - box.bottom) / k);
    }
    if (out > 2) cut.push(`gambar maskot keluar ${out.toFixed(1)} px dari wadahnya`);
    if (getComputedStyle(mascot).opacity !== '0' && (box.left < -0.5 || box.right > vw + 0.5 || box.bottom > vh + 0.5 || box.top < -0.5)) cut.push('maskot keluar dari layar');
  }
  // Scene pieces keep 16 px from the screen's edges.
  for (const el of frame.querySelectorAll('[data-onb-piece]')) {
    if (!live(el) || !vis(el) || el.closest('[data-pg="page"]')?.style.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.right < 0 || r.left > vw) continue;
    if (r.left < 15.5 || r.right > vw - 15.5) cut.push(`keping ${Math.round(Math.min(r.left, vw - r.right))} px dari tepi: "${el.textContent.trim().slice(0, 20)}"`);
  }
  const mbox = mascot ? mascot.getBoundingClientRect() : null;
  const primary = [...frame.querySelectorAll('button.h-13')].find(vis);
  // The nickname screen with the keyboard up: title, field and button at once, no scrolling.
  let keyboardFit = null;
  const field = frame.querySelector('input');
  if (field) {
    const sc = frame.querySelector('.onb-scroll');
    const shows = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.top >= -0.5 && r.bottom <= vh + 0.5 && r.height > 0;
    };
    keyboardFit = { scrolls: sc ? sc.scrollHeight > sc.clientHeight + 1 : false, title: shows(frame.querySelector('h1')), field: shows(field), button: shows([...frame.querySelectorAll('button.h-13')].find(vis)) };
  }
  return { keyboardFit, mascot: mbox ? [Math.round(mbox.left), Math.round(mbox.top), Math.round(mbox.width)].join(',') : null, gap: Math.round(gap), gapAt: Math.round(gapAt), scene, cut, primaryTop: primary ? Math.round(vh - primary.getBoundingClientRect().top) : null };
};

const CASES = [
  { width: 360, height: 800, rules: ['gap', 'scene', 'scale1'] },
  { width: 384, height: 832, rules: ['gap', 'scene', 'scale1'] },
  { width: 360, height: 640, rules: ['scale08'] },
  { width: 384, height: 832, zoom: 1.3, rules: ['scale08'] },
];
try {
  // The main flow, then every special state (only the screens it is about).
  // ONLY=label runs one special state (a quick recheck).
  const VARIANTS = process.env.ONLY ? SPECIAL.filter(([l]) => l === process.env.ONLY) : [['', '', {}, null], ...SPECIAL];
  for (const lang of ['id', 'en'])
    for (const c of CASES)
      for (const [label, query, opts, keep] of VARIANTS) {
      const tag = `${lang} ${c.width}x${c.height}${c.zoom ? ' font 130%' : ''}${label ? ` [${label}]` : ''}`;
      const { context, page } = await openPage(browser, PORT, { ...c, lang, reduced: true, query });
      process.stderr.write(`${tag}\n`);
      const primaryTops = new Set();
      const setupMascots = new Set();
      await walk(
        page,
        async (name) => {
          if (name.startsWith('10')) return;
          if (keep && !keep.some((k) => name.startsWith(`${k}-`))) return;
          const m = await page.evaluate(measure);
          if (!m) return void findings.push(`${tag} ${name}: kerangka tidak ditemukan`);
          const mascots = await page.evaluate(MASCOTS);
          // A short phone with the keyboard up: the nickname screen scrolls and the mascot steps out with its spot.
          const steppedOut = name.startsWith('7') && mascots === 0;
          if (name.startsWith('7') && m.keyboardFit) {
            const k = m.keyboardFit;
            if (k.scrolls) findings.push(`${tag} ${name}: dengan keyboard, isi harus digulir`);
            if (!k.title || !k.field || !k.button) findings.push(`${tag} ${name}: dengan keyboard, tidak terlihat sekaligus (judul ${k.title}, kolom ${k.field}, tombol ${k.button})`);
          }
          if (mascots !== 1 && !steppedOut) findings.push(`${tag} ${name}: ${mascots} maskot terlihat`);
          for (const x of m.cut) findings.push(`${tag} ${name}: ${x}`);
          if (m.primaryTop !== null) primaryTops.add(m.primaryTop);
          // (On a short phone the nickname screen scrolls under the keyboard: its mascot is where the scroll put it.)
          if (/^[678]-/.test(name) && m.mascot && !steppedOut && !(c.height < 700 && name.startsWith('7'))) setupMascots.add(m.mascot);
          const centered = /^(5|9|11)-/.test(name);
          if (c.rules.includes('gap') && !name.startsWith('0') && !centered && m.gap > GAP_MAX) findings.push(`${tag} ${name}: celah ${m.gap} px (mulai y=${m.gapAt})`);
          if (m.scene) {
            if (c.rules.includes('scene') && !name.startsWith('0') && !centered && m.scene.share < SCENE_MIN) findings.push(`${tag} ${name}: adegan ${(m.scene.share * 100).toFixed(0)}% dari panggung`);
            if (c.rules.includes('scale1') && Math.abs(m.scene.scale - 1) > 0.001) findings.push(`${tag} ${name}: skala adegan ${m.scene.scale}`);
            if (m.scene.scale < 0.8 - 0.001) findings.push(`${tag} ${name}: skala adegan ${m.scene.scale} di bawah 0,8`);
          }
          // Every expression, on one screen per size: the drawing never leaves its box.
          if (name.startsWith('4')) {
            const worst = await page.evaluate(async () => {
              const holder = document.querySelector('[data-onb-mascot]');
              const res = [];
              for (const n of ['neutral', 'happy', 'lookUp', 'lookLeft', 'lookRight', 'lookDown', 'proud', 'busy', 'sad', 'celebrate', 'wink', 'surprised']) {
                window.__suloMascot.express(n);
                await new Promise((r) => setTimeout(r, 120));
                const box = holder.getBoundingClientRect();
                const k = box.width / 176;
                let out = 0;
                for (const el of holder.querySelectorAll('.sm-back, .sm-front, .sm-face')) {
                  const r = el.getBoundingClientRect();
                  out = Math.max(out, (box.left - r.left) / k, (r.right - box.right) / k, (box.top - r.top) / k, (r.bottom - box.bottom) / k);
                }
                if (out > 2) res.push(`${n} ${out.toFixed(1)} px`);
              }
              window.__suloMascot.express('neutral');
              return res;
            });
            for (const x of worst) findings.push(`${tag} ${name}: ekspresi ${x} keluar dari wadah maskot`);
          }
          notes.push(`${tag} ${name}: celah terbesar ${m.gap}${m.scene ? `, adegan ${(m.scene.share * 100).toFixed(0)}% skala ${m.scene.scale}${m.scene.compact ? ' (ringkas)' : ''}` : ''}`);
        },
        { ...opts, lang, keyboard: 300, slow: 0.35 },
      );
      if (setupMascots.size > 1) findings.push(`${tag}: maskot berpindah di layar 6-8 (${[...setupMascots].join(' | ')})`);
      if (primaryTops.size > 1) findings.push(`${tag}: tombol utama berpindah (${[...primaryTops].join(', ')} px dari bawah)`);
      await context.close();
    }
} finally {
  await stop();
}
if (process.argv.includes('--verbose')) console.log(notes.join('\n'));
if (findings.length > 0) {
  console.error(`check-onboarding-layout: ${findings.length} temuan\n${findings.join('\n')}`);
  process.exit(1);
}
console.log(`check-onboarding-layout: bersih (${notes.length} layar diukur, dua bahasa, empat ukuran).`);

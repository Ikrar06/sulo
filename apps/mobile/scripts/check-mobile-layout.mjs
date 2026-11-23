#!/usr/bin/env node
// pnpm check:mobile-layout: every screen and state of the Android app, across
// phone widths and heights, Android's font size setting, both languages, both
// themes and both performance tiers, checked by measurement rather than by eye.
//
// Font size: the app hands Android's setting to the WebView as its text zoom,
// as it is (MainActivity.textZoom). Measured on the emulator (23 Nov 2026,
// WebView 113): text zoom multiplies every font size and every line height
// (15/20 px became 19.5/26 at 1.3 and 30/40 at 2.0) and nothing else: rem and
// em lengths keep their unzoomed size (10rem stays 160 px, 2em at 15 px stays
// 30 px). Desktop
// Chromium has no switch for that, so the page does the same itself: each
// element gets its own computed font size and line height times the factor,
// all at once, from the unscaled page (applyTextZoom below). One known gap: an
// em length grows with it here and not on the phone (the app uses rem).
//
// Safe areas: the status bar with its punch hole (48 dp) and the gesture bar
// (24 dp), through the browser's own safe-area insets, as on a phone.
//
// A state fails when, at any size and scale:
//   - something sticks out of its box (a card, a pill, a button, a sheet),
//   - the page or the screen scrolls sideways,
//   - text is cut off where the layout never meant to cut it (no ellipsis or
//     line clamp),
//   - two cards, or two pieces of text, lie over each other,
//   - a control's touch target is under 44 dp,
//   - text or a control lies under the status bar or the gesture bar.
//
// From a production build of the web mode (the synthetic demo account), served
// locally; every other host is unreachable. Clock fixed, motion reduced.
// Shots of failures: <out>/<state>/<lang>-<theme>-<tier>-<w>x<h>-<scale>.png
//
// Usage: node scripts/check-mobile-layout.mjs [--no-build] [--out=<dir>] [--ci]
//   [--only=<text in the state name>] [--json=<file>] [--dist=<dir>] [--port=<n>] [--time]
//   --ci  a shorter matrix for CI: widths 300, 360, 412, 600; heights 640;
//         scales 1, 1.3, 2; both languages; light/full.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { MOBILE, ROOT } from './env.mjs';
import { loadWords } from './lib/words.mjs';
import { SPECIAL, walk } from './onboarding-walk.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const has = (name) => process.argv.includes(`--${name}`);
const CI = has('ci');
const only = arg('only', null)?.split(',') ?? null;
const out = resolve(process.env.INIT_CWD ?? process.cwd(), arg('out', join(ROOT, 'docs/uji-layout/sebelum')));
const jsonOut = arg('json', null);

const WIDTHS = CI ? [300, 360, 412, 600] : [300, 320, 360, 384, 412, 430, 480, 600, 700];
const HEIGHTS = CI ? [640] : [640, 915];
const SCALES = CI ? [1, 1.3, 2] : [0.85, 1, 1.15, 1.3, 1.5, 2];
const LANGS = ['en', 'id'];
// Each value of each axis: light with the full tier, dark with the lite tier. Theme changes colours only and the
// tier motion only, so a pairing covers both without doubling the run.
const LOOKS = CI ? [['light', 'full']] : [['light', 'full'], ['dark', 'lite']];
const SAFE = { top: 48, bottom: 24 };
const TOUCH = 44;
const PORT = Number(arg('port', '5195'));
const DIST = resolve(ROOT, arg('dist', '.output/layout-mobile-web'));
const NOW = new Date('2026-11-18T10:00:00+08:00');
const OFFLINE = '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost';
const log = (m) => process.stderr.write(`check-mobile-layout: ${m}\n`);

if (!has('no-build')) {
  log('build web mode (production)');
  execFileSync('pnpm', ['exec', 'vite', 'build', '--mode', 'web', '--outDir', DIST, '--emptyOutDir', '--logLevel', 'warn'], { cwd: MOBILE, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, GITHUB_SHA: 'layout00' } });
}
const WORDS = await loadWords();
const server = spawn('pnpm', ['exec', 'vite', 'preview', '--mode', 'web', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
await new Promise((ok) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && ok()));
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: [OFFLINE] });

/**
 * In the page: Android's text zoom. Every text size of the app is a text-m* token, calc(px * var(--m-tz)) for the
 * size and the line height (src/tokens.css; check-type-tokens.mjs keeps it so), which is the app's own way to
 * emulate the setting (web-shots.mjs). Components that measure their text see the scaled size, as on the phone.
 */
const applyTextZoom = (f) => document.documentElement.style.setProperty('--m-tz', String(f));

/** In the page: the findings of the state as it stands. */
const FIND = ({ safe, touch }) => {
  const found = [];
  const vw = innerWidth;
  const vh = innerHeight;
  // Opacity is not inherited: an element is invisible when any ancestor is fully transparent.
  const clear = new Map();
  const transparent = (el) => {
    if (!el || el === document.documentElement) return false;
    if (clear.has(el)) return clear.get(el);
    const v = Number(getComputedStyle(el).opacity) === 0 || transparent(el.parentElement);
    clear.set(el, v);
    return v;
  };
  const shown = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || transparent(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const say = (kind, el, detail) => {
    const text = (el?.getAttribute?.('aria-label') || el?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70);
    found.push({ kind, text, detail });
  };
  // A dialog on top: only it is checked.
  const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter(shown);
  const scope = dialogs.at(-1) ?? document.body;
  const inScope = (el) => scope.contains(el);
  // A long list's rows off screen are not laid out (content-visibility: auto, LongList.tsx): they only hold a
  // stand-in height until they come into view, so what they report is not their layout.
  const skipped = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (getComputedStyle(e).contentVisibility !== 'auto') continue;
      const r = e.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return true;
    }
    return false;
  };
  // Pieces kept for screen readers only, decorative layers and the mascot are not layout.
  const ignored = (el) => el.closest('.sr-only, [data-layout-free], svg') !== null || skipped(el);
  const fixedOf = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const p = getComputedStyle(e).position;
      if (p === 'fixed' || p === 'sticky') return e;
    }
    return null;
  };
  /** The part of the screen an element can show: cut by every ancestor that hides its overflow (a line clamp hides lines past it). */
  // `now`: what shows at the current scroll (a scroller cuts too); without it, what can be reached by scrolling.
  const clipOf = (el, now = false) => {
    let c = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 };
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      // A box that hides its overflow cuts what shows; a scroller only cuts what shows right now.
      const cuts = (v) => v === 'hidden' || v === 'clip' || (now && (v === 'auto' || v === 'scroll'));
      const hx = cuts(cs.overflowX), hy = cuts(cs.overflowY);
      if (!hx && !hy) continue;
      const r = e.getBoundingClientRect();
      c = { left: hx ? Math.max(c.left, r.left) : c.left, right: hx ? Math.min(c.right, r.right) : c.right, top: hy ? Math.max(c.top, r.top) : c.top, bottom: hy ? Math.min(c.bottom, r.bottom) : c.bottom };
    }
    return c;
  };
  /** The text's line boxes that can be seen, cut to what the element's ancestors show. */
  const textRects = (el, now = false) => {
    const rects = [];
    const c = clipOf(el, now);
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const x of r.getClientRects()) {
        const left = Math.max(x.left, c.left), right = Math.min(x.right, c.right), top = Math.max(x.top, c.top), bottom = Math.min(x.bottom, c.bottom);
        if (right - left > 0.5 && bottom - top > 0.5) rects.push({ left, right, top, bottom, width: right - left, height: bottom - top });
      }
    }
    return rects;
  };
  const leaves = [...scope.querySelectorAll('*')].filter((el) => inScope(el) && !ignored(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && shown(el));

  // Sideways scrolling: the page, or <main>.
  const root = document.documentElement;
  if (root.scrollWidth > root.clientWidth + 1) say('gulir-samping', null, `halaman ${root.scrollWidth} > ${root.clientWidth}`);
  const main = document.querySelector('main');
  if (main && getComputedStyle(main).overflowX !== 'hidden' && main.scrollWidth > main.clientWidth + 1) say('gulir-samping', main, `main ${main.scrollWidth} > ${main.clientWidth}`);

  // Boxes: anything drawn as a box (a background, a border or a shadow) or clipping its content.
  const isBox = (el) => {
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
    const border = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) > 0;
    return bg || border || el.classList.contains('m-card');
  };
  const scrolls = (el) => /auto|scroll/.test(getComputedStyle(el).overflowX);
  for (const el of leaves) {
    let box = el.parentElement;
    while (box && box !== document.body && !isBox(box)) box = box.parentElement;
    if (!box || box === document.body || box === document.documentElement || box.tagName === 'MAIN') continue;
    // A row that scrolls sideways on purpose (chips) holds wider content.
    let sc = el.parentElement;
    let scrolling = false;
    for (; sc && sc !== box; sc = sc.parentElement) if (scrolls(sc)) scrolling = true;
    if (scrolling) continue;
    // Text belongs inside the box's content area: in the padding it already reads as squeezed against the edge.
    // Text placed on purpose (absolutely positioned, a badge on a corner) is held to the outer edge only.
    let placed = false;
    for (let e = el; e && e !== box; e = e.parentElement) if (/absolute|fixed/.test(getComputedStyle(e).position)) placed = true;
    const bb = box.getBoundingClientRect();
    const bs = getComputedStyle(box);
    // Padding is in the box's own px; a scaled box (an onboarding scene) shows it smaller.
    const k = box.offsetWidth > 0 ? bb.width / box.offsetWidth : 1;
    const inset = (side) => (placed ? 0 : (parseFloat(bs[`padding${side}`]) + parseFloat(bs[`border${side}Width`])) * k);
    // Sideways the content box; up and down the outer edge, since a line box carries leading above and below its glyphs.
    const b = { left: bb.left + inset('Left'), right: bb.right - inset('Right'), top: bb.top, bottom: bb.bottom };
    for (const r of textRects(el)) {
      const over = Math.max(b.left - r.left, r.right - b.right, b.top - r.top, r.bottom - b.bottom);
      if (over > 1.5) {
        say('keluar-kotak', el, `${Math.round(over)} px di luar <${box.tagName.toLowerCase()} ${box.className.toString().split(' ').slice(0, 3).join(' ')}>`);
        break;
      }
    }
  }

  // Text cut off without an ellipsis or line clamp.
  for (const el of leaves) {
    const cs = getComputedStyle(el);
    const hides = (v) => v === 'hidden' || v === 'clip';
    const wide = el.scrollWidth > el.clientWidth + 1 && hides(cs.overflowX);
    const tall = el.scrollHeight > el.clientHeight + 1 && hides(cs.overflowY);
    if (!wide && !tall) continue;
    const meant = cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none');
    if (!meant) say('terpotong', el, wide ? 'melebar' : 'meninggi');
  }

  // Two cards over each other, or two pieces of text over each other (not one inside the other, not a fixed bar over scrolled content).
  const cards = [...scope.querySelectorAll('.m-card')].filter((el) => shown(el) && !ignored(el));
  const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i], b = cards[j];
      if (a.contains(b) || b.contains(a) || fixedOf(a) !== fixedOf(b)) continue;
      const area = overlap(a.getBoundingClientRect(), b.getBoundingClientRect());
      if (area > 16) say('menimpa', a, `kartu menimpa kartu lain (${Math.round(area)} px²): ${(b.textContent || '').trim().slice(0, 40)}`);
    }
  // Over each other and under the bars: what shows on the screen as it stands.
  const pieces = leaves.map((el) => ({ el, rects: textRects(el, true), fixed: fixedOf(el) })).filter((p) => p.rects.length > 0);
  for (let i = 0; i < pieces.length; i++)
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i], b = pieces[j];
      if (a.el.contains(b.el) || b.el.contains(a.el) || a.fixed !== b.fixed) continue;
      // Line boxes of tightly set lines touch by their leading; text lies over text when a third of a line overlaps.
      let area = 0;
      for (const ra of a.rects)
        for (const rb of b.rects) {
          const oh = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          const ow = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          if (oh > 0.33 * Math.min(ra.height, rb.height) && ow > 2) area += oh * ow;
        }
      if (area > 12) {
        say('menimpa', a.el, `teks menimpa teks (${Math.round(area)} px²): ${(b.el.textContent || '').trim().slice(0, 40)}`);
        break;
      }
    }

  // Touch targets: the control plus the invisible ::after hit area the app gives small controls.
  const controls = [...scope.querySelectorAll('button, a[href], [role="button"], [role="switch"], [role="checkbox"], [role="tab"], [role="radio"], input, select, textarea, [role="menuitem"], [role="option"]')].filter((el) => shown(el) && !ignored(el));
  for (const el of controls) {
    // A link or button inside a sentence takes the text's size (WCAG's inline exception).
    if (el.closest('p') && /^inline/.test(getComputedStyle(el).display)) continue;
    // A field inside a <label> is touched through the whole label (a tap on it focuses the field).
    const label = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) ? el.closest('label') : null;
    const r = (label ?? el).getBoundingClientRect();
    const after = getComputedStyle(el, '::after');
    const hasAfter = after.content !== 'none' && after.content !== 'normal' && after.position === 'absolute';
    const w = Math.max(r.width, hasAfter ? parseFloat(after.width) || 0 : 0);
    const h = Math.max(r.height, hasAfter ? parseFloat(after.height) || 0 : 0);
    if (w < touch - 0.5 || h < touch - 0.5) say('target-kecil', el, `${Math.round(w)}x${Math.round(h)}`);
  }

  // Under the status bar or the gesture bar: text and controls inside a top or bottom inset (at the screen's resting scroll).
  if (!dialogs.length || true) {
    const under = (r) => r.top < safe.top - 0.5 || r.bottom > vh - safe.bottom + 0.5;
    // Content of a scroller that really scrolls (main, a tall sheet) passes under the bars by design: it is reached by scrolling.
    const inScroller = (el) => {
      for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
        const oy = getComputedStyle(e).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight + 1) return true;
      }
      return false;
    };
    for (const p of pieces) {
      if ((!p.fixed && main && main.contains(p.el)) || inScroller(p.el)) continue;
      // The text as it shows (a scroller it sits in cuts it).
      const r = { top: Math.min(...p.rects.map((x) => x.top)), bottom: Math.max(...p.rects.map((x) => x.bottom)) };
      if (r.bottom <= 0 || r.top >= vh) continue;
      if (under(r)) say('tertutup-bilah', p.el, `y ${Math.round(r.top)}-${Math.round(r.bottom)} (bilah ${safe.top}/${vh - safe.bottom})`);
    }
    for (const el of controls) {
      if ((!fixedOf(el) && main && main.contains(el)) || inScroller(el)) continue;
      const box = el.getBoundingClientRect();
      const c = clipOf(el, true);
      const r = { top: Math.max(box.top, c.top), bottom: Math.min(box.bottom, c.bottom) };
      if (r.bottom - r.top < 1 || r.bottom <= 0 || r.top >= vh) continue;
      if (under(r)) say('tertutup-bilah', el, `kontrol y ${Math.round(r.top)}-${Math.round(r.bottom)}`);
    }
  }
  if (vw > 0 && document.body.getBoundingClientRect().width > vw + 1) say('gulir-samping', null, 'body lebih lebar dari layar');
  return found;
};

const results = []; // { state, lang, theme, tier, w, h, scale, kind, text, detail }
const shotsTaken = new Set();
const failedSteps = [];
let checks = 0;

const stateTime = new Map();
async function checkState(page, state, look, lang) {
  if (only && !only.some((o) => state.includes(o))) return;
  const t0 = Date.now();
  const [theme, tier] = look;
  for (const h of HEIGHTS)
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: h });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.waitForTimeout(120);
      for (const s of SCALES) {
        await page.evaluate(applyTextZoom, s);
        // On the phone the zoom is there from the start; here it changes under a laid-out page, so the parts that
        // measure themselves (the greeting, the onboarding scenes, the mascot's place) are told to measure again.
        await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        await page.waitForTimeout(250);
        const found = await page.evaluate(FIND, { safe: SAFE, touch: TOUCH });
        checks += 1;
        for (const f of found) results.push({ state, lang, theme, tier, w, h, scale: s, ...f });
        const key = `${state}|${s}`;
        if (found.length > 0 && !shotsTaken.has(`${key}|${lang}|${theme}`) && w <= 412) {
          shotsTaken.add(`${key}|${lang}|${theme}`);
          const dir = join(out, state.replace(/[^\w.-]+/g, '-'));
          mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: join(dir, `${lang}-${theme}-${tier}-${w}x${h}-${s}.png`) }).catch(() => undefined);
        }
      }
      await page.evaluate(applyTextZoom, 1);
    }
  await page.setViewportSize({ width: 360, height: 800 });
  stateTime.set(state, (stateTime.get(state) ?? 0) + Date.now() - t0);
}

/** One look, one language, one set of query switches; `steps` run in order. */
async function session({ look, lang, query = '', finished = false }, steps) {
  const [theme, tier] = look;
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: lang === 'en' ? 'en-US' : 'id-ID', timezoneId: 'Asia/Makassar', colorScheme: theme, reducedMotion: 'reduce' });
  if (finished) await context.addInitScript(() => localStorage.setItem('CapacitorStorage.sulo:mobile:onboarding', JSON.stringify({ step: 'finished', mode: 'first' })));
  // The WebView zooms every text, whatever a page sets: a part that pins --m-tz (to escape the web emulation) is zoomed too.
  await context.addInitScript(() => {
    const add = () => {
      const st = document.createElement('style');
      st.textContent = 'body * { --m-tz: inherit !important; }';
      document.head.appendChild(st);
    };
    if (document.head) add();
    else document.addEventListener('DOMContentLoaded', add, { once: true });
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: SAFE });
  await page.clock.setFixedTime(NOW);
  const t = WORDS[lang];
  const btn = (name, exact = false) => page.getByRole('button', { name, exact }).first();
  const starts = (text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  const go = async (hash) => {
    await page.evaluate((x) => (location.hash = x), hash);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelector('main')?.scrollTo({ top: 0 }));
  };
  const closeSheet = async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  };
  const enter = async () => {
    await page.waitForFunction(() => typeof window.__suloEnterDemo === 'function');
    await page.evaluate(() => window.__suloEnterDemo());
    await page.waitForTimeout(900);
    const later = btn(t.mobile.notify.later, true);
    if (await later.isVisible().catch(() => false)) await later.click();
    await page.waitForTimeout(3200);
  };
  const check = (state) => checkState(page, state, look, lang);
  const c = { page, t, lang, btn, starts, go, closeSheet, enter, check };
  const sep = query.includes('?') ? '&' : '?';
  await page.goto(`http://localhost:${PORT}/${query}${sep}lang=${lang}&perf=${tier}`);
  for (const [name, run] of steps) {
    try {
      await run(c);
    } catch (e) {
      failedSteps.push(`${theme}/${tier} ${lang} ${name}: ${String(e.message ?? e).split('\n').slice(0, process.argv.includes('--verbose') ? 12 : 1).join(' | ')}`);
      if (process.argv.includes('--verbose')) {
        const seen = await page.evaluate(() => ({ url: location.href, buttons: [...document.querySelectorAll('button')].map((b) => `${(b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 30)}${b.closest('[inert],[aria-hidden="true"]') ? ' (tersembunyi)' : ''}`), h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()) })).catch(() => null);
        failedSteps.push(`   halaman: ${JSON.stringify(seen)}`);
        await page.screenshot({ path: join(out, `gagal-${lang}-${name.replace(/\W+/g, '-')}.png`) }).catch(() => undefined);
      }
      await closeSheet().catch(() => undefined);
    }
  }
  await context.close();
}

const MAIN = [
  ['masuk', (c) => c.enter()],
  ['beranda', (c) => c.check('beranda')],
  ['tugas', async (c) => (await c.go('#tugas'), c.check('tugas'))],
  ['kalender', async (c) => (await c.go('#kalender'), c.check('kalender-daftar'))],
  ['kalender bulan', async (c) => (await c.go('#kalender'), await c.btn(c.t.dash.kalender.month, true).click(), await c.page.waitForTimeout(350), c.check('kalender-bulan'))],
  ['presensi', async (c) => (await c.go('#presensi'), c.check('presensi'))],
  ['presensi rincian', async (c) => (await c.go('#presensi'), await c.page.getByRole('main').getByRole('button', { name: /Mekanika Fluida/ }).click(), await c.page.waitForTimeout(450), c.check('presensi-rincian'))],
  ['lainnya', async (c) => (await c.go('#lainnya'), c.check('lainnya'))],
  ['kabar', async (c) => (await c.go('#kabar'), c.check('kabar'))],
  ['mata kuliah', async (c) => (await c.go('#mata-kuliah'), c.check('mata-kuliah'))],
  ['pengaturan', async (c) => (await c.go('#pengaturan'), c.check('pengaturan'))],
  ['bantuan', async (c) => (await c.go('#bantuan'), c.check('bantuan'))],
  ['tentang', async (c) => (await c.go('#tentang'), c.check('tentang'))],
  ['privasi', async (c) => (await c.go('#privasi'), c.check('privasi'))],
  ['rincian tugas', async (c) => (await c.go('#tugas'), await c.page.locator('main section.m-card .m-cover').first().click(), await c.page.waitForTimeout(450), c.check('rincian-tugas'))],
  ['sheet aksi', async (c) => (await c.btn(c.t.mobile.app.moreActions, true).click(), await c.page.waitForTimeout(450), await c.check('sheet-aksi-tugas'), c.closeSheet())],
  ['sheet suara', async (c) => (await c.go('#pengaturan'), await c.page.getByRole('button', { name: c.starts(c.t.mobile.notifySound.label) }).click(), await c.page.waitForTimeout(450), await c.check('sheet-suara'), c.closeSheet())],
  ['sheet keluar', async (c) => (await c.page.getByRole('button', { name: c.starts(c.t.mobile.settings.signOutDelete) }).click(), await c.page.waitForTimeout(450), await c.check('sheet-keluar'), c.closeSheet())],
];
const one = (name, run) => [[name, async (c) => (await c.enter(), run ? run(c) : c.check(name))]];
const STATES = [
  [{ query: '?neosia=all' }, [['masuk', (c) => c.enter()], ['beranda neosia', (c) => c.check('beranda-neosia')], ['jadwal', async (c) => (await c.go('#jadwal'), c.check('jadwal'))], ['nilai tersembunyi', async (c) => (await c.go('#nilai'), c.check('nilai-tersembunyi'))]]],
  [{ query: '?demo=aman' }, one('beranda-aman')],
  [{ query: '?demo=kosong' }, [...one('beranda-kosong'), ['tugas kosong', async (c) => (await c.go('#tugas'), c.check('tugas-kosong'))], ['kabar kosong', async (c) => (await c.go('#kabar'), c.check('kabar-kosong'))]]],
  [{ query: '?session=expired' }, one('perlu-masuk-lagi')],
  [{}, one('offline', async (c) => {
    await c.page.context().setOffline(true);
    await c.btn(c.t.mobile.connected.refresh).click().catch(() => undefined);
    await c.page.waitForTimeout(1200);
    await c.check('offline');
  })],
  [{ query: '?session=connected', finished: true }, [['memuat pertama', async (c) => (await c.page.waitForTimeout(1500), c.check('memuat-pertama'))]]],
  [{ query: '?presensi=none' }, one('presensi-belum-ada', (c) => c.go('#presensi').then(() => c.check('presensi-belum-ada')))],
  [{ query: '?release=available' }, [['versi baru', async (c) => {
    await c.page.waitForFunction(() => typeof window.__suloEnterDemo === 'function');
    await c.page.evaluate(() => window.__suloEnterDemo());
    await c.page.waitForTimeout(2600);
    if (await c.page.getByText(c.t.onboarding.reminders.allow).isVisible().catch(() => false)) await c.btn(c.t.mobile.notify.later, true).click();
    await c.page.waitForTimeout(3200);
    await c.check('kartu-versi-baru');
    await c.go('#tentang');
    await c.check('tentang-versi-baru');
  }]]],
  [{ query: '?release=required' }, [['perlu diperbarui', async (c) => {
    await c.page.waitForFunction(() => typeof window.__suloEnterDemo === 'function');
    await c.page.evaluate(() => window.__suloEnterDemo());
    await c.page.waitForTimeout(2000);
    await c.page.reload();
    await c.page.waitForTimeout(1500);
    await c.check('update-wajib');
  }]]],
  ...['wait', 'fail'].map((m) => [{ query: `?lock=${m}`, lockOn: true }, [[`kunci ${m}`, async (c) => (await c.page.waitForTimeout(900), c.check(`kunci-${m}`))]]]),
  ...['invite', 'new', 'beranda'].map((s) => [{ query: `?neosia=${s}` }, one(`neosia-${s}`)]),
];

async function onboarding(look, lang) {
  const run = (query, opts, keep, label) =>
    session({ look, lang, query }, [[`onboarding ${label ?? 'utama'}`, async (c) => {
      await walk(c.page, async (n) => {
        if (keep && !keep.some((k) => n.startsWith(`${k}-`))) return;
        if (n.startsWith('10-')) return;
        await c.check(`onboarding-${label ? `${n.split('-')[0]}-${label}` : n}`);
      }, { ...opts, lang, slow: 0.6 });
    }]]);
  await run('', {}, null, null);
  if (!CI) for (const [label, query, opts, keep] of SPECIAL) await run(query, opts, keep, label);
}

try {
  for (const look of LOOKS)
    for (const lang of LANGS) {
      log(`${look.join('/')} ${lang}`);
      await onboarding(look, lang);
      await session({ look, lang }, MAIN);
      if (!CI) for (const [opts, steps] of STATES) {
        if (opts.lockOn) {
          // The app lock needs its switch on before the app starts.
          const ctxSteps = steps;
          await session({ look, lang, query: opts.query }, [['kunci aktif', async (c) => (await c.page.evaluate(() => localStorage.setItem('CapacitorStorage.sulo:mobile:lockEnabled', 'true')), await c.page.reload(), await c.page.waitForTimeout(600))], ...ctxSteps]);
        } else await session({ look, lang, ...opts }, steps);
      }
    }
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { /* already gone */ }
}

// Per state: the findings, by kind, and the sizes and scales they happen at.
const byState = new Map();
for (const r of results) {
  const k = r.state;
  if (!byState.has(k)) byState.set(k, { total: 0, kinds: {}, combos: new Set(), examples: [] });
  const s = byState.get(k);
  s.total += 1;
  s.kinds[r.kind] = (s.kinds[r.kind] ?? 0) + 1;
  s.combos.add(`${r.w}x${r.h}@${r.scale}`);
  if (s.examples.filter((e) => e.kind === r.kind).length < 3 && !s.examples.some((e) => e.kind === r.kind && e.text === r.text)) s.examples.push({ kind: r.kind, text: r.text, detail: r.detail, at: `${r.lang} ${r.w}x${r.h} @${r.scale}` });
}
const summary = [...byState.entries()].map(([state, s]) => ({ state, total: s.total, kinds: s.kinds, combos: s.combos.size, examples: s.examples }));
if (jsonOut) writeFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), jsonOut), `${JSON.stringify({ checks, summary, failedSteps }, null, 1)}\n`);
for (const s of summary) {
  console.log(`${s.state}: ${s.total} temuan di ${s.combos} kombinasi ${JSON.stringify(s.kinds)}`);
  for (const e of s.examples) console.log(`   ${e.kind} [${e.at}] ${e.text} ${e.detail ? `(${e.detail})` : ''}`);
}
if (failedSteps.length) console.log(`Langkah gagal (${failedSteps.length}):\n${failedSteps.join('\n')}`);
if (has('time')) for (const [st, ms] of stateTime) console.log(`waktu ${st}: ${(ms / 1000).toFixed(0)} s`);
console.log(`check-mobile-layout: ${checks} pemeriksaan, ${results.length} temuan di ${byState.size} keadaan, ${failedSteps.length} langkah gagal`);
process.exitCode = results.length > 0 || failedSteps.length > 0 ? 1 : 0;

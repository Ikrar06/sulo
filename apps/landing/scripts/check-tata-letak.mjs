#!/usr/bin/env node
// pnpm check:landing-layout (brief 9.5, TETAP): every page of the built site
// but the device screens (/layar/), across phone and laptop widths, short and
// tall screens, the browser's own text size setting (1, 1.3 and 2 times, set
// the way a visitor sets it: the default font size, Page.setFontSizes), both
// themes and both languages, checked by measurement rather than by eye. After
// apps/mobile/scripts/check-mobile-layout.mjs, the app's own check.
//
// A page fails when, at any size and scale:
//   - the page scrolls sideways (gulir-samping),
//   - text sticks out of its box: a card, a pill, a button, a panel (keluar-kotak),
//   - text is cut off where the layout never meant to cut it, no ellipsis or
//     line clamp (terpotong),
//   - two pieces of text lie over each other, or a piece of the apps' own UI
//     drawn on the page lies over or against the page's text (menimpa, terlalu-dekat),
//   - a control's touch target is under 44 px on a touch screen (target-kecil),
//   - at the top of the page, the fixed nav covers text, a control or the
//     mascot (tertutup-nav),
//   - on a phone, the first screen of the home page does not hold the title
//     and the main button (brief 9.5), and, up to text at 1.3 times, the
//     mascot, the chips and the sentence too (the owner, 24 Nov) (layar-pertama),
//   - two mascots, or two warm lights, can be on one screen at once (brief 2
//     and 4.1, TETAP) (dua-maskot, dua-cahaya).
//
// Motion reduced (the still layout every motion starts from and ends on); no
// network but the local server. Shots of failures: <out>/<page>-<w>x<h>-<scale>-<theme>.png
//
// Usage: node scripts/check-tata-letak.mjs [--dist=<dir>] [--out=<dir>] [--ci]
//   [--only=<text in the path>] [--widths=360,1440] [--scales=1,2] [--json=<file>]
//   --ci  a shorter matrix: 320x640, 360x640, 412x915, 915x412, 768x1024,
//         1024x768, 1440x900; scales 1, 1.3, 2; light.
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './lib/server.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const has = (name) => process.argv.includes(`--${name}`);
const CI = has('ci');
const DIST = resolve(arg('dist', new URL('../dist', import.meta.url).pathname));
const OUT = resolve(arg('out', new URL('../../../.output/landing-layout', import.meta.url).pathname));
const only = arg('only', null)?.split(',') ?? null;
const list = (name) => arg(name, null)?.split(',').map(Number) ?? null;
const log = (m) => process.stderr.write(`check-landing-layout: ${m}\n`);

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const LAPTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
// A phone: Android's Chrome, touch. A laptop: Chrome, a pointer. 720x900 and 960x540 are 1440x900 and 1920x1080 at the browser's 200% zoom.
const HP = CI ? [[320, 640], [360, 640], [412, 915], [915, 412]] : [[320, 640], [320, 900], [360, 640], [360, 800], [390, 844], [412, 640], [412, 915], [430, 932], [915, 412]];
const LEBAR = CI ? [[768, 1024], [1024, 768], [1440, 900]] : [[720, 900], [768, 1024], [960, 540], [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1920, 1080]];
const SCALES = list('scales') ?? [1, 1.3, 2];
const THEMES = CI ? ['light'] : ['light', 'dark'];
const pilihLebar = list('widths');
const saring = (vs) => (pilihLebar ? vs.filter(([w]) => pilihLebar.includes(w)) : vs);
const TOUCH = 44;

function halaman(dir) {
  const hasil = [];
  for (const nama of readdirSync(dir)) {
    const p = join(dir, nama);
    if (statSync(p).isDirectory()) {
      if (relative(DIST, p).split('/')[0] !== 'layar') hasil.push(...halaman(p));
    } else if (nama.endsWith('.html')) hasil.push(`/${relative(DIST, p)}`.replace(/index\.html$/, ''));
  }
  return hasil.sort();
}

/** In the page: the findings at this size and scale. */
const FIND = ({ touch, sentuh, rumah, hp, pertamaPenuh }) => {
  const found = [];
  const vw = innerWidth;
  const vh = innerHeight;
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
    const text = (el?.getAttribute?.('aria-label') || el?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    found.push({ kind, text, detail, y: el ? Math.round(el.getBoundingClientRect().top + scrollY) : 0 });
  };
  // The skip link waits off screen for the keyboard, text for screen readers only is never drawn, and the mascot
  // and every drawing are not text layout.
  const bacaSaja = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.clipPath === 'inset(50%)' && parseFloat(cs.width) <= 1) return true;
    }
    return false;
  };
  const ignored = (el) => el.closest('.lewati, .sr-only, svg, template, noscript, [data-layout-bebas]') !== null || bacaSaja(el);
  const appRoot = (el) => el.closest('[data-ui-aplikasi]');
  const fixedOf = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const p = getComputedStyle(e).position;
      if (p === 'fixed' || p === 'sticky') return e;
    }
    return null;
  };
  const clipOf = (el) => {
    let c = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 };
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const cuts = (v) => v === 'hidden' || v === 'clip' || v === 'auto' || v === 'scroll';
      const hx = cuts(cs.overflowX), hy = cuts(cs.overflowY);
      if (!hx && !hy) continue;
      const r = e.getBoundingClientRect();
      c = { left: hx ? Math.max(c.left, r.left) : c.left, right: hx ? Math.min(c.right, r.right) : c.right, top: hy ? Math.max(c.top, r.top) : c.top, bottom: hy ? Math.min(c.bottom, r.bottom) : c.bottom };
    }
    return c;
  };
  const textRects = (el) => {
    const rects = [];
    const c = clipOf(el);
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
  const leaves = [...document.body.querySelectorAll('*')].filter((el) => !ignored(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && shown(el));

  // Sideways scrolling.
  const root = document.documentElement;
  if (root.scrollWidth > root.clientWidth + 1) {
    // Name the widest culprit: the element reaching furthest past the right edge.
    let jauh = null, kanan = root.clientWidth;
    for (const el of document.body.querySelectorAll('*')) {
      if (fixedOf(el) || !shown(el)) continue;
      const r = el.getBoundingClientRect();
      const c = clipOf(el);
      if (Math.min(r.right, c.right) > kanan + 1) { kanan = Math.min(r.right, c.right); jauh = el; }
    }
    say('gulir-samping', jauh, `halaman ${root.scrollWidth} > ${root.clientWidth}${jauh ? ` oleh <${jauh.tagName.toLowerCase()} ${String(jauh.className).split(' ').slice(0, 2).join(' ')}>` : ''}`);
  }

  // Text in its box: anything drawn as a box (a background or a border).
  const isBox = (el) => {
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
    const border = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) > 0;
    return bg || border;
  };
  for (const el of leaves) {
    let box = el.parentElement;
    while (box && box !== document.body && !isBox(box)) box = box.parentElement;
    if (!box || box === document.body || box.tagName === 'MAIN') continue;
    let placed = false;
    for (let e = el; e && e !== box; e = e.parentElement) if (/absolute|fixed/.test(getComputedStyle(e).position)) placed = true;
    const bb = box.getBoundingClientRect();
    const bs = getComputedStyle(box);
    const k = box.offsetWidth > 0 ? bb.width / box.offsetWidth : 1;
    const inset = (side) => (placed ? 0 : (parseFloat(bs[`padding${side}`]) + parseFloat(bs[`border${side}Width`])) * k);
    const b = { left: bb.left + inset('Left'), right: bb.right - inset('Right'), top: bb.top, bottom: bb.bottom };
    for (const r of textRects(el)) {
      const over = Math.max(b.left - r.left, r.right - b.right, b.top - r.top, r.bottom - b.bottom);
      if (over > 1.5) {
        say('keluar-kotak', el, `${Math.round(over)} px di luar <${box.tagName.toLowerCase()} ${String(box.className).split(' ').slice(0, 3).join(' ')}>`);
        break;
      }
    }
  }

  // The page's own text cut by a box around it that hides its overflow (a section clipping its title, a box of
  // fixed height): brief 9.5 lets no box with text in it have a fixed height. The apps' own UI may crop on purpose.
  for (const el of leaves) {
    if (appRoot(el) || el.closest('.perangkat') || !el.parentElement) continue;
    const c = clipOf(el.parentElement);
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      const keluar = [...r.getClientRects()].map((x) => Math.max(c.left - x.left, x.right - c.right, c.top - x.top, x.bottom - c.bottom)).reduce((a, b) => Math.max(a, b), 0);
      if (keluar > 1.5) {
        say('terpotong', el, `${Math.round(keluar)} px dipotong induknya`);
        break;
      }
    }
  }

  // Text cut off without an ellipsis or a line clamp.
  for (const el of leaves) {
    const cs = getComputedStyle(el);
    const hides = (v) => v === 'hidden' || v === 'clip';
    const wide = el.scrollWidth > el.clientWidth + 1 && hides(cs.overflowX);
    const tall = el.scrollHeight > el.clientHeight + 1 && hides(cs.overflowY);
    if (!wide && !tall) continue;
    const meant = cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none');
    if (!meant) say('terpotong', el, wide ? 'melebar' : 'meninggi');
  }

  // Text over text: not one inside the other, not inside one piece of app UI (its own layout), not a fixed bar over the page.
  const pieces = leaves.map((el) => ({ el, rects: textRects(el), fixed: fixedOf(el), app: appRoot(el) })).filter((p) => p.rects.length > 0);
  for (let i = 0; i < pieces.length; i++)
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i], b = pieces[j];
      if (a.el.contains(b.el) || b.el.contains(a.el) || a.fixed !== b.fixed || (a.app && a.app === b.app)) continue;
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
  // A floating piece of app UI (placed on its own, as in the hero) keeps 8 px off the page's own text.
  const melayang = [...document.querySelectorAll('[data-ui-aplikasi]')].filter((el) => shown(el) && /absolute|fixed/.test(getComputedStyle(el).position));
  const teksHalaman = pieces.filter((p) => !p.app && !p.fixed);
  for (const el of melayang) {
    const r = el.getBoundingClientRect();
    const g = { left: r.left - 8, right: r.right + 8, top: r.top - 8, bottom: r.bottom + 8 };
    const kena = teksHalaman.find((p) => p.rects.some((x) => x.left < g.right && x.right > g.left && x.top < g.bottom && x.bottom > g.top));
    if (kena) say('terlalu-dekat', el, `potongan UI kurang dari 8 px dari teks: ${kena.el.textContent.trim().slice(0, 40)}`);
  }

  // Touch targets on a touch screen. A link inside a sentence takes the text's size (WCAG's inline exception).
  const controls = [...document.querySelectorAll('button, a[href], summary, [role="button"], input, select, textarea')].filter((el) => shown(el) && !ignored(el) && !el.closest('[inert], [data-ui-aplikasi]'));
  if (sentuh) {
    for (const el of controls) {
      if (el.closest('p, dd, figcaption') && /^inline/.test(getComputedStyle(el).display)) continue;
      const r = el.getBoundingClientRect();
      const after = getComputedStyle(el, '::after');
      const hasAfter = after.content !== 'none' && after.content !== 'normal' && after.position === 'absolute';
      const w = Math.max(r.width, hasAfter ? parseFloat(after.width) || 0 : 0);
      const h = Math.max(r.height, hasAfter ? parseFloat(after.height) || 0 : 0);
      if (w < touch - 0.5 || h < touch - 0.5) say('target-kecil', el, `${Math.round(w)}x${Math.round(h)}`);
    }
  }

  // At the top of the page, the fixed nav covers nothing.
  if (scrollY === 0) {
    const bilah = [...document.querySelectorAll('body *')].filter((el) => getComputedStyle(el).position === 'fixed' && shown(el) && !el.matches('.lewati, [popover]'));
    const kenaBilah = (r) => bilah.find((n) => { const b = n.getBoundingClientRect(); return r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top; });
    for (const p of pieces) {
      if (p.fixed) continue;
      const n = p.rects.map((r) => kenaBilah(r)).find(Boolean);
      if (n) say('tertutup-nav', p.el, `di bawah <${n.tagName.toLowerCase()} ${String(n.className).split(' ')[0]}>`);
    }
    for (const el of [...controls.filter((c) => !fixedOf(c)), ...document.querySelectorAll('[data-maskot]')]) {
      if (!shown(el) || fixedOf(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= vh) continue;
      const n = kenaBilah(r);
      if (n) say('tertutup-nav', el, `di bawah <${n.tagName.toLowerCase()} ${String(n.className).split(' ')[0]}>`);
    }
  }

  // The home page's first screen on a phone.
  if (rumah && hp && scrollY === 0) {
    const pertama = (sel) => [...document.querySelectorAll(sel)].find(shown) ?? null;
    const wajib = [['judul', 'h1'], ['tombol utama', '.pembuka .tombol']];
    if (pertamaPenuh) wajib.push(['maskot', '.pembuka [data-maskot]'], ['cip', '.pembuka .cip'], ['kalimat', '.pembuka-pendukung']);
    for (const [nama, sel] of wajib) {
      const el = pertama(sel);
      if (!el) say('layar-pertama', null, `${nama} tidak ada`);
      else if (el.getBoundingClientRect().bottom > vh + 0.5) say('layar-pertama', el, `${nama} berakhir di ${Math.round(el.getBoundingClientRect().bottom)} > ${vh}`);
    }
    if (pertamaPenuh) for (const c of document.querySelectorAll('.pembuka .cip')) if (shown(c) && c.getBoundingClientRect().bottom > vh + 0.5) say('layar-pertama', c, 'cip di luar layar pertama');
  }

  return found;
};

/** In the page, every answer closed as a visitor first finds them: one mascot and one warm light per screen. */
const SATU = () => {
  const found = [];
  const vw = innerWidth;
  const vh = innerHeight;
  const shown = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const say = (kind, el, detail) => found.push({ kind, text: '', detail, y: Math.round(el.getBoundingClientRect().top + scrollY) });
  // Anywhere the page can be scrolled to, at most one shows by half or more.
  const satuPerLayar = (sel, kind) => {
    const els = [...document.querySelectorAll(sel)].filter(shown).map((el) => {
      const r = el.getBoundingClientRect();
      return { el, top: r.top + scrollY, bottom: r.bottom + scrollY, h: r.height, kiri: r.left, kanan: r.right };
    }).filter((m) => m.kanan > 0 && m.kiri < vw);
    if (els.length < 2) return;
    const maxY = Math.max(0, document.documentElement.scrollHeight - vh);
    for (let y = 0; y <= maxY + 16; y += 16) {
      const tampak = els.filter((m) => Math.min(m.bottom, y + vh) - Math.max(m.top, y) >= m.h / 2);
      if (tampak.length > 1) {
        say(kind, tampak[0].el, `${tampak.map((m) => String(m.el.className).split(' ').find((c) => c !== 'maskot') ?? m.el.className).join(' dan ')} sekaligus di layar (gulir ${Math.min(y, maxY)})`);
        return;
      }
    }
  };
  satuPerLayar('[data-maskot]', 'dua-maskot');
  satuPerLayar('.cahaya, .penutup-cahaya', 'dua-cahaya');
  return found;
};

const site = await serve(DIST);
const browser = await chromium.launch();
const pages = halaman(DIST).filter((p) => !only || only.some((o) => p.includes(o)));
const temuan = [];
let jumlah = 0;
mkdirSync(OUT, { recursive: true });
const sudahDipotret = new Set();

for (const [jenis, viewports] of [['hp', saring(HP)], ['laptop', saring(LEBAR)]]) {
  if (!viewports.length) continue;
  const hp = jenis === 'hp';
  const context = await browser.newContext({ userAgent: hp ? ANDROID : LAPTOP, isMobile: hp, hasTouch: hp, reducedMotion: 'reduce', viewport: { width: viewports[0][0], height: viewports[0][1] } });
  // Nothing leaves the machine: every request to another address is refused.
  await context.route((url) => !url.href.startsWith(site.url), (route) => route.abort());
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  for (const path of pages) {
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width: viewports[0][0], height: viewports[0][1] });
      await cdp.send('Page.setFontSizes', { fontSizes: { standard: 16, fixed: 13 } });
      await page.goto(`${site.url}${path}`, { waitUntil: 'load' });
      // Every answer open (the stricter layout: a closed one shows only its question), every lazy picture and frame in, then back to the top.
      await page.evaluate(async () => {
        for (const d of document.querySelectorAll('details')) d.open = true;
        for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {
          scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 30));
        }
        scrollTo(0, 0);
      });
      await page.waitForLoadState('networkidle').catch(() => {});
      for (const [w, h] of viewports) {
        await page.setViewportSize({ width: w, height: h });
        for (const s of theme === 'dark' && !CI ? [1] : SCALES) {
          const px = Math.round(16 * s);
          await cdp.send('Page.setFontSizes', { fontSizes: { standard: px, fixed: 13 } });
          // A phone zooms out to fit a page wider than the screen and stays so: back to 1 before every look.
          await cdp.send('Emulation.resetPageScaleFactor');
          // The new size and text size reach the page a frame or more later: wait until both show.
          await page.waitForFunction(([px, w]) => parseFloat(getComputedStyle(document.documentElement).fontSize) === px && document.documentElement.clientWidth === w, [px, w], { polling: 'raf', timeout: 10000 });
          // Chromium keeps some rem and em lengths from the old text size after Page.setFontSizes (measured: a
          // sentence 980 px wide where it should be 646): a passing change to the root's size recomputes them all.
          await page.evaluate(() => {
            const h = document.documentElement;
            h.style.fontSize = '1px';
            void h.offsetHeight;
            h.style.fontSize = '';
            void h.offsetHeight;
          });
          await page.evaluate(() => new Promise((r) => { scrollTo(0, 0); requestAnimationFrame(() => requestAnimationFrame(r)); }));
          const hasil = await page.evaluate(FIND, { touch: TOUCH, sentuh: hp || w <= 1024, rumah: path === '/' || path === '/en/', hp: hp && w < h, pertamaPenuh: s <= 1.3 && w >= 360 });
          hasil.push(...(await page.evaluate(() => {
            const buka = [...document.querySelectorAll('details')];
            for (const d of buka) d.open = false;
            return new Promise((r) => requestAnimationFrame(() => r()));
          }).then(() => page.evaluate(SATU))));
          await page.evaluate(() => { for (const d of document.querySelectorAll('details')) d.open = true; });
          jumlah++;
          for (const f of hasil) temuan.push({ path, w, h, s, theme, ...f });
          const kunci = `${path}|${w}x${h}|${s}|${theme}`;
          if (hasil.length && !sudahDipotret.has(kunci) && sudahDipotret.size < 80) {
            sudahDipotret.add(kunci);
            const y = Math.max(0, hasil[0].y - 120);
            await page.evaluate((yy) => scrollTo(0, yy), y);
            const nama = `${path.replace(/\//g, '_').replace(/^_|_$/g, '') || 'rumah'}-${w}x${h}-${s}-${theme}.png`;
            await page.screenshot({ path: join(OUT, nama) });
            await page.evaluate(() => scrollTo(0, 0));
          }
        }
      }
    }
  }
  await context.close();
}
await browser.close();
await site.stop();

const jsonOut = arg('json', null);
if (jsonOut) writeFileSync(resolve(jsonOut), JSON.stringify(temuan, null, 1));
if (!temuan.length) {
  console.log(`check:landing-layout: ${pages.length} halaman, ${jumlah} ukuran dan skala, bersih.`);
  process.exit(0);
}
// One line per finding, with every size and scale it shows at.
const kelompok = new Map();
for (const t of temuan) {
  const k = `${t.path} ${t.kind}: ${t.text ? `"${t.text}" ` : ''}${t.detail.replace(/\d+ px²|gulir \d+|berakhir di \d+ > \d+|\d+x\d+$/g, '…')}`;
  if (!kelompok.has(k)) kelompok.set(k, new Set());
  kelompok.get(k).add(`${t.w}x${t.h}@${t.s}${t.theme === 'dark' ? ' gelap' : ''}`);
}
const baris = [...kelompok].map(([k, v]) => `${k}  [${[...v].slice(0, 6).join(', ')}${v.size > 6 ? `, +${v.size - 6}` : ''}]`);
console.error(`check:landing-layout: ${temuan.length} temuan dalam ${jumlah} pemeriksaan, ${kelompok.size} jenis\n- ${baris.join('\n- ')}\nPotret: ${OUT}`);
process.exit(1);

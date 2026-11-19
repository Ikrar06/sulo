#!/usr/bin/env node
// Part of pnpm check:fit: every text on every onboarding screen fits (M8c.2),
// in Indonesian and English, at 360x800 and 384x832. Nothing is cut or
// ellipsized, titles take at most 2 lines, supporting lines at most 2, and
// the text inside the scenes (cards, banners, chips, the address) is whole.
// Exit 1 on any finding.
import { openPage, startServer, walk } from './onboarding-walk.mjs';

const PORT = 5190;
const { browser, stop } = await startServer(PORT);
const findings = [];
let screens = 0;

const check = () => {
  const live = (el) => !el.closest('[data-onb-leaving]');
  const vis = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && r.right > 0 && r.left < innerWidth;
  };
  const frame = [...document.querySelectorAll('.onb-frame')].find(live);
  if (!frame) return ['kerangka tidak ditemukan'];
  const out = [];
  const lines = (el) => {
    const s = getComputedStyle(el);
    const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3;
    return Math.round(el.getBoundingClientRect().height / lh);
  };
  for (const el of frame.querySelectorAll('h1, p, span, button, label')) {
    if (!live(el) || !vis(el)) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const s = getComputedStyle(el);
    const text = el.textContent.trim().slice(0, 32);
    if (el.scrollWidth > el.clientWidth + 1 && (s.overflow !== 'visible' || s.textOverflow === 'ellipsis')) out.push(`terpotong: "${text}"`);
    if (s.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 1) out.push(`elipsis baris: "${text}"`);
  }
  const h1 = [...frame.querySelectorAll('h1')].find((h) => live(h) && vis(h));
  if (h1 && lines(h1) > 2) out.push(`judul ${lines(h1)} baris: "${h1.textContent.trim()}"`);
  const support = h1?.nextElementSibling;
  if (support && support.tagName === 'P' && vis(support) && lines(support) > 2) out.push(`pendukung ${lines(support)} baris: "${support.textContent.trim().slice(0, 32)}"`);
  return out;
};

try {
  for (const lang of ['id', 'en'])
    for (const [width, height] of [[360, 800], [384, 832]]) {
      const tag = `${lang} ${width}x${height}`;
      const { context, page } = await openPage(browser, PORT, { width, height, lang, reduced: true });
      await walk(
        page,
        async (name) => {
          if (name.startsWith('10')) return;
          screens += 1;
          for (const f of await page.evaluate(check)) findings.push(`${tag} ${name}: ${f}`);
        },
        { lang, slow: 0.35 },
      );
      await context.close();
    }
} finally {
  await stop();
}
if (findings.length > 0) {
  console.error(`check-onboarding-fit: ${findings.length} temuan\n${findings.join('\n')}`);
  process.exit(1);
}
console.log(`check-onboarding-fit: semua teks onboarding muat (${screens} layar, dua bahasa, 360 dan 384).`);

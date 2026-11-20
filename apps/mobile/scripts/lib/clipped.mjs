// Text the layout cuts off, found in the page itself rather than by eye:
// an element whose own text is wider or taller than its box while the box
// hides the rest (ellipsis, line clamp, hidden overflow). The audit shots
// list these per screenshot. A cut task or course name is data and expected;
// a cut label from the app's own dictionary is a finding.

/** Runs in the page. */
export const CLIPPED = () => {
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.display === 'inline') continue;
    const r = el.getBoundingClientRect();
    // A box of a pixel or two is text kept for screen readers only, not text the layout cut.
    if (r.width <= 2 || r.height <= 2) continue;
    const hides = (v) => v === 'hidden' || v === 'clip';
    const wide = el.scrollWidth > el.clientWidth + 1 && hides(cs.overflowX);
    const tall = el.scrollHeight > el.clientHeight + 1 && hides(cs.overflowY);
    if (!wide && !tall) continue;
    const text = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 140);
    if (seen.has(text)) continue;
    seen.add(text);
    out.push({ text, how: wide ? 'lebar' : 'tinggi' });
  }
  // The page itself scrolling sideways: something sticks out of the screen.
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) out.push({ text: '(halaman bergulir ke samping)', how: 'halaman' });
  return out;
};

/**
 * Runs in the page: visible buttons and links that show an icon only and have no name a
 * screen reader can say (no text, aria-label, aria-labelledby or title). Each is one finding.
 */
export const UNLABELLED = () => {
  const out = [];
  for (const el of document.querySelectorAll('button, a[href], [role="button"], [role="tab"], [role="menuitem"]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    const named = (el.textContent ?? '').trim() || el.getAttribute('aria-label') || el.getAttribute('title') || [...el.querySelectorAll('img[alt], svg[aria-label], [role="img"][aria-label]')].some((n) => (n.getAttribute('alt') ?? n.getAttribute('aria-label') ?? '').trim());
    const labelled = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).some((id) => id && (document.getElementById(id)?.textContent ?? '').trim());
    if (named || labelled) continue;
    out.push({ text: `<${el.tagName.toLowerCase()}> di (${Math.round(r.left)}, ${Math.round(r.top)}) ${Math.round(r.width)}x${Math.round(r.height)}: ${el.outerHTML.replace(/\s+/g, ' ').slice(0, 90)}`, how: 'tanpa-label' });
  }
  return out;
};

/** Every plain string of a dictionary (nested objects and arrays), for telling the app's words from data. */
export function staticTexts(words) {
  const set = new Set();
  const walk = (v) => {
    if (typeof v === 'string') set.add(v.trim().replace(/\s+/g, ' '));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(words);
  return set;
}

/** Collects findings per screenshot and writes them as one JSON file. */
export function clipLog() {
  const rows = [];
  return {
    async note(page, file, texts) {
      const found = await page.evaluate(CLIPPED).catch(() => []);
      for (const f of found) rows.push({ file, ...f, kind: texts.has(f.text) ? 'antarmuka' : f.how === 'halaman' ? 'halaman' : 'data' });
      const bare = await page.evaluate(UNLABELLED).catch(() => []);
      for (const f of bare) rows.push({ file, ...f, kind: 'tanpa-label' });
    },
    rows,
    summary: () => ({ antarmuka: rows.filter((r) => r.kind === 'antarmuka').length, halaman: rows.filter((r) => r.kind === 'halaman').length, tanpaLabel: rows.filter((r) => r.kind === 'tanpa-label').length, data: rows.filter((r) => r.kind === 'data').length }),
  };
}

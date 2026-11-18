// Ringkasan's two greeting lines (M8c.3): never an ellipsis. Fitted in the
// real column beside the mascot, in this order:
//   a. both at 26 on one line each;
//   b. line 2 at 22 on one line;
//   c. line 2 at 22 on two lines, balanced, the last two words held
//      together (a no-break space) so no short word is left alone.
// Line 1 stays 26 unless it does not fit itself (a large text zoom): then
// both go to 22 together, and if line 1 still does not fit (360 px at
// 130%), both go to 18, the last step, so line 1 always stays one line.
// Both go to 18 too when line 2 overflows even on two lines at 22. A nickname (24 characters at most) follows the
// same rule. pnpm check:fit measures every phrase through this component.

import { useLayoutEffect, useRef, useState } from 'react';
import { mobileWords } from '@sulo/core/i18n/mobile';

export type GreetingFit = { line1: Size; line2: Size; twoLines: boolean };
type Size = 26 | 22 | 18;

/** "jangan begadang, ya." -> "jangan begadang, ya." (three words or more; two words may still wrap). */
export function holdLastWords(text: string): string {
  const words = text.trim().split(/ +/);
  if (words.length < 3) return text.trim();
  return `${words.slice(0, -2).join(' ')} ${words.at(-2)} ${words.at(-1)}`;
}

const SIZE = { 26: 'text-m26', 22: 'text-m22', 18: 'text-m18' } as const;
const overflows = (el: HTMLElement) => el.scrollWidth > el.clientWidth + 0.5;

function setSize(el: HTMLElement, size: Size, wrap: boolean) {
  // Reduced motion makes every change a 0.01 ms transition (tokens.css), so a size read right
  // after the change would still be the old one: these lines never transition.
  el.style.setProperty('transition', 'none', 'important');
  el.classList.remove(SIZE[26], SIZE[22], SIZE[18]);
  el.classList.add(SIZE[size]);
  // white-space sets the wrap mode; text-wrap-style only balances (no shorthand clash).
  el.style.whiteSpace = wrap ? 'normal' : 'nowrap';
  el.style.setProperty('text-wrap-style', wrap ? 'balance' : 'auto');
}

/** The fitting rule on the two live lines; leaves them styled as decided. */
export function fitGreeting(l1: HTMLElement, l2: HTMLElement): GreetingFit {
  setSize(l1, 26, false);
  setSize(l2, 26, false);
  let line1: Size = 26;
  if (overflows(l1)) {
    setSize(l1, 22, false);
    line1 = overflows(l1) ? 18 : 22;
    setSize(l1, line1, false);
  }
  if (line1 === 26 && !overflows(l2)) return { line1, line2: 26, twoLines: false };
  // Line 2 is never larger than line 1, and 22 at most once it steps down.
  const small: Size = line1 === 18 ? 18 : 22;
  setSize(l2, small, false);
  if (!overflows(l2)) return { line1, line2: small, twoLines: false };
  setSize(l2, small, true);
  if (small === 18 || !overflows(l2)) return { line1, line2: small, twoLines: true };
  // Two lines at 22 still too wide (the held last words at 130%): both lines at 18, the last step.
  setSize(l1, 18, false);
  setSize(l2, 18, false);
  if (!overflows(l2)) return { line1: 18, line2: 18, twoLines: false };
  setSize(l2, 18, true);
  return { line1: 18, line2: 18, twoLines: true };
}

export function GreetingLines({ line1, line2 }: { line1: string; line2: string }) {
  const r1 = useRef<HTMLSpanElement>(null);
  const r2 = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState<GreetingFit>({ line1: 26, line2: 26, twoLines: false });
  const text2 = holdLastWords(line2);

  useLayoutEffect(() => {
    const a = r1.current;
    const b = r2.current;
    if (!a || !b) return;
    const run = () => setFit(fitGreeting(a, b));
    run();
    const ro = new ResizeObserver(run);
    ro.observe(a.parentElement ?? a);
    return () => ro.disconnect();
  }, [line1, text2]);

  // pnpm check:fit (web build only): try any pair in the live lines, then restore.
  useLayoutEffect(() => {
    if (!(__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web')) return;
    const a = r1.current;
    const b = r2.current;
    if (!a || !b) return;
    // Core's own phrase lists (both languages), so new phrases are measured without a copy.
    (window as unknown as { __suloGreetPhrases?: unknown }).__suloGreetPhrases = (['id', 'en'] as const).map((lang) => ({ lang, line1: mobileWords(lang).greet.line1, phrases: mobileWords(lang).greet.phrases }));
    (window as unknown as { __suloFitGreeting?: unknown }).__suloFitGreeting = (t1: string, t2: string) => {
      // A copy of the two lines in the same column (same width, classes and font); the live lines are never touched.
      const h2 = a.parentElement!;
      const column = h2.parentElement!;
      const copy = h2.cloneNode(true) as HTMLElement;
      copy.style.position = 'absolute';
      copy.style.visibility = 'hidden';
      copy.style.left = '0';
      copy.style.top = '0';
      copy.style.width = `${h2.getBoundingClientRect().width}px`;
      column.style.position = 'relative';
      column.appendChild(copy);
      const [ca, cb] = [copy.children[0] as HTMLElement, copy.children[1] as HTMLElement];
      ca.textContent = t1;
      cb.textContent = holdLastWords(t2);
      const decided = fitGreeting(ca, cb);
      const box = copy.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(cb);
      const rects = [...range.getClientRects()];
      const lineTops = [...new Set(rects.map((r) => Math.round(r.top)))];
      const lastWidth = rects.filter((r) => Math.round(r.top) === lineTops.at(-1)).reduce((w, r) => w + r.width, 0);
      const out = {
        ...decided,
        colWidth: Math.round(box.width),
        fontPx: [getComputedStyle(ca).fontSize, getComputedStyle(cb).fontSize],
        lines: lineTops.length,
        overflow: overflows(ca) || overflows(cb),
        // Every line of text ends inside the column (never under the mascot).
        collides: rects.some((r) => r.right > box.right + 0.5),
        // A short word left alone on the last line.
        orphan: lineTops.length > 1 && lastWidth < 48,
      };
      copy.remove();
      return out;
    };
  }, []);

  return (
    <h2>
      <span ref={r1} className={`block ${SIZE[fit.line1]}`} style={{ whiteSpace: 'nowrap' }}>
        {line1}
      </span>
      <span ref={r2} className={`block text-muted-foreground ${SIZE[fit.line2]} ${fit.line2 !== 26 ? 'font-semibold' : ''}`} style={{ whiteSpace: fit.twoLines ? 'normal' : 'nowrap', textWrapStyle: fit.twoLines ? 'balance' : 'auto' }}>
        {text2}
      </span>
    </h2>
  );
}

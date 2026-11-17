import { useEffect, type RefObject } from 'react';
import { countdownLabel } from '@/lib/format/countdown';
import { countdownOrLate, localeOf } from '@/lib/format/time';
import type { Messages } from '@/lib/i18n';

/**
 * One timer for the whole page (popup or dashboard) for "Hitung mundur".
 * Each second it rewrites only the text of elements marked data-due-at that
 * are on screen, without re-rendering; their aria-label changes only when
 * the spoken minute changes (no live region, nothing announced per second).
 * It writes the existing text node's value, so React's own updates keep
 * working. The timer stops while the document is hidden and catches up the
 * moment it is visible again; ticks are aligned to the wall-clock second.
 * Nothing is requested.
 */
export function useCountdownTicker(root: RefObject<HTMLElement | null>, active: boolean, timeZone: string, m: Messages): void {
  useEffect(() => {
    if (!active) return;
    let timer = 0;
    const locale = localeOf(m);

    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const height = window.innerHeight;
      root.current?.querySelectorAll<HTMLElement>('[data-due-at]').forEach((el) => {
        const box = el.getBoundingClientRect();
        if (box.bottom < 0 || box.top > height || (box.width === 0 && box.height === 0)) return;
        const dueAt = Number(el.dataset.dueAt);
        const text = countdownOrLate(dueAt, now, timeZone, m);
        const node = el.firstChild;
        if (node && node.nodeType === Node.TEXT_NODE) {
          if (node.nodeValue !== text) node.nodeValue = text;
        } else {
          el.textContent = text;
        }
        const label = countdownLabel((dueAt - now) * 1000, locale) ?? text;
        if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
      });
    };

    const loop = () => {
      tick();
      timer = window.setTimeout(loop, 1000 - (Date.now() % 1000) + 5);
    };

    const onVisibility = () => {
      window.clearTimeout(timer);
      if (!document.hidden) loop();
    };

    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [root, active, timeZone, m]);
}

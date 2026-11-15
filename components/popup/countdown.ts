import { useEffect, type RefObject } from 'react';
import { formatCountdown } from '@/lib/format/time';
import type { Messages } from '@/lib/i18n';

/**
 * One timer for the whole popup, for the "Hitung mundur" format. Each second
 * it rewrites only the text of elements marked with data-due-at, without
 * re-rendering the list. It writes the existing text node's value, never
 * replaces the node, so React's own updates keep working.
 *
 * The timer stops while the page is hidden and catches up to the real time
 * the moment it is visible again. Ticks are aligned to the wall-clock second.
 */
export function useCountdownTicker(root: RefObject<HTMLElement | null>, active: boolean, timeZone: string, m: Messages): void {
  useEffect(() => {
    if (!active) return;
    let timer = 0;

    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      root.current?.querySelectorAll<HTMLElement>('[data-due-at]').forEach((el) => {
        const text = formatCountdown(Number(el.dataset.dueAt), now, timeZone, m);
        const node = el.firstChild;
        if (node && node.nodeType === Node.TEXT_NODE) {
          if (node.nodeValue !== text) node.nodeValue = text;
        } else {
          el.textContent = text;
        }
      });
    };

    const loop = () => {
      tick();
      timer = window.setTimeout(loop, 1000 - (Date.now() % 1000) + 5);
    };

    const onVisibility = () => {
      window.clearTimeout(timer);
      if (document.visibilityState !== 'hidden') loop();
    };

    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [root, active, timeZone, m]);
}

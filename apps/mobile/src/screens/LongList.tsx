// Long lists stay smooth without a dependency: rows are mounted 100 at a
// time as the user scrolls (a sentinel at the end asks for the next page),
// and in lists over 40 cards each row is skipped by layout and paint while
// off screen (content-visibility: auto, WebView's own windowing). Kabar and
// Kalender's lists use the same rule through offscreenRow.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export const PAGE_ROWS = 100;
/** Past this many cards, rows off screen skip layout and paint. */
export const LONG_LIST_ROWS = 40;

/** A row's style in a list of `total` cards: content-visibility past LONG_LIST_ROWS, with its usual height kept for the scrollbar. */
export function offscreenRow(total: number, rowHeight: number): CSSProperties | undefined {
  return total > LONG_LIST_ROWS ? { contentVisibility: 'auto', containIntrinsicSize: `auto ${rowHeight}px` } : undefined;
}

/** How many rows to mount: a page, then a page more each time the end comes into view. */
export function mountedCount(total: number, pages: number): number {
  return Math.min(total, Math.max(1, pages) * PAGE_ROWS);
}

/** sticky: rows that stay at the top while their group scrolls (group headings). */
export function LongList<T>({ items, keyOf, render, className = '', rowHeight = 64, sticky }: { items: readonly T[]; keyOf: (item: T) => string | number; render: (item: T) => ReactNode; className?: string; rowHeight?: number; sticky?: (item: T) => boolean }) {
  const [pages, setPages] = useState(1);
  const sentinel = useRef<HTMLLIElement | null>(null);
  const shown = mountedCount(items.length, pages);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || shown >= items.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setPages((p) => p + 1), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, items.length]);

  return (
    <ul className={className}>
      {items.slice(0, shown).map((item) => (
        <li key={keyOf(item)} className={sticky?.(item) ? 'sticky top-0 z-10' : undefined} style={sticky?.(item) ? undefined : offscreenRow(items.length, rowHeight)}>
          {render(item)}
        </li>
      ))}
      {shown < items.length && <li ref={sentinel} aria-hidden="true" className="h-px" />}
    </ul>
  );
}

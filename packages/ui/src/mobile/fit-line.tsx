// A time that never breaks: relative times and countdowns stay on one line
// (white-space nowrap). When the text does not fit at its size (a large
// text zoom), it steps down once (22 to 18, 15 to 13); if even that is too
// wide, it ends in an ellipsis rather than wrapping.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const STEP: Record<string, string> = { 'text-m22': 'text-m18', 'text-m18': 'text-m15', 'text-m15': 'text-m13', 'text-m13': 'text-m12', 'text-m12': 'text-m11' };

export function FitLine({ size, className = '', children, text }: { size: keyof typeof STEP; className?: string; children: ReactNode; /** Re-measured when this changes. */ text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [small, setSmall] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // Measure at the full size: the step down is only for a text that does not fit.
      el.classList.remove(STEP[size]!);
      el.classList.add(size);
      const over = el.scrollWidth > el.clientWidth + 0.5;
      el.classList.remove(over ? size : STEP[size]!);
      el.classList.add(over ? STEP[size]! : size);
      setSmall(over);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size, text]);
  return (
    <p ref={ref} data-fit={small ? 'small' : 'full'} className={`truncate whitespace-nowrap ${small ? STEP[size] : size} ${className}`}>
      {children}
    </p>
  );
}
